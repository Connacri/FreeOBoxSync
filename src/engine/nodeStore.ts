/**
 * Embedded Local Object Database Engine (NodeStore)
 * 
 * Each peer runs an instance of NodeStore on the local LAN.
 * Maintains local memory-mapped objects, Write-Ahead Log (WAL), HLC clock, and CRDT merge.
 */

import {
  SyncObject,
  FieldCRDTValue,
  SyncFrame,
  SyncOpCode,
  ConflictRecord,
  EntitySchema,
  HLC,
  SyncAuditLog,
} from '../types/sync';
import { HybridLogicalClock } from './hlc';
import {
  encodeSyncFrame,
  decodeSyncFrame,
  encodeFieldDeltas,
  decodeFieldDeltas,
} from './binaryProtocol';
import { CRDTEngine } from './crdt';
import { DEFAULT_SCHEMAS } from './schemas';

export class NodeStore {
  public readonly nodeId: string;
  public readonly nodeName: string;
  public readonly ipAddress: string;
  public readonly role: 'mobile' | 'tablet' | 'edge_gateway' | 'cloud_hub';
  public isOnline: boolean = true;

  private clock: HybridLogicalClock;
  private txCounter: number = 0;
  private objects: Map<string, SyncObject> = new Map(); // key: `${entityId}_${objectId}`
  private schemas: Map<number, EntitySchema> = new Map();
  private wal: Array<{ txId: number; frame: SyncFrame; bytes: Uint8Array; timestamp: number }> = [];
  public unsyncedQueue: Array<{ frame: SyncFrame; bytes: Uint8Array }> = [];
  public versionVector: Record<string, number> = {}; // peerNodeId -> max txId seen
  public auditLogs: SyncAuditLog[] = [];
  public conflicts: ConflictRecord[] = [];

  constructor(
    nodeId: string,
    nodeName: string,
    ipAddress: string,
    role: 'mobile' | 'tablet' | 'edge_gateway' | 'cloud_hub',
    initialClockTime?: number
  ) {
    this.nodeId = nodeId;
    this.nodeName = nodeName;
    this.ipAddress = ipAddress;
    this.role = role;
    this.clock = new HybridLogicalClock(nodeId, initialClockTime);
    this.versionVector[nodeId] = 0;

    for (const schema of DEFAULT_SCHEMAS) {
      this.schemas.set(schema.id, schema);
    }
  }

  public getHLC(): HLC {
    return this.clock.getSnapshot();
  }

  public getObjects(entityId?: number): SyncObject[] {
    const all = Array.from(this.objects.values());
    if (entityId) {
      return all.filter((obj) => obj.entityId === entityId && !obj.deleted);
    }
    return all.filter((obj) => !obj.deleted);
  }

  public getAllObjectsIncludingDeleted(entityId?: number): SyncObject[] {
    const all = Array.from(this.objects.values());
    if (entityId) {
      return all.filter((obj) => obj.entityId === entityId);
    }
    return all;
  }

  public getObject(entityId: number, objectId: number): SyncObject | undefined {
    return this.objects.get(`${entityId}_${objectId}`);
  }

  public getWal(): Array<{ txId: number; frame: SyncFrame; bytes: Uint8Array; timestamp: number }> {
    return [...this.wal];
  }

  /**
   * Local Mutation: Create or Update Object
   */
  public put(
    entityId: number,
    objectId: number,
    updates: Record<string, any>
  ): { object: SyncObject; frame: SyncFrame; bytes: Uint8Array } {
    const schema = this.schemas.get(entityId);
    if (!schema) throw new Error(`Schema ${entityId} not found`);

    const key = `${entityId}_${objectId}`;
    const existing = this.objects.get(key);
    const eventHlc = this.clock.now();
    this.txCounter += 1;
    const txId = this.txCounter;
    this.versionVector[this.nodeId] = txId;

    const fields: Record<string, FieldCRDTValue> = existing
      ? { ...existing.fields }
      : {};

    let deltaMask = 0;
    const changedFields: string[] = [];
    const deltaList: Array<{ propId: number; type: string; value: any }> = [];

    for (const [fieldName, val] of Object.entries(updates)) {
      const prop = schema.properties.find((p) => p.name === fieldName);
      if (!prop) continue;

      const propBit = 1 << ((prop.id - 1) % 32);
      deltaMask |= propBit;
      changedFields.push(fieldName);

      if (prop.type === 'pn_counter') {
        const deltaPos = typeof val === 'object' && val.deltaPos ? Number(val.deltaPos) : (Number(val) > 0 ? Number(val) : 0);
        const deltaNeg = typeof val === 'object' && val.deltaNeg ? Number(val.deltaNeg) : (Number(val) < 0 ? Math.abs(Number(val)) : 0);
        
        const existingCounter = fields[fieldName]?.pnCounter || { positives: {}, negatives: {} };
        const newPos = { ...existingCounter.positives, [this.nodeId]: (existingCounter.positives[this.nodeId] || 0) + deltaPos };
        const newNeg = { ...existingCounter.negatives, [this.nodeId]: (existingCounter.negatives[this.nodeId] || 0) + deltaNeg };
        
        const total = Object.values(newPos).reduce((a, b) => a + b, 0) - Object.values(newNeg).reduce((a, b) => a + b, 0);

        fields[fieldName] = {
          type: 'pn_counter',
          raw: total,
          hlc: eventHlc,
          pnCounter: { positives: newPos, negatives: newNeg },
        };

        deltaList.push({ propId: prop.id, type: 'pn_counter', value: { deltaPos, deltaNeg } });
      } else if (prop.type === 'or_set') {
        const op = val?.op || 'add';
        const element = val?.element || String(val);
        const currentElements = fields[fieldName]?.orSet ? [...fields[fieldName].orSet!] : [];

        if (op === 'add') {
          currentElements.push({
            value: element,
            addedBy: this.nodeId,
            addHLC: eventHlc,
            removed: false,
          });
        } else {
          for (const el of currentElements) {
            if (el.value === element && !el.removed) {
              el.removed = true;
              el.removeHLC = eventHlc;
            }
          }
        }

        const aliveValues = Array.from(new Set(currentElements.filter((e) => !e.removed).map((e) => e.value)));
        fields[fieldName] = {
          type: 'or_set',
          raw: aliveValues,
          hlc: eventHlc,
          orSet: currentElements,
        };

        deltaList.push({ propId: prop.id, type: 'or_set', value: { op, element } });
      } else {
        // Scalar LWW
        fields[fieldName] = {
          type: prop.type,
          raw: val,
          hlc: eventHlc,
        };
        deltaList.push({ propId: prop.id, type: prop.type, value: val });
      }
    }

    const syncObj: SyncObject = {
      id: objectId,
      entityId,
      fields,
      createdHLC: existing ? existing.createdHLC : eventHlc,
      updatedHLC: eventHlc,
      deleted: false,
      version: (existing?.version || 0) + 1,
    };

    this.objects.set(key, syncObj);

    // Encode zero-copy binary payload
    const packedPayload = encodeFieldDeltas(deltaList);
    const { bytes, frame } = encodeSyncFrame(
      {
        flags: 0x01, // DELTA flag
        txId,
        nodeId: this.nodeId,
        hlc: eventHlc,
        opCode: SyncOpCode.PUT_OBJECT,
        entityId,
        objectId,
        deltaMask,
      },
      packedPayload
    );

    frame.metadata = {
      entityName: schema.name,
      description: `PUT ${schema.name} #${objectId} (${changedFields.join(', ')})`,
      changedFields,
      valuesSummary: updates,
    };

    this.wal.push({ txId, frame, bytes, timestamp: Date.now() });
    this.unsyncedQueue.push({ frame, bytes });

    this.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      action: 'LOCAL_WRITE',
      details: `Committed TX #${txId} locally: ${schema.name} #${objectId} [${changedFields.join(', ')}]`,
      frameId: txId,
      entityId,
      objectId,
    });

    return { object: syncObj, frame, bytes };
  }

  /**
   * Delete object locally (tombstone)
   */
  public delete(entityId: number, objectId: number): { frame: SyncFrame; bytes: Uint8Array } {
    const key = `${entityId}_${objectId}`;
    const existing = this.objects.get(key);
    const schema = this.schemas.get(entityId);
    const eventHlc = this.clock.now();
    this.txCounter += 1;
    const txId = this.txCounter;
    this.versionVector[this.nodeId] = txId;

    if (existing) {
      existing.deleted = true;
      existing.updatedHLC = eventHlc;
      existing.version += 1;
    }

    const { bytes, frame } = encodeSyncFrame(
      {
        flags: 0x01,
        txId,
        nodeId: this.nodeId,
        hlc: eventHlc,
        opCode: SyncOpCode.DELETE_OBJECT,
        entityId,
        objectId,
        deltaMask: 0,
      },
      new Uint8Array(0)
    );

    frame.metadata = {
      entityName: schema?.name || `Entity_${entityId}`,
      description: `DELETE ${schema?.name || 'Object'} #${objectId} (Tombstone)`,
      changedFields: ['DELETED'],
    };

    this.wal.push({ txId, frame, bytes, timestamp: Date.now() });
    this.unsyncedQueue.push({ frame, bytes });

    this.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      action: 'LOCAL_WRITE',
      details: `Tombstoned TX #${txId}: Entity #${entityId} Object #${objectId}`,
      frameId: txId,
      entityId,
      objectId,
    });

    return { frame, bytes };
  }

  /**
   * Receive and process a binary replication frame sent across the local network.
   */
  public receiveBinaryFrame(
    rawBytes: Uint8Array,
    sourceNodeId: string
  ): { success: boolean; conflicts: ConflictRecord[]; changed: boolean; frame: SyncFrame } {
    const frame = decodeSyncFrame(rawBytes);
    const header = frame.header;

    // Advance local Hybrid Logical Clock
    this.clock.receive(header.hlc);

    // Track remote version vector
    const currentMax = this.versionVector[header.nodeId] || 0;
    if (header.txId > currentMax) {
      this.versionVector[header.nodeId] = header.txId;
    }

    const schema = this.schemas.get(header.entityId);
    if (!schema) {
      return { success: false, conflicts: [], changed: false, frame };
    }

    const key = `${header.entityId}_${header.objectId}`;
    const existing = this.objects.get(key);

    if (header.opCode === SyncOpCode.DELETE_OBJECT) {
      if (existing) {
        const dummyRemote: SyncObject = {
          id: header.objectId,
          entityId: header.entityId,
          fields: {},
          createdHLC: header.hlc,
          updatedHLC: header.hlc,
          deleted: true,
          version: existing.version + 1,
        };
        const mergeRes = CRDTEngine.mergeObject(
          existing,
          dummyRemote,
          schema,
          this.nodeId,
          sourceNodeId
        );
        this.objects.set(key, mergeRes.mergedObject);
        this.conflicts.unshift(...mergeRes.conflicts);

        this.auditLogs.unshift({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          nodeId: this.nodeId,
          action: 'FRAME_RECEIVED',
          details: `Merged remote DELETE frame from ${sourceNodeId} (Tx #${header.txId})`,
          frameId: header.txId,
          entityId: header.entityId,
          objectId: header.objectId,
        });

        return { success: true, conflicts: mergeRes.conflicts, changed: mergeRes.hasChanges, frame };
      }
      return { success: true, conflicts: [], changed: false, frame };
    }

    // Decode field deltas from binary payload
    const decodedDeltas = decodeFieldDeltas(frame.payload);
    const remoteFields: Record<string, FieldCRDTValue> = {};

    for (const delta of decodedDeltas) {
      const prop = schema.properties.find((p) => p.id === delta.propId);
      if (!prop) continue;

      if (prop.type === 'pn_counter') {
        const deltaPos = delta.value?.deltaPos || 0;
        const deltaNeg = delta.value?.deltaNeg || 0;
        remoteFields[prop.name] = {
          type: 'pn_counter',
          raw: deltaPos - deltaNeg,
          hlc: header.hlc,
          pnCounter: {
            positives: { [header.nodeId]: deltaPos },
            negatives: { [header.nodeId]: deltaNeg },
          },
        };
      } else if (prop.type === 'or_set') {
        const op = delta.value?.op || 'add';
        const el = delta.value?.element || '';
        remoteFields[prop.name] = {
          type: 'or_set',
          raw: op === 'add' ? [el] : [],
          hlc: header.hlc,
          orSet: [
            {
              value: el,
              addedBy: header.nodeId,
              addHLC: header.hlc,
              removed: op === 'remove',
              removeHLC: op === 'remove' ? header.hlc : undefined,
            },
          ],
        };
      } else {
        remoteFields[prop.name] = {
          type: prop.type,
          raw: delta.value,
          hlc: header.hlc,
        };
      }
    }

    const remoteObj: SyncObject = {
      id: header.objectId,
      entityId: header.entityId,
      fields: remoteFields,
      createdHLC: header.hlc,
      updatedHLC: header.hlc,
      deleted: false,
      version: 1,
    };

    if (!existing) {
      // New object created on remote
      this.objects.set(key, remoteObj);
      this.auditLogs.unshift({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        nodeId: this.nodeId,
        action: 'FRAME_RECEIVED',
        details: `Instantiated new ${schema.name} #${header.objectId} from ${sourceNodeId} (Tx #${header.txId})`,
        frameId: header.txId,
        entityId: header.entityId,
        objectId: header.objectId,
      });
      return { success: true, conflicts: [], changed: true, frame };
    }

    // Merge concurrent changes using CRDT rules
    const mergeRes = CRDTEngine.mergeObject(
      existing,
      remoteObj,
      schema,
      this.nodeId,
      sourceNodeId
    );

    this.objects.set(key, mergeRes.mergedObject);
    if (mergeRes.conflicts.length > 0) {
      this.conflicts.unshift(...mergeRes.conflicts);
    }

    this.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      action: 'CRDT_MERGED',
      details: `Merged remote delta from ${sourceNodeId} on ${schema.name} #${header.objectId}. ${mergeRes.conflicts.length} conflict(s) resolved via CRDT.`,
      frameId: header.txId,
      entityId: header.entityId,
      objectId: header.objectId,
    });

    return {
      success: true,
      conflicts: mergeRes.conflicts,
      changed: mergeRes.hasChanges,
      frame,
    };
  }

  /**
   * Clears queue once frames are safely delivered to peers
   */
  public acknowledgeSyncedFrames(txIds: number[]) {
    const idSet = new Set(txIds);
    this.unsyncedQueue = this.unsyncedQueue.filter((item) => !idSet.has(item.frame.header.txId));
  }
}
