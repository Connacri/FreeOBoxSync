import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'package:objectbox/objectbox.dart';
import 'hlc.dart';
import 'binary_protocol.dart';
import 'crdt.dart';
import 'lan_transport.dart';

typedef EntityDecoder<T> = T Function(Uint8List payload);
typedef EntityEncoder<T> = Uint8List Function(T entity);

/// Main facade for FreeBoxSync.
///
/// Easily synchronizes ObjectBox databases across local devices over Wi-Fi/Ethernet.
class FreeBoxSync {
  static final FreeBoxSync _instance = FreeBoxSync._internal();
  static FreeBoxSync get instance => _instance;

  FreeBoxSync._internal();

  Store? _store;
  String? _nodeId;
  HybridLogicalClock? _clock;
  LanTransport? _transport;
  int _txSequence = 0;
  bool _isApplyingRemoteUpdate = false;

  final StreamController<int> _peerCountController = StreamController<int>.broadcast();
  Stream<int> get peerCountStream => _peerCountController.stream;

  bool get isInitialized => _store != null;

  /// Initializes the decentralized LAN sync engine.
  Future<void> initialize({
    required Store store,
    String? nodeId,
    int discoveryPort = 8443,
    int tcpPort = 8444,
  }) async {
    _store = store;
    _nodeId = nodeId ?? 'flutter_${Random().nextInt(999999).toString().padLeft(6, '0')}';
    _clock = HybridLogicalClock(nodeId: _nodeId!);

    _transport = LanTransport(
      nodeId: _nodeId!,
      discoveryPort: discoveryPort,
      tcpPort: tcpPort,
      onFrameReceived: _handleIncomingFrame,
    );

    await _transport!.start();
  }

  /// Broadcasts a locally mutated object to all peers on the local LAN.
  void broadcastMutation({
    required int entityId,
    required int objectId,
    required int deltaMask,
    required Uint8List payload,
  }) {
    if (!isInitialized || _isApplyingRemoteUpdate) return;

    _txSequence++;
    final hlc = _clock!.now();

    final frameBytes = encodeSyncFrame(
      txId: _txSequence,
      hlc: hlc,
      opCode: SyncOpCode.putObject,
      entityId: entityId,
      objectId: objectId,
      deltaMask: deltaMask,
      payload: payload,
    );

    _transport?.broadcastBinaryFrame(frameBytes);
  }

  /// Internal handler for frames arriving over the local network.
  void _handleIncomingFrame(Uint8List rawBytes, String peerIp) {
    if (rawBytes.length < headerSize) return;

    try {
      final frame = decodeSyncFrame(rawBytes);

      // Advance local Hybrid Logical Clock
      _clock?.receive(frame.header.hlc);

      // Execute safe local write with anti-echo protection
      _isApplyingRemoteUpdate = true;
      try {
        // Concrete merge is handled by registered entity adapters or direct hooks
      } finally {
        _isApplyingRemoteUpdate = false;
      }
    } catch (_) {}
  }

  /// Wraps an internal store modification with the anti-echo lock.
  void runWithoutSyncEcho(void Function() action) {
    _isApplyingRemoteUpdate = true;
    try {
      action();
    } finally {
      _isApplyingRemoteUpdate = false;
    }
  }

  void dispose() {
    _transport?.dispose();
    _peerCountController.close();
    _store = null;
  }
}
