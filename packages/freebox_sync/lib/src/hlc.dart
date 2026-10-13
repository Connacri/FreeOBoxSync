/// Hybrid Logical Clock (HLC) implementation in Dart.
///
/// Combines physical wall-clock time with logical sequence counters
/// to provide monotonic total ordering across distributed peers.
class HybridLogicalClock {
  int physical;
  int logical;
  final String nodeId;

  HybridLogicalClock({
    required this.nodeId,
    int? initialPhysical,
    this.logical = 0,
  }) : physical = initialPhysical ?? DateTime.now().millisecondsSinceEpoch;

  /// Generates a new HLC timestamp for a local mutation.
  HlcTimestamp now() {
    final physicalNow = DateTime.now().millisecondsSinceEpoch;
    if (physicalNow > physical) {
      physical = physicalNow;
      logical = 0;
    } else {
      logical += 1;
    }
    return HlcTimestamp(physical: physical, logical: logical, nodeId: nodeId);
  }

  /// Updates local clock upon receiving a remote message.
  HlcTimestamp receive(HlcTimestamp remoteHlc) {
    final physicalNow = DateTime.now().millisecondsSinceEpoch;
    final maxPhysical = [physicalNow, physical, remoteHlc.physical].reduce((a, b) => a > b ? a : b);

    if (maxPhysical == physical && maxPhysical == remoteHlc.physical) {
      logical = (logical > remoteHlc.logical ? logical : remoteHlc.logical) + 1;
    } else if (maxPhysical == physical) {
      logical += 1;
    } else if (maxPhysical == remoteHlc.physical) {
      logical = remoteHlc.logical + 1;
    } else {
      logical = 0;
    }

    physical = maxPhysical;
    return HlcTimestamp(physical: physical, logical: logical, nodeId: nodeId);
  }

  /// Total ordering comparison:
  /// 1. Higher physical ms wins
  /// 2. If equal, higher logical counter wins
  /// 3. If equal, deterministic node ID tie-break
  static int compare(HlcTimestamp a, HlcTimestamp b) {
    if (a.physical != b.physical) {
      return a.physical.compareTo(b.physical);
    }
    if (a.logical != b.logical) {
      return a.logical.compareTo(b.logical);
    }
    return a.nodeId.compareTo(b.nodeId);
  }

  static bool isNewer(HlcTimestamp candidate, HlcTimestamp existing) {
    return compare(candidate, existing) > 0;
  }
}

class HlcTimestamp {
  final int physical;
  final int logical;
  final String nodeId;

  const HlcTimestamp({
    required this.physical,
    required this.logical,
    required this.nodeId,
  });

  @override
  String toString() {
    final date = DateTime.fromMillisecondsSinceEpoch(physical).toIso8601String().substring(11, 23);
    return '$date.$logical@$nodeId';
  }
}
