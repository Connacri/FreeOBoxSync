import React from 'react';
import { 
  Smartphone, 
  Tablet, 
  Cpu, 
  Monitor, 
  Wifi, 
  WifiOff, 
  Clock, 
  Database, 
  Send, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  FileCode,
  ArrowRight
} from 'lucide-react';
import { NodeStore } from '../engine/nodeStore';
import { NetworkConfig, NetworkMesh } from '../engine/networkMesh';
import { NetworkPacket, SyncOpCode } from '../types/sync';
import { HybridLogicalClock } from '../engine/hlc';

interface TopologyViewProps {
  mesh: NetworkMesh;
  nodes: NodeStore[];
  networkConfig: NetworkConfig;
  onUpdateConfig: (config: Partial<NetworkConfig>) => void;
  onToggleNodeOnline: (nodeId: string) => void;
  inFlightPackets: NetworkPacket[];
  recentPackets: NetworkPacket[];
  onSelectPacketForInspection: (packet: NetworkPacket) => void;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export const TopologyView: React.FC<TopologyViewProps> = ({
  nodes,
  networkConfig,
  onUpdateConfig,
  onToggleNodeOnline,
  inFlightPackets,
  recentPackets,
  onSelectPacketForInspection,
  selectedNodeId,
  onSelectNode,
}) => {
  const getNodeIcon = (role: string) => {
    switch (role) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-cyan-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-indigo-400" />;
      case 'edge_gateway':
        return <Cpu className="w-5 h-5 text-emerald-400" />;
      case 'cloud_hub':
      default:
        return <Monitor className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner explaining Free LAN Architecture */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Radio className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Réseau Local Décentralisé (Local LAN Mesh & mDNS)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Contrairement à ObjectBox Sync qui requiert un serveur centralisé avec licence payante, 
              FreeBoxSync synchronise directement les appareils sur votre Wi-Fi / Ethernet local en peer-to-peer (P2P).
              Les trames binaires voyagent en sub-milliseconde avec zéro dépendance au cloud.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs">
            <div>
              <div className="text-slate-500">Sous-Réseau LAN</div>
              <div className="text-emerald-400 font-mono font-semibold">192.168.1.0/24</div>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <div className="text-slate-500">Port Découverte UDP</div>
              <div className="text-cyan-400 font-mono font-semibold">:8443 (mDNS)</div>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <div className="text-slate-500">Port Réplication TCP</div>
              <div className="text-indigo-400 font-mono font-semibold">:8444 (OBXS)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {nodes.map((node) => {
          const isSelected = node.nodeId === selectedNodeId;
          const isOnline = node.isOnline;
          const hlc = node.getHLC();
          const wal = node.getWal();
          const unsyncedCount = node.unsyncedQueue.length;

          // Check if in partition group
          const inGroupA = networkConfig.partitionEnabled && networkConfig.partitionGroupA.includes(node.nodeId);
          const inGroupB = networkConfig.partitionEnabled && networkConfig.partitionGroupB.includes(node.nodeId);

          return (
            <div
              key={node.nodeId}
              onClick={() => onSelectNode(node.nodeId)}
              className={`rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
              } ${!isOnline ? 'opacity-70 saturate-50' : ''}`}
            >
              {/* Partition indicator line */}
              {networkConfig.partitionEnabled && (
                <div 
                  className={`h-1 w-full ${inGroupA ? 'bg-cyan-500' : inGroupB ? 'bg-purple-500' : 'bg-slate-600'}`} 
                  title={`Groupe Partition ${inGroupA ? 'A (Wi-Fi 1)' : inGroupB ? 'B (Wi-Fi 2)' : 'Neutre'}`}
                />
              )}

              <div className="p-4 space-y-3">
                {/* Header: Node Name + IP + Status Toggle */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      {getNodeIcon(node.role)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <span>{node.nodeName}</span>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                            Actif
                          </span>
                        )}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">{node.ipAddress}</p>
                    </div>
                  </div>

                  {/* Online / Offline switch */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleNodeOnline(node.nodeId);
                    }}
                    className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      isOnline
                        ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/80'
                        : 'bg-rose-950/70 border-rose-600/50 text-rose-400 hover:bg-rose-900/80'
                    }`}
                    title={isOnline ? 'Déconnecter (Simuler mode hors-ligne)' : 'Reconnecter au LAN Wi-Fi'}
                  >
                    {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Status Badges */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Objets en Base</span>
                    <span className="text-white font-mono font-bold text-sm">
                      {node.getObjects().length}
                    </span>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">WAL Transactions</span>
                    <span className="text-indigo-400 font-mono font-bold text-sm">
                      {wal.length}
                    </span>
                  </div>
                </div>

                {/* Queue status */}
                <div className="bg-slate-900/60 border border-slate-800/70 rounded-lg p-2 text-xs flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-slate-500" />
                    <span>File Hors-Ligne:</span>
                  </span>
                  <span className={`font-mono font-semibold ${unsyncedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {unsyncedCount} en attente
                  </span>
                </div>

                {/* HLC Clock display */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>HLC:</span>
                  </span>
                  <span className="text-cyan-400 truncate max-w-[150px]">
                    {HybridLogicalClock.format(hlc)}
                  </span>
                </div>

                {/* Partition tag */}
                {networkConfig.partitionEnabled && (
                  <div className="text-[10px] text-center py-1 rounded bg-slate-900/80 border border-slate-800 font-mono">
                    Sous-Réseau: <span className={inGroupA ? 'text-cyan-400 font-bold' : 'text-purple-400 font-bold'}>
                      {inGroupA ? 'Wi-Fi-AP-Nord (Groupe A)' : inGroupB ? 'Wi-Fi-AP-Sud (Groupe B)' : 'Isolé'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Network Simulator Controls Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Network Link Tuning */}
        <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Paramètres du Réseau Local (Wi-Fi 6 / Gigabit)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Simulation temps-réel
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Latency slider */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Latence de Base</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {networkConfig.baseLatencyMs.toFixed(1)} ms
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="30"
                step="0.2"
                value={networkConfig.baseLatencyMs}
                onChange={(e) => onUpdateConfig({ baseLatencyMs: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.4ms (LAN)</span>
                <span>15ms (Wi-Fi)</span>
                <span>30ms</span>
              </div>
            </div>

            {/* Jitter */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Gigue (Jitter)</span>
                <span className="text-indigo-400 font-mono font-bold">
                  ±{networkConfig.jitterMs.toFixed(1)} ms
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={networkConfig.jitterMs}
                onChange={(e) => onUpdateConfig({ jitterMs: parseFloat(e.target.value) })}
                className="w-full accent-indigo-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0ms (Stable)</span>
                <span>2.5ms</span>
                <span>5ms (Instable)</span>
              </div>
            </div>

            {/* Packet Loss */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Perte de Paquets</span>
                <span className="text-amber-400 font-mono font-bold">
                  {networkConfig.packetLossPct}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={networkConfig.packetLossPct}
                onChange={(e) => onUpdateConfig({ packetLossPct: parseInt(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Parfait)</span>
                <span>10%</span>
                <span>20% (Dégradé)</span>
              </div>
            </div>
          </div>

          {/* Quick Wi-Fi Profiles */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Profils Réseau :</span>
            <button
              onClick={() => onUpdateConfig({ baseLatencyMs: 0.5, jitterMs: 0.2, packetLossPct: 0 })}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors"
            >
              Gigabit Ethernet (0.5ms)
            </button>
            <button
              onClick={() => onUpdateConfig({ baseLatencyMs: 1.8, jitterMs: 0.6, packetLossPct: 0 })}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/40 transition-colors"
            >
              Wi-Fi 6 Entreprise (1.8ms)
            </button>
            <button
              onClick={() => onUpdateConfig({ baseLatencyMs: 12.0, jitterMs: 3.5, packetLossPct: 5 })}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-800/40 transition-colors"
            >
              Entrepôt Faible Couverture (12ms / 5% perte)
            </button>
          </div>
        </div>

        {/* Right Col: Live In-Flight Packets & Stream */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Flux de Paquets LAN</span>
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {inFlightPackets.length} en transit
            </span>
          </div>

          {/* Packet feed list */}
          <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2 pr-1 font-mono text-xs">
            {recentPackets.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Aucun paquet en transit. Modifiez un objet dans l'onglet Éditeur pour émettre une trame binaire !
              </div>
            ) : (
              recentPackets.slice(0, 8).map((pkt) => {
                const opName = SyncOpCode[pkt.frame.header.opCode] || 'PUT';
                return (
                  <div
                    key={pkt.id}
                    onClick={() => onSelectPacketForInspection(pkt)}
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                          {opName}
                        </span>
                        <span className="text-slate-400">{pkt.sourceNodeId.replace('node_', '')}</span>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <span className="text-slate-300">{pkt.targetNodeId.replace('node_', '')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                        {pkt.frame.metadata?.description || `Objet #${pkt.frame.header.objectId}`}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-400 text-xs font-bold block">
                        {pkt.sizeBytes} B
                      </span>
                      <span className="text-[10px] text-slate-500 group-hover:text-indigo-400 transition-colors flex items-center gap-1 justify-end">
                        <FileCode className="w-3 h-3" />
                        <span>Inspecter</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
