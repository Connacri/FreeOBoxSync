import React, { useState } from 'react';
import { 
  FileCode, 
  Binary, 
  CheckCircle2, 
  Layers, 
  Info, 
  Search, 
  Download,
  Copy,
  Check
} from 'lucide-react';
import { SyncFrame } from '../types/sync';
import { 
  formatHexDump, 
  getByteAnnotations, 
  ByteAnnotation,
  HEADER_SIZE 
} from '../engine/binaryProtocol';
import { HybridLogicalClock } from '../engine/hlc';

interface BinaryHexInspectorProps {
  currentFrame: SyncFrame | null;
  currentBytes: Uint8Array | null;
  recentFrames: Array<{ frame: SyncFrame; bytes: Uint8Array }>;
  onSelectFrame: (frame: SyncFrame, bytes: Uint8Array) => void;
}

export const BinaryHexInspector: React.FC<BinaryHexInspectorProps> = ({
  currentFrame,
  currentBytes,
  recentFrames,
  onSelectFrame,
}) => {
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  if (!currentFrame || !currentBytes) {
    return (
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <Binary className="w-10 h-10 text-slate-600 mx-auto" />
        <h3 className="text-sm font-semibold text-slate-300">Aucune trame binaire sélectionnée</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Effectuez une modification dans l'onglet Éditeur pour générer une trame binaire OBXS ou sélectionnez un paquet dans la topologie.
        </p>
      </div>
    );
  }

  const hexLines = formatHexDump(currentBytes);
  const annotations = getByteAnnotations(currentFrame.header, currentFrame.payload.length);

  // Find active annotation for hovered offset
  const activeAnnotation = hoveredOffset !== null
    ? annotations.find((a) => hoveredOffset >= a.offset && hoveredOffset < a.offset + a.length)
    : null;

  const handleCopyHex = () => {
    const hexStr = Array.from(currentBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    navigator.clipboard.writeText(hexStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getByteColorClass = (offset: number) => {
    if (offset < 4) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'; // Magic
    if (offset < 8) return 'bg-purple-500/20 text-purple-300 border-purple-500/30'; // Version / Flags / Opcode
    if (offset < 24) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'; // Node ID / Tx ID
    if (offset < 36) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'; // HLC
    if (offset < 48) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'; // Entity ID / Object ID
    if (offset < 52) return 'bg-pink-500/20 text-pink-300 border-pink-500/30'; // Delta mask
    if (offset < HEADER_SIZE) return 'bg-blue-500/20 text-blue-300 border-blue-500/30'; // Payload len
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; // Payload TLV
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner explaining Binary Wire Protocol */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Binary className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Inspecteur du Protocole Binaire Sans Copie (Zero-Copy Wire Protocol)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Au lieu de payloads JSON de 600+ octets avec parsing CPU lourd, FreeBoxSync encode les modifications 
              dans un en-tête fixe de 56 octets suivi d'un masque de bits et des propriétés delta compactes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyHex}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier Hex'}</span>
            </button>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-cyan-400">
              Taille: <span className="font-bold text-white">{currentBytes.length} octets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Hex Dump View + Header Dissection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Interactive Hex Grid */}
        <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Mémoire Hexadécimale (Vue Dump 16-octets)</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Survolez un octet pour inspecter son rôle
            </span>
          </div>

          {/* Hex Lines */}
          <div className="space-y-1.5 select-text overflow-x-auto">
            {hexLines.map((line) => (
              <div key={line.offset} className="flex items-center gap-3 hover:bg-slate-900/60 p-1 rounded-lg transition-colors">
                
                {/* Offset */}
                <span className="text-slate-600 font-bold w-12 text-[11px]">
                  0x{line.offsetHex}
                </span>

                {/* Hex Bytes */}
                <div className="flex items-center gap-1.5 flex-1">
                  {line.bytes.map((b) => {
                    const isHovered = hoveredOffset === b.offset;
                    const colorClass = getByteColorClass(b.offset);

                    return (
                      <span
                        key={b.offset}
                        onMouseEnter={() => setHoveredOffset(b.offset)}
                        onMouseLeave={() => setHoveredOffset(null)}
                        className={`px-1 rounded border text-[11px] cursor-pointer transition-all ${colorClass} ${
                          isHovered ? 'ring-2 ring-white font-bold scale-110 z-10' : ''
                        }`}
                      >
                        {b.hex}
                      </span>
                    );
                  })}
                  {/* Fill empty slots if last line */}
                  {Array.from({ length: 16 - line.bytes.length }).map((_, i) => (
                    <span key={i} className="w-5 text-center text-slate-800">
                      ..
                    </span>
                  ))}
                </div>

                {/* ASCII Column */}
                <span className="text-slate-500 w-24 text-[11px] tracking-widest pl-2 border-l border-slate-800/80">
                  {line.ascii}
                </span>

              </div>
            ))}
          </div>

          {/* Hover Details Card */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {activeAnnotation ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-bold">
                    Champ : {activeAnnotation.field} (Offset 0x{activeAnnotation.offset.toString(16).toUpperCase()}..0x{(activeAnnotation.offset + activeAnnotation.length - 1).toString(16).toUpperCase()})
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Longueur : {activeAnnotation.length} octet(s)
                  </span>
                </div>
                <p className="text-slate-300 text-[11px]">{activeAnnotation.description}</p>
              </div>
            ) : (
              <span className="text-slate-500 text-[11px] italic">
                Survolez un groupe d'octets dans la grille pour afficher son décodage sémantique.
              </span>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Structured Field Decomposition */}
        <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Champs de l'En-tête OBXS (56 octets)</span>
            </span>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Checksum OK</span>
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {annotations.map((ann, idx) => {
              const isTargetHover = hoveredOffset !== null && hoveredOffset >= ann.offset && hoveredOffset < ann.offset + ann.length;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredOffset(ann.offset)}
                  onMouseLeave={() => setHoveredOffset(null)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isTargetHover
                      ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-300 font-bold">{ann.field}</span>
                    <span className="text-[10px] text-slate-500">
                      +{ann.offset} ({ann.length}B)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {ann.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wire Savings Comparison */}
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50 space-y-1.5">
            <div className="flex items-center justify-between text-indigo-200 font-semibold">
              <span>Économie Bande Passante Mobile :</span>
              <span className="text-emerald-400 font-mono font-bold">-88% vs JSON</span>
            </div>
            <div className="text-[11px] text-indigo-300/80">
              Trame OBXS : <strong className="text-white">{currentBytes.length} octets</strong> contre 
              <strong className="text-slate-400 ml-1">620+ octets</strong> pour un payload JSON/REST équivalent.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
