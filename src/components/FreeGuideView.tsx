import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Smartphone, 
  Server, 
  Code2,
  DollarSign,
  ArrowRight,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  ARCHITECTURE_SPEC, 
  KOTLIN_ANDROID_CODE, 
  FLUTTER_DART_CODE,
  GO_LAN_HUB_CODE, 
  TYPESCRIPT_CLIENT_CODE 
} from '../engine/codeTemplates';

export const FreeGuideView: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<'pubdev' | 'flutter' | 'kotlin' | 'go' | 'ts' | 'spec'>('pubdev');
  const [copied, setCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const getCode = () => {
    switch (selectedLang) {
      case 'pubdev':
        return `# pubspec.yaml
name: mon_app_flutter
dependencies:
  flutter:
    sdk: flutter
  objectbox: ^4.0.0              # Base embarquée gratuite
  freebox_sync: ^1.0.0           # Bibliothèque de synchronisation LAN P2P gratuite

# Installation en ligne de commande :
# flutter pub add freebox_sync

# Code source complet du package disponible dans :
# /packages/freebox_sync/`;
      case 'flutter':
        return FLUTTER_DART_CODE;
      case 'kotlin':
        return KOTLIN_ANDROID_CODE;
      case 'go':
        return GO_LAN_HUB_CODE;
      case 'ts':
        return TYPESCRIPT_CLIENT_CODE;
      case 'spec':
      default:
        return ARCHITECTURE_SPEC.summary.trim();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('flutter pub add freebox_sync');
    setCommandCopied(true);
    setTimeout(() => setCommandCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Quick Pub.dev Install Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-500/30 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 font-bold font-mono text-xs">
            pub.dev
          </div>
          <div>
            <div className="text-white font-bold text-sm flex items-center gap-2">
              <span>Bibliothèque Flutter & Dart : freebox_sync v1.0.0</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                Prêt à publier
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Installez la synchronisation décentralisée P2P ObjectBox en une commande.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-xs text-cyan-300">
          <span>flutter pub add freebox_sync</span>
          <button
            onClick={handleCopyCommand}
            className="p-1 hover:text-white transition-colors"
            title="Copier la commande"
          >
            {commandCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Guide d'Intégration Directe dans vos Projets ObjectBox
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Utilisez la bibliothèque gratuite <strong className="text-slate-200">ObjectBox DB</strong> sur vos appareils (Android, Flutter, iOS, Go)
              et remplacez le serveur payant d'ObjectBox Sync par notre protocole binaire P2P décentralisé pour réseau local.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-2 transition-colors shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Code Copié !' : 'Copier le Code'}</span>
          </button>
        </div>
      </div>

      {/* Visual Pipeline of the Hook into ObjectBox */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Architecture du Pipeline : Comment brancher FreeBoxSync sur ObjectBox DB</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-mono">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-cyan-400 font-bold block text-[10px] uppercase">1. Écriture Locale</span>
            <div className="text-white font-semibold">box.put(entity)</div>
            <p className="text-slate-400 text-[11px] font-sans">Votre code métier écrit normalement dans ObjectBox.</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-indigo-400 font-bold block text-[10px] uppercase">2. Interception</span>
            <div className="text-white font-semibold">DataObserver</div>
            <p className="text-slate-400 text-[11px] font-sans">L'écouteur réactif ObjectBox capture l'objet modifié.</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-emerald-400 font-bold block text-[10px] uppercase">3. Trame Binaire</span>
            <div className="text-white font-semibold">56B OBXS + Deltas</div>
            <p className="text-slate-400 text-[11px] font-sans">Sérialisation sans JSON avec Horloge Hybride HLC.</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-amber-400 font-bold block text-[10px] uppercase">4. Transport LAN</span>
            <div className="text-white font-semibold">UDP / TCP Socket</div>
            <p className="text-slate-400 text-[11px] font-sans">Découverte mDNS sur :8443, diffusion &lt;2ms sur Wi-Fi.</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-purple-400 font-bold block text-[10px] uppercase">5. Fusion CRDT</span>
            <div className="text-white font-semibold">box.put(merged)</div>
            <p className="text-slate-400 text-[11px] font-sans">Fusion automatique sans conflit et mise à jour locale.</p>
          </div>
        </div>
      </div>

      {/* 5-Step Practical Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Étape 1 : Ajoutez 3 champs à vos classes d'entités</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Pour que la fusion CRDT fonctionne, chaque classe <code className="text-cyan-300 font-mono">@Entity</code> doit comporter ces 3 variables :
          </p>
          <div className="bg-slate-900 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 space-y-1">
            <div>var hlcTime: Long = 0L <span className="text-slate-500">// Timestamp physique ms</span></div>
            <div>var hlcCounter: Int = 0 <span className="text-slate-500">// Compteur logique</span></div>
            <div>var originNode: String = "" <span className="text-slate-500">// ID unique de l'appareil</span></div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <AlertCircle className="w-4 h-4" />
            <span>Étape 2 : Évitez la boucle de réplication (Anti-Echo)</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Lorsque votre application reçoit une mise à jour d'un autre téléphone et appelle <code className="text-cyan-300 font-mono">box.put()</code>, il ne faut pas la réémettre :
          </p>
          <div className="bg-slate-900 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 space-y-1">
            <div>var isApplyingRemote = false</div>
            <div><span className="text-slate-500">// Dans le listener :</span> if (isApplyingRemote) return</div>
            <div><span className="text-slate-500">// Dans la réception :</span> isApplyingRemote = true; box.put(); isApplyingRemote = false</div>
          </div>
        </div>
      </div>

      {/* Code Viewer Panel with Language Switcher */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Language Tabs */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedLang('pubdev')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedLang === 'pubdev'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-blue-300" />
              <span>Package pub.dev (Flutter)</span>
            </button>

            <button
              onClick={() => setSelectedLang('flutter')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedLang === 'flutter'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Code Flutter (freebox_sync.dart)</span>
            </button>

            <button
              onClick={() => setSelectedLang('kotlin')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedLang === 'kotlin'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android (Kotlin)</span>
            </button>

            <button
              onClick={() => setSelectedLang('go')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedLang === 'go'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Relais Go (Raspberry Pi / Hub)</span>
            </button>

            <button
              onClick={() => setSelectedLang('ts')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedLang === 'ts'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>TypeScript (Electron / Node)</span>
            </button>

            <button
              onClick={() => setSelectedLang('spec')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedLang === 'spec'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Résumé Architectural</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            {selectedLang === 'kotlin' ? 'FreeBoxSyncManager.kt' : selectedLang === 'flutter' ? 'freebox_sync.dart' : selectedLang === 'go' ? 'main.go' : selectedLang === 'ts' ? 'client.ts' : 'spec.md'}
          </span>
        </div>

        {/* Code Block */}
        <div className="p-4 overflow-x-auto max-h-[500px]">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed">
            <code>{getCode()}</code>
          </pre>
        </div>
      </div>

    </div>
  );
};
