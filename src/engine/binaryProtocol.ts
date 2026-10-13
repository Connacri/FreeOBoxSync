/**
 * ObjectBox Sync Binary Wire Protocol
 * 
 * Implements low-overhead zero-copy binary serialization for transaction logs and replication packets.
 * Total binary frame header is 56 bytes, followed by packed delta payloads.
 */

import { SyncFrame, SyncFrameHeader, SyncOpCode, HLC } from '../types/sync';

export const OBX_MAGIC = 0x4F425853; // "OBXS" in ASCII
export const OBX_PROTOCOL_VERSION = 1;
export const HEADER_SIZE = 56;

// Adler-32 checksum calculation for fast verification on mobile chips
export function calculateAdler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD_ADLER = 65521;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Encodes a transaction frame into a raw binary buffer (Uint8Array).
 */
export function encodeSyncFrame(
  header: Omit<SyncFrameHeader, 'magic' | 'version' | 'payloadLength' | 'checksum'>,
  payload: Uint8Array
): { bytes: Uint8Array; frame: SyncFrame } {
  const payloadLen = payload.byteLength;
  const totalLength = HEADER_SIZE + payloadLen;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Magic 'OBXS'
  view.setUint32(0, OBX_MAGIC, false);
  // Version
  view.setUint8(4, OBX_PROTOCOL_VERSION);
  // Flags
  view.setUint8(5, header.flags);
  // Opcode
  view.setUint8(6, header.opCode);
  // Reserved padding
  view.setUint8(7, 0x00);

  // Node ID hash (8 bytes)
  const nodeHash = hashStringToBigInt(header.nodeId);
  view.setBigUint64(8, nodeHash, false);

  // Transaction ID (8 bytes)
  view.setBigUint64(16, BigInt(header.txId), false);

  // HLC Physical timestamp (8 bytes)
  view.setBigUint64(24, BigInt(header.hlc.physical), false);

  // HLC Logical sequence (4 bytes)
  view.setUint32(32, header.hlc.logical, false);

  // Entity ID (4 bytes)
  view.setUint32(36, header.entityId, false);

  // Object ID (8 bytes)
  view.setBigUint64(40, BigInt(header.objectId), false);

  // Delta Mask (4 bytes)
  view.setUint32(48, header.deltaMask, false);

  // Payload Length (4 bytes)
  view.setUint32(52, payloadLen, false);

  // Copy payload after header
  if (payloadLen > 0) {
    bytes.set(payload, HEADER_SIZE);
  }

  // Calculate Checksum over header (without checksum) + payload
  const checksum = calculateAdler32(bytes.subarray(0, totalLength));

  const completeHeader: SyncFrameHeader = {
    magic: OBX_MAGIC,
    version: OBX_PROTOCOL_VERSION,
    flags: header.flags,
    txId: header.txId,
    nodeId: header.nodeId,
    hlc: header.hlc,
    opCode: header.opCode,
    entityId: header.entityId,
    objectId: header.objectId,
    deltaMask: header.deltaMask,
    payloadLength: payloadLen,
    checksum,
  };

  return {
    bytes,
    frame: {
      header: completeHeader,
      payload,
    },
  };
}

/**
 * Decodes a binary buffer back into a structured SyncFrame.
 */
export function decodeSyncFrame(bytes: Uint8Array): SyncFrame {
  if (bytes.length < HEADER_SIZE) {
    throw new Error(`Buffer too short for ObjectBox Sync header: ${bytes.length} bytes`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, false);
  if (magic !== OBX_MAGIC) {
    throw new Error(`Invalid ObjectBox Sync magic header: 0x${magic.toString(16)}`);
  }

  const version = view.getUint8(4);
  const flags = view.getUint8(5);
  const opCode = view.getUint8(6) as SyncOpCode;
  // Node hash
  const nodeHash = view.getBigUint64(8, false);
  const txId = Number(view.getBigUint64(16, false));
  const hlcPhys = Number(view.getBigUint64(24, false));
  const hlcLogical = view.getUint32(32, false);
  const entityId = view.getUint32(36, false);
  const objectId = Number(view.getBigUint64(40, false));
  const deltaMask = view.getUint32(48, false);
  const payloadLength = view.getUint32(52, false);

  const checksum = calculateAdler32(bytes);

  const payload = bytes.subarray(HEADER_SIZE, HEADER_SIZE + payloadLength);

  const hlc: HLC = {
    physical: hlcPhys,
    logical: hlcLogical,
    nodeId: `node_${nodeHash.toString(16).substring(0, 6)}`,
  };

  const header: SyncFrameHeader = {
    magic,
    version,
    flags,
    txId,
    nodeId: hlc.nodeId,
    hlc,
    opCode,
    entityId,
    objectId,
    deltaMask,
    payloadLength,
    checksum,
  };

  return { header, payload };
}

/**
 * Compact binary TLV encoder for entity properties.
 */
export function encodeFieldDeltas(fields: { propId: number; type: string; value: any }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const textEncoder = new TextEncoder();

  for (const field of fields) {
    if (field.type === 'string') {
      const strBytes = textEncoder.encode(String(field.value ?? ''));
      const buf = new Uint8Array(4 + strBytes.length);
      const dv = new DataView(buf.buffer);
      dv.setUint16(0, field.propId, false); // Property ID
      dv.setUint8(2, 0x01);                 // Type: String
      dv.setUint8(3, strBytes.length);     // Length (up to 255 for simple TLV, or varint)
      buf.set(strBytes, 4);
      parts.push(buf);
    } else if (field.type === 'int32') {
      const buf = new Uint8Array(8);
      const dv = new DataView(buf.buffer);
      dv.setUint16(0, field.propId, false);
      dv.setUint8(2, 0x02); // Type: Int32
      dv.setUint8(3, 4);    // Length: 4 bytes
      dv.setInt32(4, Number(field.value ?? 0), false);
      parts.push(buf);
    } else if (field.type === 'float64') {
      const buf = new Uint8Array(12);
      const dv = new DataView(buf.buffer);
      dv.setUint16(0, field.propId, false);
      dv.setUint8(2, 0x03); // Type: Float64
      dv.setUint8(3, 8);    // Length: 8 bytes
      dv.setFloat64(4, Number(field.value ?? 0), false);
      parts.push(buf);
    } else if (field.type === 'boolean') {
      const buf = new Uint8Array(5);
      const dv = new DataView(buf.buffer);
      dv.setUint16(0, field.propId, false);
      dv.setUint8(2, 0x04); // Type: Boolean
      dv.setUint8(3, 1);    // Length: 1 byte
      dv.setUint8(4, field.value ? 1 : 0);
      parts.push(buf);
    } else if (field.type === 'pn_counter') {
      // Delta packing for PN counter: positive increment, negative decrement
      const buf = new Uint8Array(12);
      const dv = new DataView(buf.buffer);
      dv.setUint16(0, field.propId, false);
      dv.setUint8(2, 0x05); // Type: PN-Counter Delta
      dv.setUint8(3, 8);    // Length: 8 bytes
      dv.setInt32(4, Number(field.value?.deltaPos || 0), false);
      dv.setInt32(8, Number(field.value?.deltaNeg || 0), false);
      parts.push(buf);
    } else if (field.type === 'or_set') {
      // OR-Set element tag: [op (1 byte: 1=add, 2=remove)] [valLength (1 byte)] [val]
      const strVal = String(field.value?.element || '');
      const strBytes = textEncoder.encode(strVal);
      const buf = new Uint8Array(5 + strBytes.length);
      const dv = new DataView(buf.buffer);
      dv.setUint16(0, field.propId, false);
      dv.setUint8(2, 0x06); // Type: OR-Set Delta
      dv.setUint8(3, 1 + strBytes.length);
      dv.setUint8(4, field.value?.op === 'remove' ? 2 : 1);
      buf.set(strBytes, 5);
      parts.push(buf);
    }
  }

  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Decodes field values from a packed TLV payload.
 */
export function decodeFieldDeltas(payload: Uint8Array): Array<{ propId: number; typeId: number; value: any }> {
  const result: Array<{ propId: number; typeId: number; value: any }> = [];
  const textDecoder = new TextDecoder();
  let offset = 0;

  while (offset + 4 <= payload.length) {
    const view = new DataView(payload.buffer, payload.byteOffset + offset, payload.length - offset);
    const propId = view.getUint16(0, false);
    const typeId = view.getUint8(2);
    const length = view.getUint8(3);
    const valOffset = offset + 4;

    if (valOffset + length > payload.length) break;

    let value: any = null;
    if (typeId === 0x01) {
      value = textDecoder.decode(payload.subarray(valOffset, valOffset + length));
    } else if (typeId === 0x02) {
      value = view.getInt32(4, false);
    } else if (typeId === 0x03) {
      value = view.getFloat64(4, false);
    } else if (typeId === 0x04) {
      value = view.getUint8(4) === 1;
    } else if (typeId === 0x05) {
      value = {
        deltaPos: view.getInt32(4, false),
        deltaNeg: view.getInt32(8, false),
      };
    } else if (typeId === 0x06) {
      const op = view.getUint8(4) === 2 ? 'remove' : 'add';
      const el = textDecoder.decode(payload.subarray(valOffset + 1, valOffset + length));
      value = { op, element: el };
    }

    result.push({ propId, typeId, value });
    offset += 4 + length;
  }

  return result;
}

export interface ByteAnnotation {
  offset: number;
  length: number;
  field: string;
  category: 'magic' | 'header' | 'id' | 'hlc' | 'mask' | 'payload' | 'checksum';
  description: string;
}

export function getByteAnnotations(header: SyncFrameHeader, payloadLen: number): ByteAnnotation[] {
  return [
    { offset: 0, length: 4, field: 'MAGIC', category: 'magic', description: 'ObjectBox Sync Magic (0x4F425853 = "OBXS")' },
    { offset: 4, length: 1, field: 'VERSION', category: 'header', description: `Protocol Version (${header.version})` },
    { offset: 5, length: 1, field: 'FLAGS', category: 'header', description: `Flags (0x${header.flags.toString(16).padStart(2, '0')})` },
    { offset: 6, length: 1, field: 'OPCODE', category: 'header', description: `OpCode (0x${header.opCode.toString(16).padStart(2, '0')} = ${SyncOpCode[header.opCode] || 'OP'})` },
    { offset: 7, length: 1, field: 'RESERVED', category: 'header', description: 'Reserved alignment padding' },
    { offset: 8, length: 8, field: 'NODE_ID', category: 'id', description: `Replica Node Hash (${header.nodeId})` },
    { offset: 16, length: 8, field: 'TX_ID', category: 'id', description: `Transaction Monotonic Sequence #${header.txId}` },
    { offset: 24, length: 8, field: 'HLC_PHYS', category: 'hlc', description: `HLC Physical Milliseconds (${new Date(header.hlc.physical).toLocaleTimeString()})` },
    { offset: 32, length: 4, field: 'HLC_LOGICAL', category: 'hlc', description: `HLC Logical Counter (${header.hlc.logical})` },
    { offset: 36, length: 4, field: 'ENTITY_ID', category: 'id', description: `Entity Schema UID #${header.entityId}` },
    { offset: 40, length: 8, field: 'OBJECT_ID', category: 'id', description: `Object 64-bit ID #${header.objectId}` },
    { offset: 48, length: 4, field: 'DELTA_MASK', category: 'mask', description: `Field Delta Bitmask (0b${header.deltaMask.toString(2).padStart(8, '0')})` },
    { offset: 52, length: 4, field: 'PAYLOAD_LEN', category: 'header', description: `Packed Payload Size: ${payloadLen} bytes` },
    { offset: 56, length: payloadLen, field: 'TLV_PAYLOAD', category: 'payload', description: `Zero-copy serialized delta fields (${payloadLen} bytes)` },
  ];
}

/**
 * Format bytes into standard hex dump view with offset, hex bytes, and ASCII representation.
 */
export interface HexLine {
  offset: number;
  offsetHex: string;
  bytes: { hex: string; byte: number; offset: number }[];
  ascii: string;
}

export function formatHexDump(bytes: Uint8Array): HexLine[] {
  const lines: HexLine[] = [];
  const bytesPerLine = 16;

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const chunk = bytes.subarray(i, Math.min(i + bytesPerLine, bytes.length));
    const lineBytes: { hex: string; byte: number; offset: number }[] = [];
    let ascii = '';

    for (let j = 0; j < chunk.length; j++) {
      const b = chunk[j];
      lineBytes.push({
        hex: b.toString(16).padStart(2, '0').toUpperCase(),
        byte: b,
        offset: i + j,
      });
      ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
    }

    lines.push({
      offset: i,
      offsetHex: i.toString(16).padStart(4, '0').toUpperCase(),
      bytes: lineBytes,
      ascii,
    });
  }

  return lines;
}

function hashStringToBigInt(str: string): bigint {
  let hash = 0n;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5n) - hash) + BigInt(str.charCodeAt(i));
    hash = hash & 0xFFFFFFFFFFFFFFFFn; // keep 64-bit unsigned
  }
  return hash;
}
