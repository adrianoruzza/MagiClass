
import React, { useState, useEffect } from 'react';
import { X, BookOpen, Plus, Trash2, Palette, School, Pencil, Check, CheckCircle2, Circle, ChevronLeft, Users, Link2 } from 'lucide-react';
import { Subject, ClassEntity, LinkedSubjectGroup } from '../types';
import { SUBJECT_COLOR_PRESETS } from '../constants';
import StudentListModal from './StudentListModal';
import LinkedSubjectsModal from './LinkedSubjectsModal';
import { getOtherLinkedSubjectNames } from '../utils/subjectLinks';

interface SubjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  subjects: Subject[];
  onSave: (subjects: Subject[]) => void;
  classes: ClassEntity[];
  onSaveClasses: (classes: ClassEntity[]) => void;
  linkedSubjectGroups?: LinkedSubjectGroup[];
  onSaveLinkedSubjectGroups?: (groups: LinkedSubjectGroup[]) => void;
}

const SubjectManagerModal: React.FC<SubjectManagerModalProps> = ({
  isOpen,
  onClose,
  onBack,
  subjects,
  onSave,
  classes,
  onSaveClasses,
  linkedSubjectGroups = [],
  onSaveLinkedSubjectGroups,
}) => {
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(JSON.parse(JSON.stringify(subjects)));
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SUBJECT_COLOR_PRESETS[0].value);

  const [localClasses, setLocalClasses] = useState<ClassEntity[]>(JSON.parse(JSON.stringify(classes)));
  const [newClassName, setNewClassName] = useState('');
  const [newClassColor, setNewClassColor] = useState(SUBJECT_COLOR_PRESETS[0].value);

  // --- LINKED SUBJECTS STATE & MODAL ---
  const [localLinkedGroups, setLocalLinkedGroups] = useState<LinkedSubjectGroup[]>(
    JSON.parse(JSON.stringify(linkedSubjectGroups || []))
  );
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  useEffect(() => {
    if (linkedSubjectGroups) {
      setLocalLinkedGroups(JSON.parse(JSON.stringify(linkedSubjectGroups)));
    }
  }, [linkedSubjectGroups]);

  // --- STUDENT LIST MODAL STATE ---
  const [isStudentListOpen, setIsStudentListOpen] = useState(false);
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<ClassEntity | null>(null);

  // --- EDITING STATE ---
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectColor, setEditSubjectColor] = useState('');

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassColor, setEditClassColor] = useState('');
  const [editClassSubjectIds, setEditClassSubjectIds] = useState<string[]>([]);

  if (!isOpen) return null;

  // --- SUBJECT LOGIC ---
  const handleAddSubject = () => {
    if (!newName.trim()) return;
    const newId = crypto.randomUUID();
    const newSubject: Subject = { id: newId, name: newName.trim(), colorStyles: newColor };
    setLocalSubjects([...localSubjects, newSubject]);
    setNewName('');
  };

  const handleRemoveSubject = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa materia? Le lezioni esistenti manterranno il nome ma perderanno il colore personalizzato.')) {
        setLocalSubjects(localSubjects.filter(s => s.id !== id));
        // Clean up subject from linked groups as well
        const updatedGroups = localLinkedGroups
          .map(g => ({
            ...g,
            subjectIds: g.subjectIds.filter(sId => sId !== id)
          }))
          .filter(g => g.subjectIds.length > 0);
        setLocalLinkedGroups(updatedGroups);
        if (onSaveLinkedSubjectGroups) {
          onSaveLinkedSubjectGroups(updatedGroups);
        }
    }
  };

  const handleSaveLinkedGroups = (newGroups: LinkedSubjectGroup[]) => {
    setLocalLinkedGroups(newGroups);
    if (onSaveLinkedSubjectGroups) {
      onSaveLinkedSubjectGroups(newGroups);
    }
  };

  const startEditingSubject = (subject: Subject) => {
      setEditingSubjectId(subject.id);
      setEditSubjectName(subject.name);
      setEditSubjectColor(subject.colorStyles);
  };

  const saveEditingSubject = () => {
      if (!editingSubjectId || !editSubjectName.trim()) return;
      setLocalSubjects(prev => prev.map(s => 
          s.id === editingSubjectId 
          ? { ...s, name: editSubjectName.trim(), colorStyles: editSubjectColor }
          : s
      ));
      setEditingSubjectId(null);
  };

  const cancelEditingSubject = () => {
      setEditingSubjectId(null);
  };

  // --- CLASS LOGIC ---
  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const newId = crypto.randomUUID();
    const newClass: ClassEntity = { id: newId, name: newClassName.trim(), colorStyles: newClassColor, subjectIds: [] };
    setLocalClasses([...localClasses, newClass]);
    setNewClassName('');
  };

  const handleRemoveClass = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa classe? Le lezioni esistenti non verranno eliminate, ma perderanno il colore associato.')) {
        setLocalClasses(localClasses.filter(c => c.id !== id));
    }
  };

  const startEditingClass = (cls: ClassEntity) => {
      setEditingClassId(cls.id);
      setEditClassName(cls.name);
      setEditClassColor(cls.colorStyles);
      setEditClassSubjectIds(cls.subjectIds || []);
  };

  const toggleSubjectForClass = (subjectId: string) => {
      setEditClassSubjectIds(prev => {
          if (prev.includes(subjectId)) {
              return prev.filter(id => id !== subjectId);
          } else {
              return [...prev, subjectId];
          }
      });
  };

  const saveEditingClass = () => {
      if (!editingClassId || !editClassName.trim()) return;
      setLocalClasses(prev => prev.map(c => 
          c.id === editingClassId 
          ? { ...c, name: editClassName.trim(), colorStyles: editClassColor, subjectIds: editClassSubjectIds }
          : c
      ));
      setEditingClassId(null);
  };

  const cancelEditingClass = () => {
      setEditingClassId(null);
  };

  const handleOpenStudentList = (cls: ClassEntity) => {
      setSelectedClassForStudents(cls);
      setIsStudentListOpen(true);
  };

  const handleSaveStudentsForClass = (classId: string, students: any[]) => {
      setLocalClasses(prev => prev.map(c => 
          c.id === classId ? { ...c, students } : c
      ));
  };

  const handleCloseAction = (isBack: boolean = false) => {
    // Commit pending edits to ensure "Auto-save on close" works for active edit fields too
    let finalSubjects = [...localSubjects];
    if (editingSubjectId && editSubjectName.trim()) {
      finalSubjects = finalSubjects.map(s => 
        s.id === editingSubjectId 
        ? { ...s, name: editSubjectName.trim(), colorStyles: editSubjectColor }
        : s
      );
    }

    let finalClasses = [...localClasses];
    if (editingClassId && editClassName.trim()) {
      finalClasses = finalClasses.map(c => 
        c.id === editingClassId 
        ? { ...c, name: editClassName.trim(), colorStyles: editClassColor, subjectIds: editClassSubjectIds }
        : c
      );
    }

    onSave(finalSubjects);
    onSaveClasses(finalClasses);
    if (onSaveLinkedSubjectGroups) {
      onSaveLinkedSubjectGroups(localLinkedGroups);
    }
    if (isBack && onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex items-center gap-2 shrink-0">
          {onBack && (
            <button onClick={() => handleCloseAction(true)} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold flex items-center gap-2 flex-1">
            <Palette className="w-6 h-6 text-blue-400" />
            Gestione Classi e Materie
          </h2>
          <button onClick={() => handleCloseAction(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* --- SECTION: CLASSI --- */}
          <div className="space-y-4">
               <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">
                  <School className="w-5 h-5 text-blue-600" />
                  Gestione Classi
               </h3>
               
               {/* Add New Class */}
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Aggiungi Nuova Classe</label>
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="Nome classe (es. 3AM)" 
                            value={newClassName}
                            onChange={(e) => setNewClassName(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 uppercase"
                        />
                        
                        <div className="grid grid-cols-6 gap-2">
                            {SUBJECT_COLOR_PRESETS.map((preset, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setNewClassColor(preset.value)}
                                    className={`h-8 w-full rounded-md border-2 transition-all ${preset.value.split(' ')[0]} ${newClassColor === preset.value ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    title={preset.name}
                                />
                            ))}
                        </div>

                        <button 
                            onClick={handleAddClass}
                            disabled={!newClassName.trim()}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Aggiungi Classe
                        </button>
                    </div>
               </div>

                {/* List Classes */}
               <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase">Classi Esistenti</label>
                    {localClasses.length === 0 ? (
                        <div className="text-center py-2 text-slate-400 italic text-sm">Nessuna classe definita.</div>
                    ) : (
                        localClasses.map(cls => (
                            <div key={cls.id}>
                                {editingClassId === cls.id ? (
                                    // EDIT MODE CLASS
                                    <div className="bg-white p-3 rounded-lg border-2 border-blue-400 space-y-3 shadow-md animate-in fade-in zoom-in-95">
                                         <input 
                                            type="text" 
                                            value={editClassName}
                                            onChange={(e) => setEditClassName(e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-md font-bold uppercase text-slate-700"
                                        />
                                        <div className="grid grid-cols-6 gap-2">
                                            {SUBJECT_COLOR_PRESETS.map((preset, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setEditClassColor(preset.value)}
                                                    className={`h-6 w-full rounded-md border-2 transition-all ${preset.value.split(' ')[0]} ${editClassColor === preset.value ? 'border-slate-800 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                                />
                                            ))}
                                        </div>

                                        {/* Subject Mapping for Class */}
                                        <div className="pt-2 border-t border-slate-100">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                <BookOpen className="w-3 h-3" /> Materie Abilitate
                                            </label>
                                            {localSubjects.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">Crea prima delle materie.</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {localSubjects.map(subj => {
                                                        const isSelected = editClassSubjectIds.includes(subj.id);
                                                        
                                                        return (
                                                            <button
                                                                key={subj.id}
                                                                onClick={() => toggleSubjectForClass(subj.id)}
                                                                className={`px-2 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1.5
                                                                    ${isSelected 
                                                                        ? `${subj.colorStyles} border-slate-300 shadow-sm opacity-100` 
                                                                        : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 hover:opacity-100'
                                                                    }
                                                                `}
                                                            >
                                                                {isSelected ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                                                {subj.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                         <div className="flex justify-end gap-2 pt-1 mt-4">
                                            <button 
                                                onClick={() => handleOpenStudentList({...cls, name: editClassName, colorStyles: editClassColor, subjectIds: editClassSubjectIds})}
                                                className="mr-auto flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-bold text-xs transition-all"
                                                title="Gestisci Alunni"
                                            >
                                                <Users className="w-4 h-4" /> Elenco Alunni
                                            </button>
                                            <button onClick={cancelEditingClass} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md" title="Annulla">
                                                <X className="w-5 h-5" />
                                            </button>
                                            <button onClick={saveEditingClass} className="p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md" title="Salva">
                                                <Check className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // VIEW MODE CLASS
                                    <div className={`flex items-center justify-between p-3 rounded-lg border ${cls.colorStyles}`}>
                                        <div className="flex flex-col">
                                            <span className="font-bold">{cls.name}</span>
                                            {/* Show count of enabled subjects */}
                                            {localSubjects.length > 0 && (
                                                <span className="text-[10px] opacity-60 font-medium">
                                                    {cls.subjectIds && cls.subjectIds.length > 0 
                                                        ? `${cls.subjectIds.length} materie associate`
                                                        : 'Tutte le materie'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleOpenStudentList(cls)}
                                                className="p-1.5 bg-white/50 hover:bg-white text-slate-600 hover:text-primary rounded-md transition-colors"
                                                title="Elenco Alunni"
                                            >
                                                <Users className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => startEditingClass(cls)}
                                                className="p-1.5 bg-white/50 hover:bg-white text-slate-600 hover:text-blue-600 rounded-md transition-colors"
                                                title="Modifica"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleRemoveClass(cls.id)}
                                                className="p-1.5 bg-white/50 hover:bg-white text-slate-600 hover:text-red-600 rounded-md transition-colors"
                                                title="Elimina"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
               </div>
          </div>

          {/* --- SECTION: MATERIE --- */}
          <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                      <BookOpen className="w-5 h-5 text-amber-600" />
                      Gestione Materie
                  </h3>
                  <button 
                      type="button"
                      onClick={() => setIsLinkModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm magi-press"
                      title="Collega due o più materie dello stesso docente per la propagazione compiti"
                  >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Collega materie</span>
                      {localLinkedGroups.length > 0 && (
                          <span className="bg-amber-800 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                              {localLinkedGroups.length}
                          </span>
                      )}
                  </button>
              </div>

              {/* Add New Subject */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Aggiungi Nuova Materia</label>
                  <div className="space-y-3">
                      <input 
                          type="text" 
                          placeholder="Nome materia (es. Disegno Tecnico)" 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-700"
                      />
                      
                      <div className="grid grid-cols-6 gap-2">
                          {SUBJECT_COLOR_PRESETS.map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setNewColor(preset.value)}
                                className={`h-8 w-full rounded-md border-2 transition-all ${preset.value.split(' ')[0]} ${newColor === preset.value ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                title={preset.name}
                              />
                          ))}
                      </div>

                      <button 
                        onClick={handleAddSubject}
                        disabled={!newName.trim()}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                          <Plus className="w-4 h-4" /> Aggiungi Materia
                      </button>
                  </div>
              </div>

              {/* List Subjects */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase">Materie Esistenti</label>
                {localSubjects.length === 0 ? (
                    <div className="text-center py-2 text-slate-400 italic text-sm">Nessuna materia definita.</div>
                ) : (
                    localSubjects.map(subj => (
                        <div key={subj.id}>
                            {editingSubjectId === subj.id ? (
                                // EDIT MODE SUBJECT
                                <div className="bg-white p-3 rounded-lg border-2 border-amber-400 space-y-3 shadow-md animate-in fade-in zoom-in-95">
                                        <input 
                                        type="text" 
                                        value={editSubjectName}
                                        onChange={(e) => setEditSubjectName(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-md font-bold text-slate-700"
                                    />
                                    <div className="grid grid-cols-6 gap-2">
                                        {SUBJECT_COLOR_PRESETS.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setEditSubjectColor(preset.value)}
                                                className={`h-6 w-full rounded-md border-2 transition-all ${preset.value.split(' ')[0]} ${editSubjectColor === preset.value ? 'border-slate-800 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={cancelEditingSubject} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md" title="Annulla">
                                            <X className="w-5 h-5" />
                                        </button>
                                        <button onClick={saveEditingSubject} className="p-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-md" title="Salva">
                                            <Check className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // VIEW MODE SUBJECT
                                (() => {
                                    const linkedWithNames = getOtherLinkedSubjectNames(subj.id, localSubjects, localLinkedGroups);
                                    return (
                                        <div className={`flex items-center justify-between p-3 rounded-lg border ${subj.colorStyles}`}>
                                            <div className="flex flex-col flex-1 min-w-0 pr-2">
                                                <span className="font-bold truncate">{subj.name}</span>
                                                {linkedWithNames.length > 0 && (
                                                    <span className="text-[11px] text-amber-900 bg-white/80 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 mt-1 w-fit border border-amber-200/50">
                                                        <Link2 className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span className="truncate">Collegata con: <strong>{linkedWithNames.join(', ')}</strong></span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button 
                                                    onClick={() => startEditingSubject(subj)}
                                                    className="p-1.5 bg-white/50 hover:bg-white text-slate-600 hover:text-blue-600 rounded-md transition-colors"
                                                    title="Modifica"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleRemoveSubject(subj.id)}
                                                    className="p-1.5 bg-white/50 hover:bg-white text-slate-600 hover:text-red-600 rounded-md transition-colors"
                                                    title="Elimina"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    ))
                )}
              </div>
          </div>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
             <div className="flex items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium italic">Salvataggio automatico alla chiusura</span>
             </div>
        </div>

        {/* --- STUDENT LIST MODAL --- */}
        {selectedClassForStudents && (
          <div className="contents" style={{ zIndex: 100 }}>
            {/* Importation dynamic to avoid circular dependencies if needed, but since it's local it's fine */}
            <StudentListModal 
              isOpen={isStudentListOpen}
              onClose={() => setIsStudentListOpen(false)}
              selectedClass={selectedClassForStudents}
              onSave={handleSaveStudentsForClass}
            />
          </div>
        )}

        {/* --- LINKED SUBJECTS MODAL --- */}
        <LinkedSubjectsModal 
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          subjects={localSubjects}
          linkedGroups={localLinkedGroups}
          onSave={handleSaveLinkedGroups}
        />

      </div>
    </div>
  );
};

export default SubjectManagerModal;
