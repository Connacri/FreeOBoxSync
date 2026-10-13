/**
 * ObjectBox Sync & Decentralized CRDT Core Types
 */

export type PropertyType = 
  | 'string'
  | 'int32'
  | 'float64'
  | 'boolean'
  | 'pn_counter'
  | 'or_set'
  | 'datetime';

export interface PropertySchema {
  id: number;
  name: string;
  type: PropertyType;
  indexed?: boolean;
}

export interface EntitySchema {
  id: number;
  name: string;
  properties: PropertySchema[];
}

export interface HLC {
  physical: number; // millisecond timestamp
  logical: number;  // sequence counter
  nodeId: string;   // tie-breaker
}

export interface PNCounterState {
  positives: Record<string, number>; // nodeId -> positive increments
  negatives: Record<string, number>; // nodeId -> negative decrements
}

export interface ORSetElement {
  value: string;
  addedBy: string;
  addHLC: HLC;
  removed?: boolean;
  removeHLC?: HLC;
}

export interface FieldCRDTValue {
  type: PropertyType;
  raw: any;
  hlc: HLC;
  pnCounter?: PNCounterState;
  orSet?: ORSetElement[];
}

export interface SyncObject {
  id: number;
  entityId: number;
  fields: Record<string, FieldCRDTValue>;
  createdHLC: HLC;
  updatedHLC: HLC;
  deleted?: boolean;
  version: number;
}

export enum SyncOpCode {
  PUT_OBJECT = 0x01,
  DELETE_OBJECT = 0x02,
  TX_BATCH = 0x03,
  HANDSHAKE_REQ = 0x10,
  HANDSHAKE_ACK = 0x11,
  STATE_VECTOR_REQ = 0x20,
  STATE_VECTOR_ACK = 0x21,
  PING = 0x30,
  PONG = 0x31,
}

export interface SyncFrameHeader {
  magic: number;          // 0x4F425853 ("OBXS")
  version: number;        // 0x01
  flags: number;          // Bit 0: Delta, Bit 1: Snapshot, Bit 2: Compressed, Bit 3: HighPriority
  txId: number;           // Transaction monotonic ID
  nodeId: string;         // Source node ID (truncated to 8 bytes in binary)
  hlc: HLC;
  opCode: SyncOpCode;
  entityId: number;
  objectId: number;
  deltaMask: number;      // 32-bit field delta mask
  payloadLength: number;
  checksum: number;       // Adler-32 / CRC32
}

export interface SyncFrame {
  header: SyncFrameHeader;
  payload: Uint8Array;
  metadata?: {
    entityName: string;
    description: string;
    changedFields: string[];
    valuesSummary?: Record<string, any>;
  };
}

export interface NodeDevice {
  id: string;
  name: string;
  role: 'mobile' | 'tablet' | 'edge_gateway' | 'cloud_hub';
  os: 'Android 14' | 'iOS 18' | 'Linux ARM64' | 'Cloud VM';
  isOnline: boolean;
  batteryLevel?: number;
  storageUsageKb: number;
  latencyToHubMs: number;
  packetLossPct: number;
  hlc: HLC;
  versionVector: Record<string, number>; // nodeId -> last seen txId
  uncommittedTxCount: number;
  totalSyncedFrames: number;
}

export interface ConflictRecord {
  id: string;
  timestamp: number;
  entityName: string;
  objectId: number;
  fieldName: string;
  strategy: 'LWW_HLC' | 'PN_COUNTER_MERGE' | 'OR_SET_UNION' | 'TIE_BREAK_NODE';
  winnerNode: string;
  loserNode: string;
  winnerValue: any;
  loserValue: any;
  winnerHlc: HLC;
  loserHlc: HLC;
  rationale: string;
}

export interface NetworkPacket {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  frame: SyncFrame;
  bytes: Uint8Array;
  sentAt: number;
  deliverAt: number;
  sizeBytes: number;
  status: 'flying' | 'delivered' | 'dropped';
}

export interface SyncAuditLog {
  id: string;
  timestamp: number;
  nodeId: string;
  action: 'LOCAL_WRITE' | 'TX_EMITTED' | 'FRAME_RECEIVED' | 'CRDT_MERGED' | 'OFFLINE_QUEUED' | 'HANDSHAKE';
  details: string;
  frameId?: number;
  entityId?: number;
  objectId?: number;
}
