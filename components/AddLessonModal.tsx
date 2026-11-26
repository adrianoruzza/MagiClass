
import React, { useState, useEffect } from 'react';
import { X, School, ChevronDown, CheckCircle2 } from 'lucide-react';
import { DayOfWeek, Subject, ClassEntity, RepeatMode } from '../types';
import { TIME_SLOTS } from '../constants';

interface AddLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayOfWeek | null;
  hour: number | null;
  subjects: Subject[];
  classes: ClassEntity[];
  onSave: (className: string, subject: string, room: string, repeatMode?: RepeatMode) => void;
}

const SPECIAL_TYPES = ['A DISPOSIZIONE', 'BUCO'];

const AddLessonModal: React.FC<AddLessonModalProps> = ({
  isOpen,
  onClose,
  day,
  hour,
  subjects,
  classes,
  onSave,
}) => {
  const [className, setClassName] = useState('');
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');

  // Set default class
  useEffect(() => {
      if (isOpen && !className) {
          if (classes.length > 0) setClassName(classes[0].name);
          else if (SPECIAL_TYPES.length > 0) setClassName(SPECIAL_TYPES[0]);
      }
      if (isOpen) {
          setRepeatMode('none');
      }
  }, [isOpen, classes, className]);

  if (!isOpen || !day || !hour) return null;

  const handleCloseAndSave = () => {
    if (className) {
      const isSpecial = SPECIAL_TYPES.includes(className);
      let finalSubject = '';

      if (!isSpecial) {
          const selectedClass = classes.find(c => c.name === className);
          
          // 1. Cerca la prima materia assegnata specificamente a questa classe
          if (selectedClass && selectedClass.subjectIds && selectedClass.subjectIds.length > 0) {
               const sub = subjects.find(s => s.id === selectedClass.subjectIds![0]);
               if (sub) finalSubject = sub.name;
          } 
          // 2. Fallback: Se la classe non ha materie specifiche, usa la prima materia globale disponibile
          else if (subjects.length > 0) {
              finalSubject = subjects[0].name;
          }
      }
      
      onSave(className, finalSubject, '', className === 'A DISPOSIZIONE' ? repeatMode : undefined); 
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-magi-fade" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-magi-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              Aggiungi Ora
            </h2>
            <p className="text-slate-300 text-base mt-1">
              {day} - {hour}° Ora ({TIME_SLOTS[hour]})
            </p>
          </div>
          <button onClick={handleCloseAndSave} className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">Seleziona Tipologia o Classe</label>
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
            {!SPECIAL_TYPES.includes(className) && (
                <p className="text-xs text-slate-400 mt-2 px-1">
                   La materia verrà assegnata automaticamente in base alla classe.
                </p>
            )}
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

          <div className="pt-4 flex items-center justify-center gap-2 text-slate-400">
             <CheckCircle2 className="w-4 h-4" />
             <span className="text-xs font-medium italic">Salvataggio automatico alla chiusura</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AddLessonModal;
