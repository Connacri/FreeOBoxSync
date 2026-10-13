import 'hlc.dart';

/// Conflict-free Replicated Data Types (CRDT) engine for FreeBoxSync.
class CrdtEngine {
  /// Evaluates Last-Write-Wins based on Hybrid Logical Clock.
  /// Returns true if the incoming remote value wins over the local one.
  static bool shouldRemoteWinLww({
    required HlcTimestamp localHlc,
    required HlcTimestamp remoteHlc,
  }) {
    return HybridLogicalClock.isNewer(remoteHlc, localHlc);
  }

  /// Merges two PN-Counters across replicas.
  /// Total = sum(positives) - sum(negatives)
  static int mergePNCounters({
    required Map<String, int> localPos,
    required Map<String, int> localNeg,
    required Map<String, int> remotePos,
    required Map<String, int> remoteNeg,
  }) {
    final allNodes = {...localPos.keys, ...remotePos.keys, ...localNeg.keys, ...remoteNeg.keys};
    int total = 0;

    for (final node in allNodes) {
      final p1 = localPos[node] ?? 0;
      final p2 = remotePos[node] ?? 0;
      final maxP = p1 > p2 ? p1 : p2;

      final n1 = localNeg[node] ?? 0;
      final n2 = remoteNeg[node] ?? 0;
      final maxN = n1 > n2 ? n1 : n2;

      total += (maxP - maxN);
    }

    return total;
  }
}
