import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:freebox_sync/freebox_sync.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FreeBoxSyncExampleApp());
}

class FreeBoxSyncExampleApp extends StatefulWidget {
  const FreeBoxSyncExampleApp({super.key});

  @override
  State<FreeBoxSyncExampleApp> createState() => _FreeBoxSyncExampleAppState();
}

class _FreeBoxSyncExampleAppState extends State<FreeBoxSyncExampleApp> {
  int _counter = 0;
  final List<String> _syncLogs = [];

  @override
  void initState() {
    super.initState();
    _initSync();
  }

  void _initSync() {
    setState(() {
      _syncLogs.add('[FreeBoxSync] Prêt pour la synchronisation décentralisée P2P');
      _syncLogs.add('[Discovery] Écoute UDP broadcast sur le port 8443');
    });
  }

  void _incrementAndSync() {
    setState(() {
      _counter++;
      _syncLogs.insert(0, '[Local Mutation] Valeur incrémentée à $_counter -> Émission trame binaire OBXS (56 octets)');
    });

    // Émission binaire instantanée sur le réseau local
    FreeBoxSync.instance.broadcastMutation(
      entityId: 101,
      objectId: 1,
      deltaMask: 0x01,
      payload: Uint8List.fromList('counter:$_counter'.codeUnits),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        appBar: AppBar(
          title: const Text('FreeBoxSync Example'),
          backgroundColor: Colors.indigo,
        ),
        body: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                elevation: 3,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      const Text(
                        'Compteur Synchronisé (PN-Counter)',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '$_counter',
                        style: const TextStyle(fontSize: 42, fontWeight: FontWeight.bold, color: Colors.indigo),
                      ),
                      const SizedBox(height: 10),
                      ElevatedButton.icon(
                        onPressed: _incrementAndSync,
                        icon: const Icon(Icons.sync),
                        label: const Text('Incrémenter & Diffuser en Binaire'),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Journal des Événements Réseau Local :',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.grey.shade900,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.all(12),
                  child: ListView.builder(
                    itemCount: _syncLogs.length,
                    itemBuilder: (context, index) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          _syncLogs[index],
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.greenAccent),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
