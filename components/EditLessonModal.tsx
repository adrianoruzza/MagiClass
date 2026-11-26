
import React, { useState, useEffect } from 'react';
import { X, School, ChevronDown, BookOpen, MapPin, CheckCircle2 } from 'lucide-react';
import { Lesson, Subject, ClassEntity, RepeatMode } from '../types';

interface EditLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  dateStr?: string;
  subjects: Subject[];
  classes: ClassEntity[];
  onSave: (lessonId: string, className: string, subject: string, room: string, dateStr?: string, repeatMode?: RepeatMode) => void;
}

const SPECIAL_TYPES = ['A DISPOSIZIONE', 'BUCO'];

const EditLessonModal: React.FC<EditLessonModalProps> = ({
  isOpen,
  onClose,
  lesson,
  dateStr,
  subjects,
  classes,
  onSave,
}) => {
  const [className, setClassName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [room, setRoom] = useState('');
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');

  // Sync state with passed lesson
  useEffect(() => {
    if (lesson) {
      setClassName(lesson.className);
      setSelectedSubject(lesson.subject || '');
      setRoom(lesson.room || '');
      setRepeatMode(lesson.repeatMode || (lesson.weekStart ? 'none' : 'weekly'));
    }
  }, [lesson, isOpen]);

  // Derive available subjects based on selected class
  const getFilteredSubjects = () => {
    const selectedClass = classes.find(c => c.name === className);
    if (selectedClass && selectedClass.subjectIds && selectedClass.subjectIds.length > 0) {
       return subjects.filter(s => selectedClass.subjectIds!.includes(s.id));
    }
    return subjects;
  };

  const filteredSubjects = getFilteredSubjects();

  // Set default subject logic if switching classes
  useEffect(() => {
    if (isOpen && !SPECIAL_TYPES.includes(className)) {
       const isCurrentSelectionValid = filteredSubjects.find(s => s.name === selectedSubject);
       if (!isCurrentSelectionValid && filteredSubjects.length > 0) {
           setSelectedSubject(filteredSubjects[0].name);
       }
    }
  }, [className, filteredSubjects, isOpen]);

  if (!isOpen || !lesson) return null;

  // Funzione di salvataggio ed uscita
  const handleCloseAndSave = () => {
    if (className) {
      const isSpecial = SPECIAL_TYPES.includes(className);
      const finalSubject = isSpecial ? '' : (selectedSubject || (filteredSubjects.length > 0 ? filteredSubjects[0].name : ''));
      onSave(lesson.id, className, finalSubject, room, dateStr, className === 'A DISPOSIZIONE' ? repeatMode : undefined);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Modifica Lezione
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              {lesson.day} - {lesson.hour}° Ora
            </p>
          </div>
          <button onClick={handleCloseAndSave} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          
          {/* Class Selector */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">Classe / Tipologia</label>
            <div className="relative group">
              <School className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
              <ChevronDown className="absolute right-4 top-4 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
              <select
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full pl-12 pr-10 py-4 text-lg bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none appearance-none cursor-pointer font-bold text-slate-800 transition-all"
              >
                <optgroup label="Classi">
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Altro">
                  {SPECIAL_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Repetition Selector EXCLUSIVELY for A DISPOSIZIONE */}
          {className === 'A DISPOSIZIONE' && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                Ripetizione Settimanale
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRepeatMode('weekly')}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                    repeatMode === 'weekly'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  Ogni settimana
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatMode('biweekly')}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                    repeatMode === 'biweekly'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  Sett. alterne
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatMode('none')}
                  className={`py-2 px-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                    repeatMode === 'none'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  Nessuna
                </button>
              </div>
            </div>
          )}

          {/* Subject Selector - Only for classes */}
          {!SPECIAL_TYPES.includes(className) && (
            <div>
               <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">Materia</label>
               <div className="relative group">
                <BookOpen className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
                <ChevronDown className="absolute right-4 top-4 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
                <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full pl-12 pr-10 py-4 text-lg bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none appearance-none cursor-pointer font-bold text-slate-800 transition-all disabled:opacity-50"
                    disabled={filteredSubjects.length === 0}
                >
                    {filteredSubjects.length === 0 ? (
                        <option value="">Nessuna materia disponibile</option>
                    ) : (
                        filteredSubjects.map(subj => (
                            <option key={subj.id} value={subj.name}>{subj.name}</option>
                        ))
                    )}
                </select>
               </div>
               {filteredSubjects.length === 0 && (
                   <p className="text-xs text-red-500 mt-1 px-1">Nessuna materia associata a questa classe.</p>
               )}
            </div>
          )}

          {/* Room Input */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">Aula (Opzionale)</label>
            <div className="relative group">
              <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Es. Lab 1, Aula 3..."
                className="w-full pl-12 pr-4 py-4 text-lg bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all placeholder:font-normal"
              />
            </div>
          </div>
          
          <div className="pt-4 flex items-center justify-center gap-2 text-slate-400">
             <CheckCircle2 className="w-4 h-4" />
             <span className="text-xs font-medium italic">Salvataggio automatico alla chiusura</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EditLessonModal;
