import React from 'react';
import { 
  ShieldCheck, 
  GitMerge, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Zap, 
  Layers, 
  Check, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { ConflictRecord, EntitySchema } from '../types/sync';
import { NodeStore } from '../engine/nodeStore';
import { HybridLogicalClock } from '../engine/hlc';
import { DEFAULT_SCHEMAS } from '../engine/schemas';

interface CrdtStudioProps {
  conflicts: ConflictRecord[];
  nodes: NodeStore[];
  onTriggerStockConflict: () => void;
  onClearConflicts: () => void;
}

export const CrdtStudio: React.FC<CrdtStudioProps> = ({
  conflicts,
  nodes,
  onTriggerStockConflict,
  onClearConflicts,
}) => {
  // Check convergence: compare alive objects across all online nodes
  const onlineNodes = nodes.filter((n) => n.isOnline);
  let isFullyConverged = true;
  let divergenceNotes: string[] = [];

  if (onlineNodes.length > 1) {
    const reference = onlineNodes[0];
    const refObjects = reference.getObjects();

    for (let i = 1; i < onlineNodes.length; i++) {
      const target = onlineNodes[i];
      const targetObjects = target.getObjects();

      if (refObjects.length !== targetObjects.length) {
        isFullyConverged = false;
        divergenceNotes.push(
          `${reference.nodeName} (${refObjects.length} obj) ≠ ${target.nodeName} (${targetObjects.length} obj)`
        );
        break;
      }

      for (const refObj of refObjects) {
        const targetObj = targetObjects.find((o) => o.id === refObj.id && o.entityId === refObj.entityId);
        if (!targetObj) {
          isFullyConverged = false;
          divergenceNotes.push(`Objet #${refObj.id} manquant sur ${target.nodeName}`);
          break;
        }

        // Compare field values
        for (const [k, v] of Object.entries(refObj.fields)) {
          const targetVal = targetObj.fields[k];
          if (!targetVal || JSON.stringify(targetVal.raw) !== JSON.stringify(v.raw)) {
            isFullyConverged = false;
            divergenceNotes.push(
              `Champ ${k} sur #${refObj.id}: ${reference.nodeName}(${v.raw}) ≠ ${target.nodeName}(${targetVal?.raw})`
            );
            break;
          }
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner explaining CRDT & HLC */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Moteur de Résolution CRDT & Cohérence Forte Éventuelle (SEC)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Dans un réseau local sans serveur de verrouillage (locks), les appareils écrivent de manière autonome en mode hors-ligne. 
              Les types de données répliqués sans conflit (CRDTs) garantissent que tous les nœuds convergent mathématiquement vers le même état exact.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onTriggerStockConflict}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simuler Conflit Concurrent</span>
            </button>
          </div>
        </div>
      </div>

      {/* SEC Convergence Validator Box */}
      <div className={`rounded-2xl border p-5 shadow-lg transition-all ${
        isFullyConverged
          ? 'bg-emerald-950/20 border-emerald-500/30'
          : 'bg-amber-950/20 border-amber-500/30'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isFullyConverged
                ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400'
                : 'bg-amber-900/40 border-amber-500/50 text-amber-400'
            }`}>
              {isFullyConverged ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Validation Formelle de Cohérence Forte (SEC)</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                  isFullyConverged ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isFullyConverged ? '100% Répliques Identiques' : 'Synchronisation en transit'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFullyConverged
                  ? `Tous les ${onlineNodes.length} appareils connectés sur le LAN partagent l'état bit-à-bit sans aucune divergence.`
                  : divergenceNotes[0] || 'Des trames binaires sont en cours de propagation.'}
              </p>
            </div>
          </div>

          {/* Mathematical CRDT Properties */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300" title="Commutativité : L'ordre de réception des paquets n'importe pas">
              <span className="text-emerald-400">✓</span> Commutativité
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300" title="Associativité : Le regroupement des fusions produit le même résultat">
              <span className="text-emerald-400">✓</span> Associativité
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300" title="Idempotence : Recevoir deux fois le même paquet n'altère pas les données">
              <span className="text-emerald-400">✓</span> Idempotence
            </div>
          </div>
        </div>
      </div>

      {/* Conflict History Timeline */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Journal d'Arbitrage et d'Audit des Conflits
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              {conflicts.length} événement(s)
            </span>
          </div>

          {conflicts.length > 0 && (
            <button
              onClick={onClearConflicts}
              className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Effacer l'historique</span>
            </button>
          )}
        </div>

        {conflicts.length === 0 ? (
          <div className="text-center py-10 text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto" />
            <p>Aucun conflit d'édition concurrent enregistré.</p>
            <p className="text-[11px] text-slate-600">
              Cliquez sur "Simuler Conflit Concurrent" ou modifiez un même objet depuis deux nœuds différents pour tester l'arbitrage.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conf) => (
              <div
                key={conf.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      conf.strategy === 'PN_COUNTER_MERGE'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : conf.strategy === 'OR_SET_UNION'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {conf.strategy}
                    </span>
                    <span className="text-white font-semibold">{conf.entityName} #{conf.objectId}</span>
                    <span className="text-slate-500">• Champ: <strong className="text-cyan-400 font-mono">{conf.fieldName}</strong></span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {new Date(conf.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Values comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div className="text-slate-400 font-semibold text-[10px] uppercase">
                      Valeur Locale Retenue / Fusionnée
                    </div>
                    <div className="text-emerald-400 font-bold text-sm">
                      {String(conf.winnerValue)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Nœud: {conf.winnerNode} • HLC: {HybridLogicalClock.format(conf.winnerHlc)}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
                    <div className="text-slate-400 font-semibold text-[10px] uppercase">
                      Valeur Concurrente / Rejetée
                    </div>
                    <div className="text-slate-300 text-sm">
                      {String(conf.loserValue)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Nœud: {conf.loserNode} • HLC: {HybridLogicalClock.format(conf.loserHlc)}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{conf.rationale}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
