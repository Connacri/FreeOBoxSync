import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

typedef FrameReceivedCallback = void Function(Uint8List bytes, String peerAddress);

/// Handles local Wi-Fi / Ethernet mDNS UDP Discovery and TCP Peer-to-Peer streaming.
class LanTransport {
  final String nodeId;
  final int discoveryPort;
  final int tcpPort;
  final FrameReceivedCallback onFrameReceived;

  RawDatagramSocket? _udpSocket;
  ServerSocket? _tcpServer;
  final Map<String, Socket> _connectedPeers = {};
  Timer? _beaconTimer;
  bool _isDisposed = false;

  LanTransport({
    required this.nodeId,
    required this.onFrameReceived,
    this.discoveryPort = 8443,
    this.tcpPort = 8444,
  });

  /// Starts listening for UDP beacons and accepts incoming TCP connections.
  Future<void> start() async {
    // 1. Start TCP Server for direct binary stream (< 1ms latency)
    try {
      _tcpServer = await ServerSocket.bind(InternetAddress.anyIPv4, tcpPort);
      _tcpServer!.listen(_handleIncomingClient);
    } catch (e) {
      // Port might already be bound if multiple instances on same device
    }

    // 2. Start UDP Discovery Beacon Listener
    try {
      _udpSocket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, discoveryPort);
      _udpSocket!.broadcastEnabled = true;
      _udpSocket!.listen((event) {
        if (event == RawSocketEvent.read) {
          final dg = _udpSocket!.receive();
          if (dg != null) {
            _handleUdpPacket(dg);
          }
        }
      });

      // 3. Announce self every 3 seconds
      _beaconTimer = Timer.periodic(const Duration(seconds: 3), (_) {
        if (_isDisposed) return;
        _broadcastUdpBeacon();
      });
    } catch (_) {}
  }

  void _broadcastUdpBeacon() {
    try {
      final message = 'FREEBOX_PEER:$nodeId:$tcpPort';
      final data = Uint8List.fromList(message.codeUnits);
      _udpSocket?.send(data, InternetAddress('255.255.255.255'), discoveryPort);
    } catch (_) {}
  }

  void _handleUdpPacket(Datagram dg) {
    try {
      final msg = String.fromCharCodes(dg.data);
      if (msg.startsWith('FREEBOX_PEER:')) {
        final parts = msg.split(':');
        final peerNodeId = parts[1];
        final port = int.tryParse(parts[2]) ?? tcpPort;

        // Don't connect to ourselves
        if (peerNodeId != nodeId) {
          final peerIp = dg.address.address;
          _connectToPeer(peerIp, port);
        }
      }
    } catch (_) {}
  }

  Future<void> _connectToPeer(String ip, int port) async {
    if (_connectedPeers.containsKey(ip)) return;
    try {
      final socket = await Socket.connect(ip, port, timeout: const Duration(milliseconds: 1500));
      _connectedPeers[ip] = socket;
      _listenToSocket(socket, ip);
    } catch (_) {}
  }

  void _handleIncomingClient(Socket client) {
    final ip = client.remoteAddress.address;
    _connectedPeers[ip] = client;
    _listenToSocket(client, ip);
  }

  void _listenToSocket(Socket socket, String ip) {
    socket.listen(
      (data) {
        onFrameReceived(Uint8List.fromList(data), ip);
      },
      onError: (_) {
        _connectedPeers.remove(ip);
      },
      onDone: () {
        _connectedPeers.remove(ip);
      },
      cancelOnError: true,
    );
  }

  /// Broadcasts a binary frame to all currently connected peers on the LAN.
  void broadcastBinaryFrame(Uint8List frameBytes) {
    for (final peer in _connectedPeers.values) {
      try {
        peer.add(frameBytes);
      } catch (_) {}
    }
  }

  void dispose() {
    _isDisposed = true;
    _beaconTimer?.cancel();
    _udpSocket?.close();
    _tcpServer?.close();
    for (final socket in _connectedPeers.values) {
      socket.close();
    }
    _connectedPeers.clear();
  }
}
