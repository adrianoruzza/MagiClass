import React, { useState } from 'react';
import { X, Link2, Plus, Trash2, Check, ChevronLeft, AlertCircle, Info, Sparkles } from 'lucide-react';
import { Subject, LinkedSubjectGroup } from '../types';

interface LinkedSubjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  linkedGroups: LinkedSubjectGroup[];
  onSave: (groups: LinkedSubjectGroup[]) => void;
}

const LinkedSubjectsModal: React.FC<LinkedSubjectsModalProps> = ({
  isOpen,
  onClose,
  subjects,
  linkedGroups,
  onSave,
}) => {
  const [localGroups, setLocalGroups] = useState<LinkedSubjectGroup[]>(() =>
    JSON.parse(JSON.stringify(linkedGroups || []))
  );

  // New group creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  // Editing existing group name
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');

  // Dropdown for adding subject to existing group
  const [activeAddSubjectGroupId, setActiveAddSubjectGroupId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds(prev =>
      prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleCreateGroup = () => {
    if (selectedSubjectIds.length < 2) return;
    const newId = crypto.randomUUID();
    const defaultName = newGroupName.trim() || `Gruppo ${localGroups.length + 1}`;
    const newGroup: LinkedSubjectGroup = {
      id: newId,
      name: defaultName,
      subjectIds: selectedSubjectIds,
    };
    const updated = [...localGroups, newGroup];
    setLocalGroups(updated);
    onSave(updated);

    // Reset creation form
    setSelectedSubjectIds([]);
    setNewGroupName('');
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo collegamento tra materie? I compiti futuri si propagheranno solo alla stessa materia.')) {
      const updated = localGroups.filter(g => g.id !== groupId);
      setLocalGroups(updated);
      onSave(updated);
    }
  };

  const handleRemoveSubjectFromGroup = (groupId: string, subjectId: string) => {
    const updated = localGroups
      .map(g => {
        if (g.id !== groupId) return g;
        const newIds = g.subjectIds.filter(id => id !== subjectId);
        return { ...g, subjectIds: newIds };
      })
      .filter(g => g.subjectIds.length > 0); // Keep groups with at least 1, or remove if empty

    setLocalGroups(updated);
    onSave(updated);
  };

  const handleAddSubjectToGroup = (groupId: string, subjectId: string) => {
    const updated = localGroups.map(g => {
      if (g.id !== groupId) return g;
      if (g.subjectIds.includes(subjectId)) return g;
      return { ...g, subjectIds: [...g.subjectIds, subjectId] };
    });
    setLocalGroups(updated);
    onSave(updated);
    setActiveAddSubjectGroupId(null);
  };

  const handleStartEditingName = (group: LinkedSubjectGroup) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name || '');
  };

  const handleSaveGroupName = (groupId: string) => {
    if (!editGroupName.trim()) return;
    const updated = localGroups.map(g =>
      g.id === groupId ? { ...g, name: editGroupName.trim() } : g
    );
    setLocalGroups(updated);
    onSave(updated);
    setEditingGroupId(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-magi-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-magi-modal flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1"
            title="Torna indietro"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Link2 className="w-6 h-6 text-amber-400" />
              Materie Collegate (Stesso Docente)
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Propagazione automatica dei compiti tra le materie dello stesso insegnante
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative banner */}
        <div className="bg-amber-50/80 border-b border-amber-200 px-5 py-3 text-xs text-amber-900 flex items-start gap-2.5 shrink-0">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Come funziona: </span>
            I compiti non svolti assegnati in una classe si propagano alla <strong>prima lezione successiva della stessa classe</strong> che appartiene allo stesso gruppo di materie collegate. I nomi delle materie e gli orari rimangono distinti e invariati.
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Action button to open creator */}
          {!isCreatingGroup && (
            <button
              onClick={() => {
                setIsCreatingGroup(true);
                setSelectedSubjectIds([]);
                setNewGroupName(`Gruppo ${localGroups.length + 1}`);
              }}
              disabled={subjects.length < 2}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 text-sm magi-press"
            >
              <Plus className="w-4 h-4" />
              Collega nuove materie
            </button>
          )}

          {/* New Group Creator */}
          {isCreatingGroup && (
            <div className="bg-amber-50/60 p-4 rounded-xl border-2 border-amber-300 space-y-4 shadow-sm animate-magi-slide-down">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Crea nuovo gruppo di collegamento
                </span>
                <button
                  onClick={() => setIsCreatingGroup(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Annulla"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome del gruppo (opzionale):
                </label>
                <input
                  type="text"
                  placeholder="Es. Materie Tecniche (TTRG + Meccanica)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Seleziona almeno 2 materie da collegare tra loro:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {subjects.map(subj => {
                    const isSelected = selectedSubjectIds.includes(subj.id);
                    // Check if already in another group
                    const otherGroup = localGroups.find(
                      g => g.subjectIds && g.subjectIds.includes(subj.id)
                    );

                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => handleToggleSubjectSelection(subj.id)}
                        className={`p-2.5 rounded-lg border text-left text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-100 border-amber-500 text-amber-950 shadow-sm ring-2 ring-amber-400/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="truncate flex-1">
                          <span>{subj.name}</span>
                          {otherGroup && (
                            <span className="block text-[10px] text-amber-700 font-normal truncate">
                              (in: {otherGroup.name || 'Gruppo'})
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-white ${
                            isSelected ? 'bg-amber-600' : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 font-medium">
                  {selectedSubjectIds.length < 2 ? (
                    <span className="text-amber-700">Seleziona almeno 2 materie</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">
                      {selectedSubjectIds.length} materie selezionate
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCreatingGroup(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg font-bold"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={selectedSubjectIds.length < 2}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Crea collegamento
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List of Existing Groups */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Gruppi Collegati Attivi ({localGroups.length})
              </label>
            </div>

            {localGroups.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                <Link2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">Nessun collegamento creato</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Collega tra loro le materie che svolgi nella stessa classe per consentire la propagazione automatica dei compiti non svolti.
                </p>
              </div>
            ) : (
              localGroups.map((group, gIdx) => {
                const groupSubjects = subjects.filter(s => group.subjectIds.includes(s.id));
                const availableToAdd = subjects.filter(s => !group.subjectIds.includes(s.id));
                const hasFewerThanTwo = groupSubjects.length < 2;

                return (
                  <div
                    key={group.id}
                    className={`bg-white rounded-xl border p-4 space-y-3 shadow-sm transition-all ${
                      hasFewerThanTwo ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between gap-2">
                      {editingGroupId === group.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editGroupName}
                            onChange={e => setEditGroupName(e.target.value)}
                            className="p-1 px-2 border border-slate-300 rounded text-sm font-bold text-slate-800 flex-1 outline-none focus:ring-1 focus:ring-amber-500"
                            placeholder="Nome gruppo"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveGroupName(group.id)}
                            className="p-1.5 bg-amber-600 text-white rounded hover:bg-amber-700"
                            title="Salva"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                            title="Annulla"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <Link2 className="w-4 h-4 text-amber-600 shrink-0" />
                          <span
                            onClick={() => handleStartEditingName(group)}
                            className="font-bold text-slate-800 text-sm hover:text-amber-700 cursor-pointer flex items-center gap-1.5"
                            title="Clicca per rinominare il gruppo"
                          >
                            {group.name || `Gruppo ${gIdx + 1}`}
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                            {groupSubjects.length} {groupSubjects.length === 1 ? 'materia' : 'materie'}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina questo gruppo di collegamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Linked Subjects Chips */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {groupSubjects.map(subj => (
                        <span
                          key={subj.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-xs ${subj.colorStyles}`}
                        >
                          <span>{subj.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubjectFromGroup(group.id, subj.id)}
                            className="hover:bg-black/10 rounded-full p-0.5 text-slate-600 hover:text-red-700 transition-colors ml-0.5"
                            title={`Rimuovi ${subj.name} da questo gruppo`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      {/* Add subject button / dropdown */}
                      {availableToAdd.length > 0 && (
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveAddSubjectGroupId(
                                activeAddSubjectGroupId === group.id ? null : group.id
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                            title="Aggiungi un'altra materia a questo gruppo"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Aggiungi materia</span>
                          </button>

                          {activeAddSubjectGroupId === group.id && (
                            <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 animate-magi-slide-down">
                              <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                                Scegli materia da collegare:
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {availableToAdd.map(avail => (
                                  <button
                                    key={avail.id}
                                    type="button"
                                    onClick={() => handleAddSubjectToGroup(group.id, avail.id)}
                                    className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition-colors flex items-center justify-between"
                                  >
                                    <span>{avail.name}</span>
                                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {hasFewerThanTwo && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Aggiungi almeno un'altra materia per attivare il collegamento tra compiti.</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between">
          <span className="text-xs text-slate-400 italic">Modifiche salvate automaticamente</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-sm magi-press"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkedSubjectsModal;
