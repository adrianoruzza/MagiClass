
import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, GraduationCap, Check, UserPlus, ClipboardList, Info, Pencil, CheckCircle2 } from 'lucide-react';
import { ClassEntity, Student } from '../types';

interface StudentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: ClassEntity | null;
  onSave: (classId: string, students: Student[]) => void;
}

const StudentListModal: React.FC<StudentListModalProps> = ({
  isOpen,
  onClose,
  selectedClass,
  onSave,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (selectedClass && selectedClass.students) {
      setStudents(JSON.parse(JSON.stringify(selectedClass.students)));
    } else {
      setStudents([]);
    }
    setIsBulkMode(false);
    setBulkText('');
  }, [selectedClass, isOpen]);

  if (!isOpen || !selectedClass) return null;

  const handleAddStudent = () => {
    if (!newStudentName.trim()) return;
    const newStudent: Student = {
      id: crypto.randomUUID(),
      name: newStudentName.trim(),
      isDSA: false,
      isH: false,
    };
    const updated = [...students, newStudent];
    setStudents(updated);
    setNewStudentName('');
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setIsBulkMode(false);
      return;
    }

    const newStudents: Student[] = lines.map(name => ({
      id: crypto.randomUUID(),
      name: name.toUpperCase(),
      isDSA: false,
      isH: false,
    }));

    setStudents([...students, ...newStudents]);
    setBulkText('');
    setIsBulkMode(false);
  };

  const handleRemoveStudent = (id: string) => {
    const updated = students.filter(s => s.id !== id);
    setStudents(updated);
  };

  const toggleStatus = (id: string, field: 'isDSA' | 'isH') => {
    const updated = students.map(s => 
      s.id === id ? { ...s, [field]: !s[field] } : s
    );
    setStudents(updated);
  };

  const startEditing = (student: Student) => {
    setEditingId(student.id);
    setEditValue(student.name);
  };

  const handleUpdateName = (id: string) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    const updated = students.map(s => 
      s.id === id ? { ...s, name: editValue.trim().toUpperCase() } : s
    );
    setStudents(updated);
    setEditingId(null);
  };

  const handleSave = () => {
    let finalStudents = [...students];
    if (newStudentName.trim()) {
      const newStudent: Student = {
        id: crypto.randomUUID(),
        name: newStudentName.trim().toUpperCase(),
        isDSA: false,
        isH: false,
      };
      finalStudents.push(newStudent);
      setStudents(finalStudents);
      setNewStudentName('');
    }
    onSave(selectedClass.id, finalStudents);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-magi-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-magi-modal flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-primary text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Elenco Alunni</h2>
              <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Classe {selectedClass.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {students.length > 0 && (
              <button 
                onClick={() => { if(confirm('Svuotare l\'intera lista alunni di questa classe?')) setStudents([]); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                title="Svuota lista"
              >
                <Trash2 className="w-5 h-5 text-rose-200" />
              </button>
            )}
            <button 
              onClick={() => setIsBulkMode(!isBulkMode)} 
              className={`p-2 rounded-lg transition-colors ${isBulkMode ? 'bg-white text-primary' : 'hover:bg-white/10'}`}
              title="Importazione Multipla"
            >
              <ClipboardList className="w-5 h-5" />
            </button>
            <button onClick={handleSave} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Area */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          {isBulkMode ? (
            <div className="space-y-3 animate-magi-fade">
              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg text-amber-700 text-xs border border-amber-100">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Incolla qui l'elenco degli alunni. Inserisci un nome per ogni riga.</p>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Nome Cognome 1&#10;Nome Cognome 2&#10;..."
                className="w-full h-32 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm uppercase"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBulkMode(false)}
                  className="flex-1 py-2 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-all text-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!bulkText.trim()}
                  className="flex-1 py-2 px-4 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  <Plus className="w-4 h-4" /> Importa Lista
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 animate-magi-fade">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Nome e cognome alunno..."
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-slate-700 uppercase"
                />
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
              <button
                onClick={handleAddStudent}
                disabled={!newStudentName.trim()}
                className="px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center magi-press"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/20">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <GraduationCap className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium italic">Nessun alunno inserito per questa classe.</p>
            </div>
          ) : (
            students.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all group"
              >
                    <div className="flex-1 min-w-0">
                      {editingId === student.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleUpdateName(student.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateName(student.id)}
                            className="flex-1 bg-slate-50 border-2 border-primary rounded px-2 py-1 font-bold text-slate-700 uppercase outline-none"
                          />
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); handleUpdateName(student.id); }}
                            className="bg-primary text-white p-1 rounded px-2 text-xs font-bold"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => startEditing(student)}>
                          <p 
                            className="font-bold text-slate-700 truncate uppercase hover:text-primary transition-colors"
                          >
                            {student.name}
                          </p>
                          <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover/name:text-primary transition-colors shrink-0" />
                        </div>
                      )}
                    </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleStatus(student.id, 'isDSA')}
                    className={`w-10 h-8 rounded-lg text-[10px] font-black transition-all border ${
                      student.isDSA
                        ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                    }`}
                    title="DSA/BES"
                  >
                    DSA
                  </button>
                  <button
                    onClick={() => toggleStatus(student.id, 'isH')}
                    className={`w-10 h-8 rounded-lg text-[10px] font-black transition-all border ${
                      student.isH
                        ? 'bg-rose-500 border-rose-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                    }`}
                    title="H (Disabilità)"
                  >
                    H
                  </button>
                  <div className="w-px h-6 bg-slate-100 mx-1" />
                  <button
                    onClick={() => handleRemoveStudent(student.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all magi-press"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 magi-press"
            >
              <Check className="w-5 h-5" /> Salva Elenco
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-slate-400">
             <CheckCircle2 className="w-3.5 h-3.5" />
             <span className="text-[10px] font-bold uppercase tracking-wider italic">Salvataggio automatico alla chiusura</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentListModal;
