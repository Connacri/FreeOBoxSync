import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  Download, 
  HelpCircle, 
  Smartphone, 
  Server, 
  Code2,
  DollarSign,
  Cpu
} from 'lucide-react';
import { 
  ARCHITECTURE_SPEC, 
  KOTLIN_ANDROID_CODE, 
  GO_LAN_HUB_CODE, 
  TYPESCRIPT_CLIENT_CODE 
} from '../engine/codeTemplates';

export const FreeGuideView: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<'kotlin' | 'go' | 'ts' | 'spec'>('kotlin');
  const [copied, setCopied] = useState(false);

  const getCode = () => {
    switch (selectedLang) {
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

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Guide d'Ingénierie Inverse & Code Source Gratuit
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Comment reproduire ObjectBox Sync gratuitement dans vos applications Android, iOS, Go et Web sur un réseau local dédié.
              Copiez ces modules prêts pour la production.
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

      {/* Explanatory 3-step blueprint */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">1</span>
            <span>Base Embarquée Gratuite</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Conservez la bibliothèque embarquée open-source d'ObjectBox (<code className="text-slate-300 font-mono">io.objectbox:objectbox-android</code>) pour le stockage local ultra-rapide sur l'appareil. Elle est 100% gratuite.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">2</span>
            <span>Découverte LAN mDNS</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Au lieu d'un serveur cloud payant, les appareils envoient un paquet d'annonce UDP sur <code className="text-indigo-300 font-mono">255.255.255.255:8443</code>. En moins de 50ms, les pairs locaux s'interconnectent.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
            <span>Journal Binaire & CRDT</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Les trames binaires OBXS transmettent uniquement les deltas de propriétés modifiées avec horloges logiques hybrides (HLC) et compteurs PN-Counter sans aucun blocage.
          </p>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Language Tabs */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedLang('kotlin')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                selectedLang === 'go'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Relais LAN Hub (Go / Raspberry Pi)</span>
            </button>

            <button
              onClick={() => setSelectedLang('ts')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                selectedLang === 'ts'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>TypeScript (Web / Node)</span>
            </button>

            <button
              onClick={() => setSelectedLang('spec')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                selectedLang === 'spec'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Spécification Protocole</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            {selectedLang === 'kotlin' ? 'FreeBoxSyncClient.kt' : selectedLang === 'go' ? 'main.go' : selectedLang === 'ts' ? 'client.ts' : 'spec.md'}
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
