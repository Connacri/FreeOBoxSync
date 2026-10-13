/**
 * FreeBoxSync - Decentralized ObjectBox Sync Alternative
 * Local High-Performance LAN Object Database Replication & CRDT Engine
 */

import React, { useState, useEffect, useRef } from 'react';
import { NetworkMesh, NetworkConfig } from './engine/networkMesh';
import { SyncFrame, NetworkPacket, ConflictRecord, SyncAuditLog } from './types/sync';
import { Header } from './components/Header';
import { TopologyView } from './components/TopologyView';
import { EntityExplorer } from './components/EntityExplorer';
import { BinaryHexInspector } from './components/BinaryHexInspector';
import { CrdtStudio } from './components/CrdtStudio';
import { BenchmarkView } from './components/BenchmarkView';
import { FreeGuideView } from './components/FreeGuideView';
import { DEFAULT_SCHEMAS } from './engine/schemas';

export default function App() {
  const [activeTab, setActiveTab] = useState<'cluster' | 'entities' | 'binary' | 'crdt' | 'benchmark' | 'guide'>('cluster');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node_mobile');
  
  // Mesh instance ref
  const meshRef = useRef<NetworkMesh | null>(null);
  if (!meshRef.current) {
    meshRef.current = new NetworkMesh();
  }
  const mesh = meshRef.current;

  // React state triggers
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  const [inFlightPackets, setInFlightPackets] = useState<NetworkPacket[]>([]);
  const [recentPackets, setRecentPackets] = useState<NetworkPacket[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [currentFrame, setCurrentFrame] = useState<SyncFrame | null>(null);
  const [currentBytes, setCurrentBytes] = useState<Uint8Array | null>(null);
  const [recentFrames, setRecentFrames] = useState<Array<{ frame: SyncFrame; bytes: Uint8Array }>>([]);
  const [totalSyncedFrames, setTotalSyncedFrames] = useState<number>(0);
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>(mesh.config);

  // Initialize sample data on first mount
  useEffect(() => {
    // Populate initial items on mobile and replicate
    const mobile = mesh.getNode('node_mobile');
    if (mobile && mobile.getObjects().length === 0) {
      // 1. Warehouse Item
      const res1 = mobile.put(DEFAULT_SCHEMAS[0].id, 1001, {
        sku: 'WH-IOT-849',
        title: 'Capteur Température LoRaWAN',
        stockQty: { deltaPos: 120, deltaNeg: 0 },
        unitPrice: 149.50,
        inStock: true,
        tags: { op: 'add', element: 'IoT_Industriel' },
        lastInspected: new Date().toISOString(),
      });
      mesh.broadcastFrame(mobile.nodeId, res1.frame, res1.bytes);

      // 2. Patient Record
      const res2 = mobile.put(DEFAULT_SCHEMAS[1].id, 2001, {
        patientId: 'PAT-0092',
        fullName: 'Claire Renard',
        heartRateBpm: 72,
        oxygenSaturation: 98.6,
        allergies: { op: 'add', element: 'Pénicilline' },
        status: 'Stable',
        dosageAdministered: { deltaPos: 2, deltaNeg: 0 },
      });
      mesh.broadcastFrame(mobile.nodeId, res2.frame, res2.bytes);

      setCurrentFrame(res1.frame);
      setCurrentBytes(res1.bytes);
      setRecentFrames([{ frame: res1.frame, bytes: res1.bytes }, { frame: res2.frame, bytes: res2.bytes }]);
    }

    // Subscribe to mesh events
    mesh.onPacket((pkt) => {
      setInFlightPackets([...mesh.inFlightPackets]);
      setRecentPackets([...mesh.deliveredPacketsHistory]);
      setTotalSyncedFrames((prev) => prev + 1);
      rerender();
    });

    mesh.onConflict((c) => {
      setConflicts((prev) => [c, ...prev]);
      rerender();
    });

    mesh.onLog(() => {
      rerender();
    });
  }, []);

  // Handlers
  const handleToggleNodeOnline = (nodeId: string) => {
    const node = mesh.getNode(nodeId);
    if (!node) return;
    mesh.setNodeOnline(nodeId, !node.isOnline);
    rerender();
  };

  const handleUpdateConfig = (newCfg: Partial<NetworkConfig>) => {
    mesh.config = { ...mesh.config, ...newCfg };
    setNetworkConfig({ ...mesh.config });
    rerender();
  };

  const handleMutateObject = (
    nodeId: string,
    entityId: number,
    objectId: number,
    updates: Record<string, any>
  ) => {
    const node = mesh.getNode(nodeId);
    if (!node) return;

    const { frame, bytes } = node.put(entityId, objectId, updates);
    setCurrentFrame(frame);
    setCurrentBytes(bytes);
    setRecentFrames((prev) => [{ frame, bytes }, ...prev.slice(0, 15)]);

    if (node.isOnline) {
      mesh.broadcastFrame(nodeId, frame, bytes);
    }
    rerender();
  };

  const handleDeleteObject = (nodeId: string, entityId: number, objectId: number) => {
    const node = mesh.getNode(nodeId);
    if (!node) return;

    const { frame, bytes } = node.delete(entityId, objectId);
    setCurrentFrame(frame);
    setCurrentBytes(bytes);
    setRecentFrames((prev) => [{ frame, bytes }, ...prev.slice(0, 15)]);

    if (node.isOnline) {
      mesh.broadcastFrame(nodeId, frame, bytes);
    }
    rerender();
  };

  // Scenario 1: Concurrent Stock Conflict (PN-Counter)
  const handleTriggerStockConflict = () => {
    const mobile = mesh.getNode('node_mobile');
    const tablet = mesh.getNode('node_tablet');
    if (!mobile || !tablet) return;

    // 1. Take tablet temporarily offline
    mesh.setNodeOnline('node_tablet', false);

    // 2. Mobile updates stock +15
    const resMobile = mobile.put(101, 1001, {
      stockQty: { deltaPos: 15, deltaNeg: 0 },
      unitPrice: 155.00,
    });
    mesh.broadcastFrame('node_mobile', resMobile.frame, resMobile.bytes);

    // 3. Tablet concurrently updates stock -8 while offline
    tablet.put(101, 1001, {
      stockQty: { deltaPos: 0, deltaNeg: 8 },
      unitPrice: 148.00,
    });

    // 4. Reconnect tablet after 600ms
    setTimeout(() => {
      mesh.setNodeOnline('node_tablet', true);
      setActiveTab('crdt');
      rerender();
    }, 600);

    rerender();
  };

  // Scenario 2: Split-Brain Network Partition
  const handleTriggerSplitBrain = () => {
    const nextState = !mesh.config.partitionEnabled;
    mesh.config.partitionEnabled = nextState;
    setNetworkConfig({ ...mesh.config });

    if (!nextState) {
      // Healed partition, perform resync
      mesh.performFullMeshSync();
    }
    rerender();
  };

  // Resync all online nodes
  const handleResyncAll = () => {
    mesh.performFullMeshSync();
    rerender();
  };

  const handleSelectPacketForInspection = (pkt: NetworkPacket) => {
    setCurrentFrame(pkt.frame);
    setCurrentBytes(pkt.bytes);
    setActiveTab('binary');
  };

  const nodes = mesh.getAllNodes();
  const onlineCount = nodes.filter((n) => n.isOnline).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      
      {/* Top Header & Scenario Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onlineCount={onlineCount}
        totalNodes={nodes.length}
        isPartitioned={networkConfig.partitionEnabled}
        onTriggerSplitBrain={handleTriggerSplitBrain}
        onTriggerStockConflict={handleTriggerStockConflict}
        onResyncAll={handleResyncAll}
        isConverged={conflicts.length === 0 || inFlightPackets.length === 0}
        totalSyncedFrames={totalSyncedFrames}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'cluster' && (
          <TopologyView
            mesh={mesh}
            nodes={nodes}
            networkConfig={networkConfig}
            onUpdateConfig={handleUpdateConfig}
            onToggleNodeOnline={handleToggleNodeOnline}
            inFlightPackets={inFlightPackets}
            recentPackets={recentPackets}
            onSelectPacketForInspection={handleSelectPacketForInspection}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}

        {activeTab === 'entities' && (
          <EntityExplorer
            nodes={nodes}
            activeNodeId={selectedNodeId}
            onSelectActiveNode={setSelectedNodeId}
            onMutateObject={handleMutateObject}
            onDeleteObject={handleDeleteObject}
          />
        )}

        {activeTab === 'binary' && (
          <BinaryHexInspector
            currentFrame={currentFrame}
            currentBytes={currentBytes}
            recentFrames={recentFrames}
            onSelectFrame={(f, b) => {
              setCurrentFrame(f);
              setCurrentBytes(b);
            }}
          />
        )}

        {activeTab === 'crdt' && (
          <CrdtStudio
            conflicts={conflicts}
            nodes={nodes}
            onTriggerStockConflict={handleTriggerStockConflict}
            onClearConflicts={() => setConflicts([])}
          />
        )}

        {activeTab === 'benchmark' && <BenchmarkView />}

        {activeTab === 'guide' && <FreeGuideView />}
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FreeBoxSync Engine — Alternative Open Source & Gratuite à ObjectBox Sync</span>
          <span className="font-mono text-slate-500">OBXS Protocol v1.0 • Hybrid Logical Clocks • Zero-Copy WAL</span>
        </div>
      </footer>

    </div>
  );
}
