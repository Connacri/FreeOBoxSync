import React, { useState } from 'react';
import { 
  Gauge, 
  Play, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp, 
  Cpu, 
  HardDrive, 
  Zap, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { runLiveBenchmark, BenchmarkResult } from '../engine/benchmark';

export const BenchmarkView: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>(() => runLiveBenchmark(500));
  const [deviceCount, setDeviceCount] = useState<number>(50);

  const handleRunBenchmark = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runLiveBenchmark(1000);
      setResults(res);
      setIsRunning(false);
    }, 400);
  };

  // ObjectBox Sync commercial estimation: typically around 15€ to 45€ per device/year or custom enterprise tier
  const objectBoxCommercialAnnualCost = deviceCount * 30; // 30€ / device / year

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Gauge className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Benchmark Réseau Local & Comparatif de Performance
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Mesurez l'empreinte réseau et le temps de sérialisation entre le journal de transactions binaire (FreeBoxSync)
              et les approches traditionnelles JSON/REST et SQLite.
            </p>
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Mesure en cours...' : 'Exécuter 1 000 Transactions'}</span>
          </button>
        </div>
      </div>

      {/* Cost Savings Calculator Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Calculateur d'Économie vs ObjectBox Sync Commercial
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              ObjectBox facture sa solution Sync au nombre d'appareils ou par abonnement mensuel par terminal. 
              Avec FreeBoxSync, vous déployez une réplication LAN décentralisée <strong className="text-emerald-400">100% gratuite</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Parc d'Appareils LAN :</span>
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  type="number"
                  min="5"
                  max="1000"
                  step="5"
                  value={deviceCount}
                  onChange={(e) => setDeviceCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-white text-center font-bold"
                />
                <span className="text-slate-400">appareils</span>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-800" />

            <div>
              <span className="text-slate-500 block text-[10px]">Économie Annuelle :</span>
              <span className="text-emerald-400 font-mono font-bold text-base">
                ~{objectBoxCommercialAnnualCost.toLocaleString()} € / an
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Results Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {results.map((res, idx) => {
          const isWinner = res.protocol.includes('FreeBoxSync');

          return (
            <div
              key={idx}
              className={`rounded-2xl border p-4 space-y-3 transition-all relative overflow-hidden ${
                isWinner
                  ? 'bg-slate-900 border-cyan-500/60 ring-2 ring-cyan-500/20 shadow-xl shadow-cyan-500/10'
                  : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              {isWinner && (
                <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-wider">
                  Recommandé & Le Plus Rapide
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>{res.protocol}</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{res.costLicense}</p>
              </div>

              {/* Metric 1: Wire Payload Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Taille Trame Réseau :</span>
                  <span className={`font-mono font-bold ${isWinner ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {res.wirePayloadBytes} octets
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isWinner ? 'bg-emerald-400' : 'bg-slate-600'}`}
                    style={{ width: `${Math.min(100, (res.wirePayloadBytes / 4096) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Metric 2: LAN Latency */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Latence Réseau Local :</span>
                  <span className={`font-mono font-bold ${isWinner ? 'text-cyan-400' : 'text-slate-300'}`}>
                    {res.lanSyncLatencyMs} ms
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isWinner ? 'bg-cyan-400' : 'bg-slate-600'}`}
                    style={{ width: `${Math.min(100, (res.lanSyncLatencyMs / 40) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Metric 3: Serialization Time */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Encode CPU :</span>
                  <span className="font-mono text-slate-300 font-semibold">{res.serializationTimeUs} µs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Débit Max :</span>
                  <span className={`font-mono font-bold ${isWinner ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {res.throughputOpsPerSec.toLocaleString()} tx/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CRDT Hors-Ligne :</span>
                  <span className="font-mono text-slate-300">
                    {res.supportsOfflineCRDT ? 'Oui (Natif)' : 'Non (Conflits manuels)'}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
