import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Tag, 
  TrendingUp, 
  TrendingDown, 
  Smartphone, 
  CheckCircle, 
  Clock, 
  Edit3, 
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { NodeStore } from '../engine/nodeStore';
import { SyncObject, EntitySchema, FieldCRDTValue } from '../types/sync';
import { DEFAULT_SCHEMAS } from '../engine/schemas';
import { HybridLogicalClock } from '../engine/hlc';

interface EntityExplorerProps {
  nodes: NodeStore[];
  activeNodeId: string;
  onSelectActiveNode: (nodeId: string) => void;
  onMutateObject: (nodeId: string, entityId: number, objectId: number, updates: Record<string, any>) => void;
  onDeleteObject: (nodeId: string, entityId: number, objectId: number) => void;
}

export const EntityExplorer: React.FC<EntityExplorerProps> = ({
  nodes,
  activeNodeId,
  onSelectActiveNode,
  onMutateObject,
  onDeleteObject,
}) => {
  const [selectedSchemaId, setSelectedSchemaId] = useState<number>(DEFAULT_SCHEMAS[0].id);
  const [editingObjectId, setEditingObjectId] = useState<number | null>(null);
  const [newTagInput, setNewTagInput] = useState<{ [objId: number]: string }>({});

  const activeNode = nodes.find((n) => n.nodeId === activeNodeId) || nodes[0];
  const activeSchema = DEFAULT_SCHEMAS.find((s) => s.id === selectedSchemaId) || DEFAULT_SCHEMAS[0];
  const objects = activeNode.getObjects(activeSchema.id);

  // Helper to create a new object
  const handleCreateNewObject = () => {
    const nextId = Math.floor(1000 + Math.random() * 9000);
    let initialValues: Record<string, any> = {};

    if (activeSchema.id === 101) {
      initialValues = {
        sku: `SKU-${nextId}`,
        title: `Capteur Industriel #${nextId}`,
        stockQty: { deltaPos: 50, deltaNeg: 0 },
        unitPrice: 79.90,
        inStock: true,
        tags: { op: 'add', element: 'Stock_Principal' },
        lastInspected: new Date().toISOString(),
      };
    } else if (activeSchema.id === 102) {
      initialValues = {
        patientId: `PAT-${nextId}`,
        fullName: `Patient #${nextId}`,
        heartRateBpm: 74,
        oxygenSaturation: 98.5,
        allergies: { op: 'add', element: 'Pénicilline' },
        status: 'Stable',
        dosageAdministered: { deltaPos: 1, deltaNeg: 0 },
      };
    } else {
      initialValues = {
        taskCode: `TSK-${nextId}`,
        description: `Maintenance pompe #${nextId}`,
        assignedTechnician: 'Technicien A',
        isCompleted: false,
        laborHours: 2.5,
        checkpoints: { op: 'add', element: 'Contrôle_Pression' },
      };
    }

    onMutateObject(activeNode.nodeId, activeSchema.id, nextId, initialValues);
  };

  return (
    <div className="space-y-6">
      
      {/* Node Switcher & Schema Selector */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Active Node Picker */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Appareil en cours d'édition sur le LAN :</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {nodes.map((node) => {
                const isActive = node.nodeId === activeNodeId;
                return (
                  <button
                    key={node.nodeId}
                    onClick={() => onSelectActiveNode(node.nodeId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                        : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${node.isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span>{node.nodeName}</span>
                    <span className="font-mono text-[10px] opacity-70">({node.ipAddress})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs flex items-center gap-3">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="text-slate-300">
              Modifiez un champ ici : l'écriture génère un <span className="text-cyan-400 font-semibold font-mono">WAL binaire</span> diffusé en &lt;2ms aux autres appareils connectés !
            </div>
          </div>

        </div>

        {/* Schema Selector Tabs */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium mr-2">Entité Objet :</span>
            {DEFAULT_SCHEMAS.map((schema) => {
              const isSelected = schema.id === selectedSchemaId;
              return (
                <button
                  key={schema.id}
                  onClick={() => setSelectedSchemaId(schema.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {schema.name}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCreateNewObject}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer {activeSchema.name}</span>
          </button>
        </div>
      </div>

      {/* Objects Grid */}
      {objects.length === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">Aucun objet dans cette table locale</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cliquez sur "Créer {activeSchema.name}" pour insérer un premier objet. 
            Il sera immédiatement sérialisé en binaire et répliqué sur le réseau local.
          </p>
          <button
            onClick={handleCreateNewObject}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un premier objet</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {objects.map((obj) => {
            const hlcFormatted = HybridLogicalClock.format(obj.updatedHLC);
            const tagInputVal = newTagInput[obj.id] || '';

            return (
              <div
                key={obj.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 transition-all shadow-md"
              >
                {/* Object Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">
                          {obj.fields.title?.raw || obj.fields.fullName?.raw || obj.fields.taskCode?.raw || `Objet #${obj.id}`}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          ID: #{obj.id}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>HLC: {hlcFormatted}</span>
                        <span className="text-slate-700">•</span>
                        <span>Rev v{obj.version}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteObject(activeNode.nodeId, activeSchema.id, obj.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Supprimer (tombstone CRDT)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Specific Fields depending on Schema */}
                <div className="space-y-3 pt-2 border-t border-slate-800/60 text-xs">
                  
                  {/* PN-COUNTER FIELD (Stock or Dosage) */}
                  {(obj.fields.stockQty || obj.fields.dosageAdministered) && (
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>
                            {obj.fields.stockQty ? 'Quantité Stock' : 'Dosage'} 
                            <span className="ml-1 text-[10px] text-cyan-400 font-mono">(CRDT PN-Counter)</span>
                          </span>
                        </span>
                        <span className="text-base font-mono font-bold text-white bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                          {obj.fields.stockQty?.raw ?? obj.fields.dosageAdministered?.raw ?? 0}
                        </span>
                      </div>

                      {/* Interactive increment/decrement buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            const fieldKey = obj.fields.stockQty ? 'stockQty' : 'dosageAdministered';
                            onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                              [fieldKey]: { deltaPos: 1, deltaNeg: 0 },
                            });
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span>+1</span>
                        </button>

                        <button
                          onClick={() => {
                            const fieldKey = obj.fields.stockQty ? 'stockQty' : 'dosageAdministered';
                            onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                              [fieldKey]: { deltaPos: 5, deltaNeg: 0 },
                            });
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span>+5</span>
                        </button>

                        <button
                          onClick={() => {
                            const fieldKey = obj.fields.stockQty ? 'stockQty' : 'dosageAdministered';
                            onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                              [fieldKey]: { deltaPos: 0, deltaNeg: 1 },
                            });
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          <span>-1</span>
                        </button>

                        <button
                          onClick={() => {
                            const fieldKey = obj.fields.stockQty ? 'stockQty' : 'dosageAdministered';
                            onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                              [fieldKey]: { deltaPos: 0, deltaNeg: 5 },
                            });
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          <span>-5</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OR-SET FIELD (Tags / Categories / Allergies) */}
                  {(obj.fields.tags || obj.fields.allergies || obj.fields.checkpoints) && (
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-400" />
                          <span>
                            {obj.fields.tags ? 'Tags Catégories' : obj.fields.allergies ? 'Allergies' : 'Points de Contrôle'}
                            <span className="ml-1 text-[10px] text-indigo-400 font-mono">(CRDT OR-Set)</span>
                          </span>
                        </span>
                      </div>

                      {/* Tag badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {((obj.fields.tags?.raw || obj.fields.allergies?.raw || obj.fields.checkpoints?.raw) as string[] || []).map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono group"
                          >
                            <span>{t}</span>
                            <button
                              onClick={() => {
                                const fieldKey = obj.fields.tags ? 'tags' : obj.fields.allergies ? 'allergies' : 'checkpoints';
                                onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                                  [fieldKey]: { op: 'remove', element: t },
                                });
                              }}
                              className="text-slate-500 hover:text-rose-400 transition-colors"
                              title="Retirer (Remove-Tag)"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Add Tag input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Ajouter un tag..."
                          value={tagInputVal}
                          onChange={(e) => setNewTagInput({ ...newTagInput, [obj.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tagInputVal.trim()) {
                              const fieldKey = obj.fields.tags ? 'tags' : obj.fields.allergies ? 'allergies' : 'checkpoints';
                              onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                                [fieldKey]: { op: 'add', element: tagInputVal.trim() },
                              });
                              setNewTagInput({ ...newTagInput, [obj.id]: '' });
                            }
                          }}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        <button
                          onClick={() => {
                            if (tagInputVal.trim()) {
                              const fieldKey = obj.fields.tags ? 'tags' : obj.fields.allergies ? 'allergies' : 'checkpoints';
                              onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, {
                                [fieldKey]: { op: 'add', element: tagInputVal.trim() },
                              });
                              setNewTagInput({ ...newTagInput, [obj.id]: '' });
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LWW SCALAR FIELDS (Title / Price / Status) */}
                  <div className="grid grid-cols-2 gap-2">
                    {obj.fields.unitPrice !== undefined && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Prix Unitaire (LWW)</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-white font-mono font-bold">{Number(obj.fields.unitPrice.raw).toFixed(2)} €</span>
                          <button
                            onClick={() => {
                              const newPrice = Math.round((Number(obj.fields.unitPrice.raw) + (Math.random() * 10 - 5)) * 100) / 100;
                              onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, { unitPrice: newPrice });
                            }}
                            className="text-[10px] text-cyan-400 hover:underline font-mono"
                          >
                            Éditer
                          </button>
                        </div>
                      </div>
                    )}

                    {obj.fields.status !== undefined && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Statut Patient (LWW)</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-white font-mono font-bold">{String(obj.fields.status.raw)}</span>
                          <button
                            onClick={() => {
                              const nextStatus = obj.fields.status.raw === 'Stable' ? 'Critique' : 'Stable';
                              onMutateObject(activeNode.nodeId, activeSchema.id, obj.id, { status: nextStatus });
                            }}
                            className="text-[10px] text-cyan-400 hover:underline font-mono"
                          >
                            Basculer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
