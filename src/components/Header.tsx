import React from 'react';
import { 
  Network, 
  Zap, 
  RotateCw, 
  Layers, 
  Split, 
  ShieldCheck, 
  DollarSign, 
  Smartphone,
  Gauge
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'cluster' | 'entities' | 'binary' | 'crdt' | 'benchmark' | 'guide';
  setActiveTab: (tab: 'cluster' | 'entities' | 'binary' | 'crdt' | 'benchmark' | 'guide') => void;
  onlineCount: number;
  totalNodes: number;
  isPartitioned: boolean;
  onTriggerSplitBrain: () => void;
  onTriggerStockConflict: () => void;
  onResyncAll: () => void;
  isConverged: boolean;
  totalSyncedFrames: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onlineCount,
  totalNodes,
  isPartitioned,
  onTriggerSplitBrain,
  onTriggerStockConflict,
  onResyncAll,
  isConverged,
  totalSyncedFrames,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Brand & Value Proposition */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Network className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>FreeBoxSync</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold uppercase tracking-wider">
                    Alternative 100% Gratuite
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>ObjectBox Sync LAN Engine</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-mono">WAL Binaire & CRDTs</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono">Latence &lt; 2ms</span>
              </p>
            </div>
          </div>

          {/* Quick Scenario Triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onTriggerStockConflict}
              className="px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 text-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Simuler deux modifications concurrentes de stock sur deux appareils hors-ligne"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Conflit Stock (PN-Counter)</span>
            </button>

            <button
              onClick={onTriggerSplitBrain}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm ${
                isPartitioned
                  ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Simuler une coupure Wi-Fi entre deux groupes d'appareils"
            >
              <Split className={`w-3.5 h-3.5 ${isPartitioned ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{isPartitioned ? 'Partition Active (Scindé)' : 'Partition LAN (Split)'}</span>
            </button>

            <button
              onClick={onResyncAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Forcer la réconciliation globale des nœuds LAN"
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Resync Mesh</span>
            </button>
          </div>

          {/* Cluster Status Badges */}
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5" title="Nœuds connectés au sous-réseau local">
              <span className={`w-2 h-2 rounded-full ${onlineCount === totalNodes ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300 font-mono font-medium">
                {onlineCount}/{totalNodes} <span className="text-slate-500">Nœuds LAN</span>
              </span>
            </div>

            <div className="w-px h-3 bg-slate-800" />

            <div className="flex items-center gap-1.5" title="État de cohérence forte (Strong Eventual Consistency)">
              <ShieldCheck className={`w-3.5 h-3.5 ${isConverged ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className={isConverged ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                {isConverged ? 'SEC Convergé' : 'Sync en cours'}
              </span>
            </div>

            <div className="w-px h-3 bg-slate-800" />

            <div className="text-slate-400 font-mono">
              <span className="text-cyan-400 font-semibold">{totalSyncedFrames}</span> trames
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-800/60 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('cluster')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'cluster'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Topologie LAN & Mesh P2P</span>
          </button>

          <button
            onClick={() => setActiveTab('entities')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'entities'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Base Objets & Éditeur Multi-Nœuds</span>
          </button>

          <button
            onClick={() => setActiveTab('binary')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'binary'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Inspecteur Binaire (Hex & Wire Protocol)</span>
          </button>

          <button
            onClick={() => setActiveTab('crdt')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'crdt'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Matrice CRDT & Horloges HLC</span>
          </button>

          <button
            onClick={() => setActiveTab('benchmark')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'benchmark'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Benchmark & Économie de Coûts</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Code Source Gratuit (Kotlin / Go / TS)</span>
          </button>
        </nav>

      </div>
    </header>
  );
};
