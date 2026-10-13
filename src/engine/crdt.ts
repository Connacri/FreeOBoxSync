/**
 * Field-level CRDT Merge Engine for ObjectBox Sync
 *
 * Implements LWW-Register (with HLC), PN-Counter, and OR-Set (Observed-Remove Set).
 * Ensures Strong Eventual Consistency (SEC) across all edge nodes.
 */

import {
  SyncObject,
  FieldCRDTValue,
  PNCounterState,
  ORSetElement,
  HLC,
  ConflictRecord,
  EntitySchema,
} from '../types/sync';
import { HybridLogicalClock } from './hlc';

export interface MergeResult {
  mergedObject: SyncObject;
  conflicts: ConflictRecord[];
  hasChanges: boolean;
}

export class CRDTEngine {
  /**
   * Merges two replicas of the same object: local and remote.
   * Produces a deterministically merged object according to CRDT rules.
   */
  public static mergeObject(
    local: SyncObject,
    remote: SyncObject,
    schema: EntitySchema,
    localNodeId: string,
    remoteNodeId: string
  ): MergeResult {
    const conflicts: ConflictRecord[] = [];
    let hasChanges = false;

    // Check tombstone / deletion
    const isLocalDeleted = Boolean(local.deleted);
    const isRemoteDeleted = Boolean(remote.deleted);

    let finalDeleted = false;
    let finalUpdatedHLC = HybridLogicalClock.isNewer(remote.updatedHLC, local.updatedHLC)
      ? remote.updatedHLC
      : local.updatedHLC;

    if (isLocalDeleted !== isRemoteDeleted) {
      if (isRemoteDeleted) {
        if (HybridLogicalClock.isNewer(remote.updatedHLC, local.updatedHLC)) {
          finalDeleted = true;
          hasChanges = true;
          conflicts.push({
            id: `conf_${Date.now()}_del`,
            timestamp: Date.now(),
            entityName: schema.name,
            objectId: local.id,
            fieldName: 'TOMBSTONE',
            strategy: 'LWW_HLC',
            winnerNode: remoteNodeId,
            loserNode: localNodeId,
            winnerValue: 'DELETED',
            loserValue: 'ALIVE',
            winnerHlc: remote.updatedHLC,
            loserHlc: local.updatedHLC,
            rationale: `Remote delete HLC (${HybridLogicalClock.format(remote.updatedHLC)}) is newer than local update HLC.`,
          });
        } else {
          finalDeleted = false;
          conflicts.push({
            id: `conf_${Date.now()}_del`,
            timestamp: Date.now(),
            entityName: schema.name,
            objectId: local.id,
            fieldName: 'TOMBSTONE',
            strategy: 'LWW_HLC',
            winnerNode: localNodeId,
            loserNode: remoteNodeId,
            winnerValue: 'ALIVE',
            loserValue: 'DELETED',
            winnerHlc: local.updatedHLC,
            loserHlc: remote.updatedHLC,
            rationale: `Local update HLC (${HybridLogicalClock.format(local.updatedHLC)}) is newer than remote tombstone.`,
          });
        }
      } else {
        // Local is deleted, remote is alive
        if (HybridLogicalClock.isNewer(remote.updatedHLC, local.updatedHLC)) {
          finalDeleted = false;
          hasChanges = true;
          conflicts.push({
            id: `conf_${Date.now()}_resurrect`,
            timestamp: Date.now(),
            entityName: schema.name,
            objectId: local.id,
            fieldName: 'TOMBSTONE',
            strategy: 'LWW_HLC',
            winnerNode: remoteNodeId,
            loserNode: localNodeId,
            winnerValue: 'RESURRECTED',
            loserValue: 'DELETED',
            winnerHlc: remote.updatedHLC,
            loserHlc: local.updatedHLC,
            rationale: `Remote resurrected object with newer HLC (${HybridLogicalClock.format(remote.updatedHLC)}).`,
          });
        } else {
          finalDeleted = true;
        }
      }
    } else {
      finalDeleted = isLocalDeleted;
    }

    // Merge properties field by field
    const mergedFields: Record<string, FieldCRDTValue> = {};
    const allFieldNames = new Set([
      ...Object.keys(local.fields),
      ...Object.keys(remote.fields),
    ]);

    for (const fieldName of allFieldNames) {
      const propDef = schema.properties.find((p) => p.name === fieldName);
      const localVal = local.fields[fieldName];
      const remoteVal = remote.fields[fieldName];

      if (!localVal && remoteVal) {
        mergedFields[fieldName] = remoteVal;
        hasChanges = true;
        continue;
      }
      if (localVal && !remoteVal) {
        mergedFields[fieldName] = localVal;
        continue;
      }
      if (!localVal && !remoteVal) continue;

      // Both replicas have a value for this field!
      const propType = propDef?.type || localVal.type;

      if (propType === 'pn_counter') {
        const { value, state, changed } = CRDTEngine.mergePNCounter(
          localVal.pnCounter || { positives: {}, negatives: {} },
          remoteVal.pnCounter || { positives: {}, negatives: {} },
          localVal.hlc,
          remoteVal.hlc
        );
        mergedFields[fieldName] = {
          type: 'pn_counter',
          raw: value,
          hlc: HybridLogicalClock.isNewer(remoteVal.hlc, localVal.hlc) ? remoteVal.hlc : localVal.hlc,
          pnCounter: state,
        };
        if (changed) {
          hasChanges = true;
          conflicts.push({
            id: `conf_${Date.now()}_${fieldName}`,
            timestamp: Date.now(),
            entityName: schema.name,
            objectId: local.id,
            fieldName,
            strategy: 'PN_COUNTER_MERGE',
            winnerNode: 'BOTH (Converged)',
            loserNode: 'N/A',
            winnerValue: value,
            loserValue: `Local: ${localVal.raw}, Remote: ${remoteVal.raw}`,
            winnerHlc: remoteVal.hlc,
            loserHlc: localVal.hlc,
            rationale: `PN-Counter merged all positive increments and negative decrements across both nodes without loss.`,
          });
        }
      } else if (propType === 'or_set') {
        const { elements, values, changed } = CRDTEngine.mergeORSet(
          localVal.orSet || [],
          remoteVal.orSet || []
        );
        mergedFields[fieldName] = {
          type: 'or_set',
          raw: values,
          hlc: HybridLogicalClock.isNewer(remoteVal.hlc, localVal.hlc) ? remoteVal.hlc : localVal.hlc,
          orSet: elements,
        };
        if (changed) {
          hasChanges = true;
          conflicts.push({
            id: `conf_${Date.now()}_${fieldName}`,
            timestamp: Date.now(),
            entityName: schema.name,
            objectId: local.id,
            fieldName,
            strategy: 'OR_SET_UNION',
            winnerNode: 'UNION',
            loserNode: 'N/A',
            winnerValue: values.join(', '),
            loserValue: `Local: ${(localVal.raw || []).join(', ')}, Remote: ${(remoteVal.raw || []).join(', ')}`,
            winnerHlc: remoteVal.hlc,
            loserHlc: localVal.hlc,
            rationale: `Observed-Remove Set merged tag additions and deletions respecting causal add/remove tags.`,
          });
        }
      } else {
        // Standard Scalar LWW-Register with HLC
        const cmp = HybridLogicalClock.compare(remoteVal.hlc, localVal.hlc);

        if (cmp > 0) {
          // Remote is strictly newer
          mergedFields[fieldName] = remoteVal;
          if (localVal.raw !== remoteVal.raw) {
            hasChanges = true;
            conflicts.push({
              id: `conf_${Date.now()}_${fieldName}`,
              timestamp: Date.now(),
              entityName: schema.name,
              objectId: local.id,
              fieldName,
              strategy: 'LWW_HLC',
              winnerNode: remoteNodeId,
              loserNode: localNodeId,
              winnerValue: remoteVal.raw,
              loserValue: localVal.raw,
              winnerHlc: remoteVal.hlc,
              loserHlc: localVal.hlc,
              rationale: `Remote HLC (${HybridLogicalClock.format(remoteVal.hlc)}) is newer than local (${HybridLogicalClock.format(localVal.hlc)}).`,
            });
          }
        } else if (cmp < 0) {
          // Local is strictly newer
          mergedFields[fieldName] = localVal;
        } else {
          // Exact HLC tie! Broken deterministically by node ID comparison
          const tieBreak = remoteNodeId.localeCompare(localNodeId) > 0;
          if (tieBreak) {
            mergedFields[fieldName] = remoteVal;
            if (localVal.raw !== remoteVal.raw) {
              hasChanges = true;
              conflicts.push({
                id: `conf_${Date.now()}_${fieldName}`,
                timestamp: Date.now(),
                entityName: schema.name,
                objectId: local.id,
                fieldName,
                strategy: 'TIE_BREAK_NODE',
                winnerNode: remoteNodeId,
                loserNode: localNodeId,
                winnerValue: remoteVal.raw,
                loserValue: localVal.raw,
                winnerHlc: remoteVal.hlc,
                loserHlc: localVal.hlc,
                rationale: `Identical physical/logical HLC. Tie broken deterministically by node ID (${remoteNodeId} > ${localNodeId}).`,
              });
            }
          } else {
            mergedFields[fieldName] = localVal;
          }
        }
      }
    }

    const mergedObject: SyncObject = {
      id: local.id,
      entityId: local.entityId,
      fields: mergedFields,
      createdHLC: local.createdHLC,
      updatedHLC: finalUpdatedHLC,
      deleted: finalDeleted,
      version: Math.max(local.version, remote.version) + 1,
    };

    return { mergedObject, conflicts, hasChanges };
  }

  /**
   * PN-Counter: Positive-Negative Counter merge.
   * State-based CRDT where total = sum(positives) - sum(negatives)
   */
  public static mergePNCounter(
    localState: PNCounterState,
    remoteState: PNCounterState,
    localHlc: HLC,
    remoteHlc: HLC
  ): { value: number; state: PNCounterState; changed: boolean } {
    const mergedPos: Record<string, number> = {};
    const mergedNeg: Record<string, number> = {};

    const allNodes = new Set([
      ...Object.keys(localState.positives || {}),
      ...Object.keys(remoteState.positives || {}),
      ...Object.keys(localState.negatives || {}),
      ...Object.keys(remoteState.negatives || {}),
    ]);

    let changed = false;

    for (const node of allNodes) {
      const locP = localState.positives?.[node] ?? 0;
      const remP = remoteState.positives?.[node] ?? 0;
      const maxP = Math.max(locP, remP);
      mergedPos[node] = maxP;
      if (maxP !== locP) changed = true;

      const locN = localState.negatives?.[node] ?? 0;
      const remN = remoteState.negatives?.[node] ?? 0;
      const maxN = Math.max(locN, remN);
      mergedNeg[node] = maxN;
      if (maxN !== locN) changed = true;
    }

    const totalPos = Object.values(mergedPos).reduce((a, b) => a + b, 0);
    const totalNeg = Object.values(mergedNeg).reduce((a, b) => a + b, 0);
    const value = totalPos - totalNeg;

    return {
      value,
      state: { positives: mergedPos, negatives: mergedNeg },
      changed,
    };
  }

  /**
   * OR-Set (Observed-Remove Set) merge:
   * Keeps track of additions and removals with distinct HLC timestamps.
   */
  public static mergeORSet(
    localElements: ORSetElement[],
    remoteElements: ORSetElement[]
  ): { elements: ORSetElement[]; values: string[]; changed: boolean } {
    const elementMap = new Map<string, ORSetElement>();
    let changed = false;

    // Helper key combining value and adding node
    const getKey = (el: ORSetElement) => `${el.value}__${el.addedBy}__${el.addHLC.physical}_${el.addHLC.logical}`;

    for (const el of localElements) {
      elementMap.set(getKey(el), { ...el });
    }

    for (const remoteEl of remoteElements) {
      const key = getKey(remoteEl);
      const existing = elementMap.get(key);

      if (!existing) {
        elementMap.set(key, { ...remoteEl });
        changed = true;
      } else {
        // Element exists in both, merge removal status
        if (remoteEl.removed && !existing.removed) {
          existing.removed = true;
          existing.removeHLC = remoteEl.removeHLC;
          changed = true;
        } else if (remoteEl.removed && existing.removed) {
          // If both removed, keep newer remove HLC
          if (
            remoteEl.removeHLC &&
            existing.removeHLC &&
            HybridLogicalClock.isNewer(remoteEl.removeHLC, existing.removeHLC)
          ) {
            existing.removeHLC = remoteEl.removeHLC;
          }
        }
      }
    }

    const mergedElements = Array.from(elementMap.values());
    const aliveValues = Array.from(
      new Set(
        mergedElements
          .filter((el) => !el.removed)
          .map((el) => el.value)
      )
    );

    return {
      elements: mergedElements,
      values: aliveValues,
      changed,
    };
  }
}
