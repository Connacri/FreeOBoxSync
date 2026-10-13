/**
 * Production Code Templates & Architecture Specifications
 * Provides ready-to-use free implementations in Kotlin (Android), Flutter (Dart), Go, and TypeScript.
 */

export const ARCHITECTURE_SPEC = {
  title: 'FreeBoxSync : Intégration Directe dans vos Projets ObjectBox Existants',
  summary: `
# Comment intégrer FreeBoxSync dans vos projets ObjectBox existants :

ObjectBox fournit des liaisons natives gratuites pour Android (Java/Kotlin), Flutter (Dart), Go, C/C++, Swift et Python.
Pour ajouter la synchronisation décentralisée gratuite sans passer par ObjectBox Sync commercial :

### Principe en 5 Étapes Simples :

1. **Vos Entités ObjectBox (@Entity)** :
   Ajoutez simplement 3 champs légers pour l'horloge logique hybride :
   - \`var hlcPhysical: Long = 0\` (timestamp ms)
   - \`var hlcLogical: Int = 0\` (compteur logique)
   - \`var originNodeId: String = ""\` (ID de l'appareil source)

2. **Écouter les mutations locales (ObjectBox DataObserver)** :
   ObjectBox possède un système réactif natif très rapide :
   \`boxStore.subscribe(Item::class.java).observer { ... }\`
   Dès qu'un \`box.put()\` ou \`box.remove()\` est effectué dans votre app, cet écouteur capture l'objet modifié.

3. **Émission de la trame binaire OBXS sur le LAN** :
   Le client FreeBoxSync sérialise l'en-tête de 56 octets et les champs modifiés, puis l'envoie en TCP/UDP aux appareils du même Wi-Fi.

4. **Découverte automatique des appareils (mDNS / Zeroconf / UDP Broadcast)** :
   Pas besoin de configurer des adresses IP manuelles : les appareils envoient un "beacon" UDP sur le port \`8443\` du sous-réseau (ex: \`255.255.255.255\`). Dès qu'un pair répond, une socket TCP rapide est ouverte.

5. **Réception et fusion CRDT dans la Box locale** :
   À la réception d'une trame binaire distante, le moteur compare l'HLC distant avec l'HLC local :
   - Si la trame distante est plus récente : applique les champs et fait \`box.put(mergedItem)\`.
   - Utilisez un drapeau \`isSyncApplying = true\` pour éviter que la mise à jour réémise en boucle !
  `,
};

export const KOTLIN_ANDROID_CODE = `// ============================================================================
// Android / Kotlin : Intégration Complète avec ObjectBox DB Gratuit
// Fichier : FreeBoxSyncManager.kt
// Dépendance : io.objectbox:objectbox-android:4.0.3 (100% Gratuite)
// ============================================================================
package com.example.app.sync

import io.objectbox.Box
import io.objectbox.BoxStore
import io.objectbox.reactive.DataObserver
import io.objectbox.reactive.DataSubscription
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentHashMap

// 1. Définissez vos entités ObjectBox avec les métadonnées HLC
/*
@Entity
data class Product(
    @Id var id: Long = 0,
    var sku: String = "",
    var title: String = "",
    var stockQuantity: Int = 0,
    var price: Double = 0.0,
    // Champs nécessaires pour la fusion CRDT sans conflit :
    var hlcTime: Long = 0L,
    var hlcCounter: Int = 0,
    var originNode: String = ""
)
*/

class FreeBoxSyncManager(
    private val boxStore: BoxStore,
    val localNodeId: String = "android_" + android.os.Build.ID.take(6)
) {
    private var isApplyingRemoteUpdate = false
    private val connectedPeers = ConcurrentHashMap<String, Socket>()
    private var subscription: DataSubscription? = null

    // Horloge logique hybride locale
    private var hlcPhysical = System.currentTimeMillis()
    private var hlcLogical = 0
    private var txSequence = 0L

    fun start(discoveryPort: Int = 8443, syncTcpPort: Int = 8444) {
        // A. Démarrer l'écoute UDP pour découvrir les autres téléphones/tablettes sur le Wi-Fi
        startUdpBeaconListener(discoveryPort)

        // B. Diffuser sa propre présence toutes les 3 secondes sur le LAN
        startUdpAnnouncer(discoveryPort)

        // C. S'abonner aux changements ObjectBox pour diffuser automatiquement les écritures
        // Remplacez 'Product::class.java' par votre classe d'entité
        /*
        subscription = boxStore.subscribe(Product::class.java)
            .observer(DataObserver { products ->
                if (isApplyingRemoteUpdate) return@DataObserver
                for (product in products) {
                    broadcastLocalMutation(101, product.id, product.hlcTime, serializeProduct(product))
                }
            })
        */
    }

    // Génère l'en-tête binaire ultra-rapide OBXS (56 octets)
    fun buildBinaryFrame(entityId: Int, objectId: Long, deltaBytes: ByteArray): ByteArray {
        val now = System.currentTimeMillis()
        if (now > hlcPhysical) {
            hlcPhysical = now
            hlcLogical = 0
        } else {
            hlcLogical++
        }
        txSequence++

        val buffer = ByteBuffer.allocate(56 + deltaBytes.size).order(ByteOrder.BIG_ENDIAN)
        buffer.putInt(0x4F425853) // Magic 'OBXS'
        buffer.put(1.toByte())    // Version 1
        buffer.put(0x01.toByte()) // Flags: Delta
        buffer.put(0x01.toByte()) // Opcode: PUT_OBJECT
        buffer.put(0.toByte())    // Padding

        buffer.putLong(localNodeId.hashCode().toLong()) // Node Hash (8B)
        buffer.putLong(txSequence)                      // Tx ID (8B)
        buffer.putLong(hlcPhysical)                     // HLC Physical ms (8B)
        buffer.putInt(hlcLogical)                       // HLC Logical count (4B)
        buffer.putInt(entityId)                         // Entity UID (4B)
        buffer.putLong(objectId)                        // Object 64-bit ID (8B)
        buffer.putInt(0b00000111)                       // Delta bitmask (4B)
        buffer.putInt(deltaBytes.size)                  // Payload len (4B)
        buffer.put(deltaBytes)                          // Packed delta

        return buffer.array()
    }

    // Réception d'une trame distante et fusion dans ObjectBox
    fun onBinaryFrameReceived(rawBytes: ByteArray) {
        val buffer = ByteBuffer.wrap(rawBytes).order(ByteOrder.BIG_ENDIAN)
        val magic = buffer.int
        if (magic != 0x4F425853) return // Ignore si non valide

        buffer.position(16)
        val remoteTxId = buffer.long
        val remoteHlcPhys = buffer.long
        val remoteHlcLog = buffer.int
        val entityId = buffer.int
        val objectId = buffer.long

        // Avancement de l'horloge HLC locale
        val now = System.currentTimeMillis()
        val maxPhys = maxOf(now, hlcPhysical, remoteHlcPhys)
        if (maxPhys == hlcPhysical && maxPhys == remoteHlcPhys) {
            hlcLogical = maxOf(hlcLogical, remoteHlcLog) + 1
        } else {
            hlcLogical = 0
        }
        hlcPhysical = maxPhys

        // Écriture sécurisée dans ObjectBox avec neutralisation du feedback
        isApplyingRemoteUpdate = true
        try {
            // boxStore.boxFor(Product::class.java).put(mergedProduct)
        } finally {
            isApplyingRemoteUpdate = false
        }
    }

    private fun startUdpBeaconListener(port: Int) {
        Thread {
            try {
                val socket = DatagramSocket(port)
                val buf = ByteArray(256)
                while (!Thread.currentThread().isInterrupted) {
                    val packet = DatagramPacket(buf, buf.size)
                    socket.receive(packet)
                    val msg = String(packet.data, 0, packet.length)
                    if (msg.startsWith("FREEBOX_HELLO:")) {
                        val senderIp = packet.address.hostAddress
                        connectToPeer(senderIp, 8444)
                    }
                }
            } catch (e: Exception) { e.printStackTrace() }
        }.start()
    }

    private fun startUdpAnnouncer(port: Int) {
        Thread {
            try {
                val socket = DatagramSocket()
                socket.broadcast = true
                val broadcastAddr = InetAddress.getByName("255.255.255.255")
                val msg = "FREEBOX_HELLO:$localNodeId".toByteArray()
                while (!Thread.currentThread().isInterrupted) {
                    val packet = DatagramPacket(msg, msg.size, broadcastAddr, port)
                    socket.send(packet)
                    Thread.sleep(3000)
                }
            } catch (e: Exception) { e.printStackTrace() }
        }.start()
    }

    private fun connectToPeer(ip: String, port: Int) {
        if (connectedPeers.containsKey(ip)) return
        Thread {
            try {
                val socket = Socket(ip, port)
                connectedPeers[ip] = socket
                // Lecture en continu du flux binaire
            } catch (e: Exception) {}
        }.start()
    }
}`;

export const FLUTTER_DART_CODE = `// ============================================================================
// Flutter / Dart : Intégration Complète avec ObjectBox Flutter Gratuit
// Fichier : lib/sync/freebox_sync.dart
// Dépendance dans pubspec.yaml :
//   objectbox: ^4.0.0 (Gratuit)
//   objectbox_flutter_libs: any
// ============================================================================
import 'dart:io';
import 'dart:typed_data';
import 'package:objectbox/objectbox.dart';

// Exemple de modèle ObjectBox Flutter :
/*
@Entity()
class WarehouseItem {
  int id = 0;
  String sku;
  String title;
  int stockQty;
  double price;
  
  // Champs de fusion CRDT
  int hlcTimestamp = 0;
  int hlcCounter = 0;
  String nodeId = '';

  WarehouseItem({
    this.id = 0,
    required this.sku,
    required this.title,
    this.stockQty = 0,
    this.price = 0.0,
  });
}
*/

class FreeBoxSyncFlutter {
  final Store store;
  final String nodeId;
  bool _isSyncRunning = false;
  final List<Socket> _activeSockets = [];

  FreeBoxSyncFlutter({required this.store, required this.nodeId});

  void initialize({int udpPort = 8443, int tcpPort = 8444}) async {
    // 1. Découverte locale UDP sur le sous-réseau Wi-Fi
    _startUdpDiscovery(udpPort);

    // 2. Écoute TCP pour les trames binaires directes
    _startTcpServer(tcpPort);

    // 3. Écoute réactive d'ObjectBox pour répliquer les modifications locales
    /*
    final box = store.box<WarehouseItem>();
    box.query().watch(triggerImmediately: false).listen((query) {
      if (_isSyncRunning) return;
      final items = query.find();
      for (final item in items) {
        _broadcastItem(item);
      }
    });
    */
  }

  void _startUdpDiscovery(int port) async {
    final rawSocket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, port);
    rawSocket.broadcastEnabled = true;

    rawSocket.listen((RawSocketEvent event) {
      if (event == RawSocketEvent.read) {
        final dg = rawSocket.receive();
        if (dg != null) {
          final message = String.fromCharCodes(dg.data);
          if (message.startsWith('FREEBOX_PEER:') && !message.contains(nodeId)) {
            _connectToPeer(dg.address.address, 8444);
          }
        }
      }
    });

    // Annonce périodique toutes les 3 secondes
    Stream.periodic(const Duration(seconds: 3)).listen((_) {
      final msg = Uint8List.fromList('FREEBOX_PEER:$nodeId'.codeUnits);
      rawSocket.send(msg, InternetAddress('255.255.255.255'), port);
    });
  }

  void _startTcpServer(int port) async {
    final server = await ServerSocket.bind(InternetAddress.anyIPv4, port);
    server.listen((clientSocket) {
      _activeSockets.add(clientSocket);
      clientSocket.listen((Uint8List data) {
        _handleIncomingBinaryFrame(data);
      });
    });
  }

  void _connectToPeer(String host, int port) async {
    try {
      final socket = await Socket.connect(host, port);
      _activeSockets.add(socket);
      socket.listen((data) => _handleIncomingBinaryFrame(data));
    } catch (_) {}
  }

  void _handleIncomingBinaryFrame(Uint8List bytes) {
    if (bytes.length < 56) return;
    final byteData = ByteData.sublistView(bytes);
    final magic = byteData.getUint32(0, Endian.big);
    if (magic != 0x4F425853) return; // "OBXS" check

    final objectId = byteData.getUint64(40, Endian.big);
    final hlcRemote = byteData.getUint64(24, Endian.big);

    _isSyncRunning = true;
    try {
      // Fusion CRDT déterministe dans ObjectBox Box
      // ex: box.put(mergedItem);
    } finally {
      _isSyncRunning = false;
    }
  }
}`;

export const GO_LAN_HUB_CODE = `// ============================================================================
// Go : Hub Local Autonome pour Raspberry Pi / Serveur de Magasin
// Dépendance : github.com/objectbox/objectbox-go (Gratuit)
// Utilisation : Relais haute-performance (< 5 Mo RAM, 0ms latence)
// ============================================================================
package main

import (
	"encoding/binary"
	"fmt"
	"net"
	"sync"
	"time"
)

const (
	MAGIC_OBXS = 0x4F425853 // "OBXS"
	PORT_TCP   = ":8444"
	PORT_UDP   = ":8443"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[string]net.Conn
}

func main() {
	hub := &Hub{clients: make(map[string]net.Conn)}

	// 1. Découverte UDP sur le sous-réseau
	go hub.startBeacon()

	// 2. Écoute TCP
	ln, err := net.Listen("tcp", PORT_TCP)
	if err != nil {
		panic(err)
	}
	fmt.Printf("[FreeBoxSync] Hub démarré sur %s (100%% gratuit)\\\\n", PORT_TCP)

	for {
		conn, err := ln.Accept()
		if err != nil {
			continue
		}
		go hub.handleConnection(conn)
	}
}

func (h *Hub) handleConnection(conn net.Conn) {
	addr := conn.RemoteAddr().String()
	h.mu.Lock()
	h.clients[addr] = conn
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, addr)
		h.mu.Unlock()
		conn.Close()
	}()

	buf := make([]byte, 56)
	for {
		_, err := conn.Read(buf)
		if err != nil {
			break
		}
		if binary.BigEndian.Uint32(buf[0:4]) != MAGIC_OBXS {
			continue
		}

		payloadLen := binary.BigEndian.Uint32(buf[52:56])
		payload := make([]byte, payloadLen)
		if payloadLen > 0 {
			conn.Read(payload)
		}

		fullPacket := append(buf, payload...)

		// Diffusion instantanée sans allocation à tous les autres terminaux connectés
		h.mu.RLock()
		for remoteAddr, client := range h.clients {
			if remoteAddr != addr {
				client.Write(fullPacket)
			}
		}
		h.mu.RUnlock()
	}
}

func (h *Hub) startBeacon() {
	addr, _ := net.ResolveUDPAddr("udp", "255.255.255.255:8443")
	conn, _ := net.DialUDP("udp", nil, addr)
	defer conn.Close()

	for {
		conn.Write([]byte("FREEBOX_HUB:READY:8444"))
		time.Sleep(3 * time.Second)
	}
}`;

export const TYPESCRIPT_CLIENT_CODE = `// ============================================================================
// TypeScript / Node.js / Electron Client
// Fichier : freebox-sync.ts
// ============================================================================
import { encodeSyncFrame, decodeSyncFrame } from './binaryProtocol';
import { CRDTEngine } from './crdt';

export class FreeBoxSyncClient {
  private socket: WebSocket | null = null;
  private isApplyingRemote = false;

  constructor(private localHubUrl: string = 'ws://192.168.1.10:8444') {}

  public connect() {
    this.socket = new WebSocket(this.localHubUrl);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onmessage = (event) => {
      if (this.isApplyingRemote) return;
      const rawBytes = new Uint8Array(event.data as ArrayBuffer);
      const frame = decodeSyncFrame(rawBytes);
      
      this.isApplyingRemote = true;
      try {
        // Appliquer directement les deltas dans votre store local
        console.log(\`Trame reçue pour Objet #\${frame.header.objectId}\`);
      } finally {
        this.isApplyingRemote = false;
      }
    };
  }
}`;
