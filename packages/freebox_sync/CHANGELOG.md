## 1.0.0

* Initial release of FreeBoxSync for Flutter & Dart.
* Zero-copy binary wire protocol (`OBXS`) with 56-byte header.
* Hybrid Logical Clocks (HLC) for causal ordering across mobile devices.
* Field-level CRDTs (LWW, PN-Counter, OR-Set).
* Local LAN auto-discovery via mDNS / UDP broadcast on port 8443.
* P2P TCP streaming on port 8444 with sub-millisecond latency.
* Anti-echo loop protection for ObjectBox `DataObserver`.
