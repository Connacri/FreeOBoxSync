/**
 * Local LAN Decentralized Network Mesh Simulator
 * 
 * Simulates ultra-low-latency local Wi-Fi / Ethernet synchronization between peers.
 * Zero reliance on external cloud servers — 100% free, private, and sub-millisecond.
 */

import { NodeStore } from './nodeStore';
import { NetworkPacket, SyncFrame, ConflictRecord, SyncAuditLog } from '../types/sync';

export interface NetworkConfig {
  baseLatencyMs: number;
  jitterMs: number;
  packetLossPct: number;
  partitionEnabled: boolean;
  partitionGroupA: string[]; // Node IDs in group A
  partitionGroupB: string[]; // Node IDs in group B
}

export type PacketCallback = (packet: NetworkPacket) => void;
export type ConflictCallback = (conflict: ConflictRecord) => void;
export type LogCallback = (log: SyncAuditLog) => void;

export class NetworkMesh {
  public nodes: Map<string, NodeStore> = new Map();
  public inFlightPackets: NetworkPacket[] = [];
  public deliveredPacketsHistory: NetworkPacket[] = [];
  public config: NetworkConfig = {
    baseLatencyMs: 1.8, // Typical local Wi-Fi 6 round-trip
    jitterMs: 0.8,
    packetLossPct: 0,
    partitionEnabled: false,
    partitionGroupA: ['node_mobile', 'node_tablet'],
    partitionGroupB: ['node_edge_pi', 'node_workstation'],
  };

  private packetListeners: PacketCallback[] = [];
  private conflictListeners: ConflictCallback[] = [];
  private logListeners: LogCallback[] = [];
  private animTimer: any = null;

  constructor() {
    this.initDefaultNodes();
  }

  private initDefaultNodes() {
    const mobile = new NodeStore('node_mobile', 'Mobile Galaxy S24', '192.168.1.45', 'mobile');
    const tablet = new NodeStore('node_tablet', 'Warehouse Rugged Tab', '192.168.1.72', 'tablet');
    const edgePi = new NodeStore('node_edge_pi', 'Raspberry Pi 5 Hub', '192.168.1.10', 'edge_gateway');
    const workstation = new NodeStore('node_workstation', 'Supervisor PC', '192.168.1.2', 'cloud_hub');

    this.nodes.set(mobile.nodeId, mobile);
    this.nodes.set(tablet.nodeId, tablet);
    this.nodes.set(edgePi.nodeId, edgePi);
    this.nodes.set(workstation.nodeId, workstation);
  }

  public onPacket(cb: PacketCallback) {
    this.packetListeners.push(cb);
  }

  public onConflict(cb: ConflictCallback) {
    this.conflictListeners.push(cb);
  }

  public onLog(cb: LogCallback) {
    this.logListeners.push(cb);
  }

  public getNode(nodeId: string): NodeStore | undefined {
    return this.nodes.get(nodeId);
  }

  public getAllNodes(): NodeStore[] {
    return Array.from(this.nodes.values());
  }

  public setNodeOnline(nodeId: string, isOnline: boolean) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.isOnline = isOnline;

    const action = isOnline ? 'ONLINE (LAN Reconnected)' : 'OFFLINE (Air-Gapped)';
    const log: SyncAuditLog = {
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      nodeId,
      action: 'HANDSHAKE',
      details: `${node.nodeName} transitioned to ${action}`,
    };
    node.auditLogs.unshift(log);
    this.notifyLog(log);

    // If reconnected, flush any queued mutations!
    if (isOnline) {
      this.syncQueuedFrames(nodeId);
    }
  }

  /**
   * Broadcasts a frame from sourceNode to all available peers on the local LAN.
   */
  public broadcastFrame(sourceNodeId: string, frame: SyncFrame, bytes: Uint8Array) {
    const sourceNode = this.nodes.get(sourceNodeId);
    if (!sourceNode || !sourceNode.isOnline) return;

    for (const [targetId, targetNode] of this.nodes.entries()) {
      if (targetId === sourceNodeId) continue;
      this.routePacket(sourceNodeId, targetId, frame, bytes);
    }
  }

  /**
   * Routes a packet between two nodes checking LAN partitions and offline status.
   */
  public routePacket(sourceId: string, targetId: string, frame: SyncFrame, bytes: Uint8Array) {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);

    if (!sourceNode || !targetNode) return;
    if (!sourceNode.isOnline) return;

    // Check Network Partition
    if (this.config.partitionEnabled) {
      const inA_source = this.config.partitionGroupA.includes(sourceId);
      const inA_target = this.config.partitionGroupA.includes(targetId);
      if (inA_source !== inA_target) {
        // Partitioned! Dropped at physical Wi-Fi layer
        return;
      }
    }

    // Packet Loss Simulation
    if (this.config.packetLossPct > 0 && Math.random() * 100 < this.config.packetLossPct) {
      return;
    }

    // If target is offline, it will receive the update when it reconnects via state vector handshake
    if (!targetNode.isOnline) {
      return;
    }

    const latency = Math.max(
      0.5,
      this.config.baseLatencyMs + (Math.random() * 2 - 1) * this.config.jitterMs
    );

    const now = Date.now();
    const packet: NetworkPacket = {
      id: `pkt_${now}_${Math.random().toString(36).substring(2, 7)}`,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      frame,
      bytes,
      sentAt: now,
      deliverAt: now + latency,
      sizeBytes: bytes.length,
      status: 'flying',
    };

    this.inFlightPackets.push(packet);
    this.notifyPacket(packet);

    // Schedule delivery
    setTimeout(() => {
      this.deliverPacket(packet.id);
    }, latency);
  }

  private deliverPacket(packetId: string) {
    const idx = this.inFlightPackets.findIndex((p) => p.id === packetId);
    if (idx === -1) return;

    const packet = this.inFlightPackets[idx];
    this.inFlightPackets.splice(idx, 1);
    packet.status = 'delivered';

    this.deliveredPacketsHistory.unshift(packet);
    if (this.deliveredPacketsHistory.length > 50) {
      this.deliveredPacketsHistory.pop();
    }

    const targetNode = this.nodes.get(packet.targetNodeId);
    if (targetNode && targetNode.isOnline) {
      const res = targetNode.receiveBinaryFrame(packet.bytes, packet.sourceNodeId);
      if (res.conflicts.length > 0) {
        for (const c of res.conflicts) {
          this.notifyConflict(c);
        }
      }
    }

    this.notifyPacket(packet);
  }

  /**
   * Flushes unsynced frames after an offline node comes back online on the LAN.
   */
  public syncQueuedFrames(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isOnline) return;

    const queued = [...node.unsyncedQueue];
    for (const item of queued) {
      this.broadcastFrame(nodeId, item.frame, item.bytes);
    }
    node.unsyncedQueue = [];
  }

  /**
   * Full two-way handshake & state exchange across all online peers
   */
  public performFullMeshSync() {
    for (const node of this.nodes.values()) {
      if (!node.isOnline) continue;
      const allObjects = node.getAllObjectsIncludingDeleted();
      for (const obj of allObjects) {
        // Resend updates to ensure all peers have complete state
        const wal = node.getWal().filter((w) => w.frame.header.objectId === obj.id);
        for (const w of wal) {
          this.broadcastFrame(node.nodeId, w.frame, w.bytes);
        }
      }
    }
  }

  private notifyPacket(p: NetworkPacket) {
    for (const cb of this.packetListeners) cb(p);
  }

  private notifyConflict(c: ConflictRecord) {
    for (const cb of this.conflictListeners) cb(c);
  }

  private notifyLog(l: SyncAuditLog) {
    for (const cb of this.logListeners) cb(l);
  }
}
