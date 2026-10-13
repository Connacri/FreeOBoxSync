import 'dart:convert';
import 'dart:typed_data';
import 'hlc.dart';

const int obxMagic = 0x4F425853; // "OBXS" in ASCII
const int obxProtocolVersion = 1;
const int headerSize = 56;

enum SyncOpCode {
  putObject(0x01),
  deleteObject(0x02),
  txBatch(0x03),
  handshakeReq(0x10),
  handshakeAck(0x11),
  ping(0x30),
  pong(0x31);

  final int value;
  const SyncOpCode(this.value);

  static SyncOpCode fromValue(int val) {
    return SyncOpCode.values.firstWhere(
      (e) => e.value == val,
      orElse: () => SyncOpCode.putObject,
    );
  }
}

class SyncHeader {
  final int magic;
  final int version;
  final int flags;
  final SyncOpCode opCode;
  final int txId;
  final HlcTimestamp hlc;
  final int entityId;
  final int objectId;
  final int deltaMask;
  final int payloadLength;
  final int checksum;

  const SyncHeader({
    required this.magic,
    required this.version,
    required this.flags,
    required this.opCode,
    required this.txId,
    required this.hlc,
    required this.entityId,
    required this.objectId,
    required this.deltaMask,
    required this.payloadLength,
    required this.checksum,
  });
}

class BinaryFrame {
  final SyncHeader header;
  final Uint8List payload;

  const BinaryFrame({required this.header, required this.payload});
}

/// Computes Adler-32 checksum
int calculateAdler32(Uint8List data) {
  int a = 1;
  int b = 0;
  const modAdler = 65521;
  for (int i = 0; i < data.length; i++) {
    a = (a + data[i]) % modAdler;
    b = (b + a) % modAdler;
  }
  return ((b << 16) | a) & 0xFFFFFFFF;
}

/// Encodes an object transaction into a 56-byte header + binary delta payload.
Uint8List encodeSyncFrame({
  required int txId,
  required HlcTimestamp hlc,
  required SyncOpCode opCode,
  required int entityId,
  required int objectId,
  required int deltaMask,
  required Uint8List payload,
}) {
  final totalLength = headerSize + payload.length;
  final bytes = Uint8List(totalLength);
  final byteData = ByteData.sublistView(bytes);

  // Magic 'OBXS'
  byteData.setUint32(0, obxMagic, Endian.big);
  // Version
  byteData.setUint8(4, obxProtocolVersion);
  // Flags: 0x01 = Delta
  byteData.setUint8(5, 0x01);
  // Opcode
  byteData.setUint8(6, opCode.value);
  // Reserved padding
  byteData.setUint8(7, 0x00);

  // Node ID Hash (8 bytes)
  final nodeHash = hlc.nodeId.hashCode;
  byteData.setInt64(8, nodeHash, Endian.big);

  // Transaction ID (8 bytes)
  byteData.setInt64(16, txId, Endian.big);

  // HLC Physical timestamp (8 bytes)
  byteData.setInt64(24, hlc.physical, Endian.big);

  // HLC Logical sequence (4 bytes)
  byteData.setUint32(32, hlc.logical, Endian.big);

  // Entity ID (4 bytes)
  byteData.setUint32(36, entityId, Endian.big);

  // Object ID (8 bytes)
  byteData.setInt64(40, objectId, Endian.big);

  // Delta Mask (4 bytes)
  byteData.setUint32(48, deltaMask, Endian.big);

  // Payload Length (4 bytes)
  byteData.setUint32(52, payload.length, Endian.big);

  // Copy payload after header
  if (payload.isNotEmpty) {
    bytes.setRange(headerSize, totalLength, payload);
  }

  return bytes;
}

/// Decodes binary bytes back into a BinaryFrame
BinaryFrame decodeSyncFrame(Uint8List bytes) {
  if (bytes.length < headerSize) {
    throw FormatException('Trame binaire trop courte: ${bytes.length} octets');
  }

  final byteData = ByteData.sublistView(bytes);
  final magic = byteData.getUint32(0, Endian.big);
  if (magic != obxMagic) {
    throw FormatException('Header Magic non valide: 0x${magic.toRadixString(16)}');
  }

  final version = byteData.getUint8(4);
  final flags = byteData.getUint8(5);
  final opCode = SyncOpCode.fromValue(byteData.getUint8(6));
  final nodeHash = byteData.getInt64(8, Endian.big);
  final txId = byteData.getInt64(16, Endian.big);
  final hlcPhys = byteData.getInt64(24, Endian.big);
  final hlcLog = byteData.getUint32(32, Endian.big);
  final entityId = byteData.getUint32(36, Endian.big);
  final objectId = byteData.getInt64(40, Endian.big);
  final deltaMask = byteData.getUint32(48, Endian.big);
  final payloadLength = byteData.getUint32(52, Endian.big);

  final hlc = HlcTimestamp(
    physical: hlcPhys,
    logical: hlcLog,
    nodeId: 'peer_${nodeHash.toRadixString(16).padLeft(6, '0')}',
  );

  final checksum = calculateAdler32(bytes);
  final payload = bytes.sublist(headerSize, headerSize + payloadLength);

  final header = SyncHeader(
    magic: magic,
    version: version,
    flags: flags,
    opCode: opCode,
    txId: txId,
    hlc: hlc,
    entityId: entityId,
    objectId: objectId,
    deltaMask: deltaMask,
    payloadLength: payloadLength,
    checksum: checksum,
  );

  return BinaryFrame(header: header, payload: payload);
}
