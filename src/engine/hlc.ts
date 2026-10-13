/**
 * Hybrid Logical Clock (HLC) Implementation
 *
 * Guarantees monotonic causality even when physical clocks drift.
 * Used for deterministic Last-Write-Wins (LWW) and causal ordering in ObjectBox Sync.
 */

import { HLC } from '../types/sync';

export class HybridLogicalClock {
  private physical: number;
  private logical: number;
  private nodeId: string;

  constructor(nodeId: string, initialPhysical: number = Date.now()) {
    this.nodeId = nodeId;
    this.physical = initialPhysical;
    this.logical = 0;
  }

  /**
   * Generates a new timestamp for a local event (write / mutation).
   */
  public now(): HLC {
    const physicalNow = Date.now();
    if (physicalNow > this.physical) {
      this.physical = physicalNow;
      this.logical = 0;
    } else {
      this.logical += 1;
    }
    return {
      physical: this.physical,
      logical: this.logical,
      nodeId: this.nodeId,
    };
  }

  /**
   * Updates local clock upon receiving a remote message with timestamp `msgHLC`.
   * Guarantees that local clock jumps ahead of any received message.
   */
  public receive(msgHLC: HLC): HLC {
    const physicalNow = Date.now();
    const maxPhysical = Math.max(physicalNow, this.physical, msgHLC.physical);

    if (maxPhysical === this.physical && maxPhysical === msgHLC.physical) {
      this.logical = Math.max(this.logical, msgHLC.logical) + 1;
    } else if (maxPhysical === this.physical) {
      this.logical += 1;
    } else if (maxPhysical === msgHLC.physical) {
      this.logical = msgHLC.logical + 1;
    } else {
      this.logical = 0;
    }

    this.physical = maxPhysical;

    return {
      physical: this.physical,
      logical: this.logical,
      nodeId: this.nodeId,
    };
  }

  public getSnapshot(): HLC {
    return {
      physical: this.physical,
      logical: this.logical,
      nodeId: this.nodeId,
    };
  }

  /**
   * Total ordering comparison:
   * 1. Higher physical timestamp wins
   * 2. If equal, higher logical counter wins
   * 3. If equal, lexicographical nodeId comparison breaks tie deterministically
   */
  public static compare(a: HLC, b: HLC): number {
    if (a.physical !== b.physical) {
      return a.physical - b.physical;
    }
    if (a.logical !== b.logical) {
      return a.logical - b.logical;
    }
    return a.nodeId.localeCompare(b.nodeId);
  }

  public static isNewer(candidate: HLC, existing: HLC): boolean {
    return HybridLogicalClock.compare(candidate, existing) > 0;
  }

  public static format(hlc: HLC): string {
    const time = new Date(hlc.physical).toISOString().substring(11, 23);
    return `${time}.${hlc.logical.toString().padStart(3, '0')}@${hlc.nodeId.substring(0, 8)}`;
  }
}
