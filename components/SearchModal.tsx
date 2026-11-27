
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, Filter, ArrowRight, Clock } from 'lucide-react';
import { Lesson, LessonNote, ClassEntity } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: LessonNote[];
  schedule: Lesson[];
  classes: ClassEntity[];
  onGoToNote: (dateStr: string, lessonId: string) => void;
  initialQuery?: string;
  initialSelectedClass?: string;
  initialScrollTop?: number;
  sessionRestoreKey?: number;
  onFilterChange?: (filters: { query: string; selectedClass: string }) => void;
  onScrollPositionChange?: (scrollTop: number) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  notes,
  schedule,
  classes,
  onGoToNote,
  initialQuery = '',
  initialSelectedClass = 'all',
  initialScrollTop = 0,
  sessionRestoreKey = 0,
  onFilterChange,
  onScrollPositionChange
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedClass, setSelectedClass] = useState<string>(initialSelectedClass || 'all');
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const lastRestoreKeyRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionRestoreKey || sessionRestoreKey === lastRestoreKeyRef.current) return;
    lastRestoreKeyRef.current = sessionRestoreKey;
    setQuery(initialQuery);
    setSelectedClass(initialSelectedClass || 'all');
  }, [sessionRestoreKey, initialQuery, initialSelectedClass]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({ query, selectedClass });
    }
  }, [query, selectedClass, onFilterChange]);

  useEffect(() => {
    if (!isOpen || !initialScrollTop) return;
    const frame = requestAnimationFrame(() => {
      if (resultsScrollRef.current) {
        resultsScrollRef.current.scrollTop = initialScrollTop;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, sessionRestoreKey]);

  const filteredResults = useMemo(() => {
    if (!isOpen) return [];

    return notes
      .filter(note => {
        // Trova la lezione associata per conoscere la classe
        const lesson = schedule.find(l => l.id === note.lessonId);
        const className = (lesson?.className || note.className || '').trim();
        if (!className) return false;

        // Filtro per classe
        if (selectedClass !== 'all' && className !== selectedClass) return false;

        // Filtro per query testuale
        const searchText = `${note.toDo} ${note.toCheck} ${note.misc}`.toLowerCase();
        return query === '' || searchText.includes(query.toLowerCase());
      })
      .map(note => {
        const lesson = schedule.find(l => l.id === note.lessonId) || {
          id: note.lessonId,
          className: note.className || '',
          subject: note.subject || '',
          day: 'Lunedì' as any,
          hour: note.hour || 1,
          room: ''
        };
        return { note, lesson };
      })
      .sort((a, b) => new Date(b.note.date).getTime() - new Date(a.note.date).getTime());
  }, [notes, schedule, query, selectedClass, isOpen]);

  if (!isOpen) return null;

  const cleanText = (text: string) => text.replace(/\{[VXO]\}/g, '').trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-4 animate-magi-fade" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-magi-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 sm:p-6 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-6 h-6 text-blue-400" />
              Cerca Compiti
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Cerca testo nei compiti..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="sm:w-48 relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-xl text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-all"
              >
                <option value="all">Tutte le classi</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={resultsScrollRef}
          onScroll={onScrollPositionChange ? (e) => onScrollPositionChange(e.currentTarget.scrollTop) : undefined}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 scrollbar-thin"
        >
          {filteredResults.length > 0 ? (
            filteredResults.map(({ note, lesson }, idx) => (
              <button
                key={`${note.date}-${note.lessonId}`}
                onClick={() => onGoToNote(note.date, note.lessonId)}
                className="w-full text-left bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all group flex gap-4 items-start magi-press animate-magi-fade"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0 border border-slate-200 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                  <span className="text-[10px] font-black text-slate-400 uppercase leading-none group-hover:text-blue-400 transition-colors">
                    {new Date(note.date).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-xl font-black text-slate-700 leading-tight group-hover:text-blue-600 transition-colors">
                    {new Date(note.date).getDate()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-blue-600 uppercase text-sm">{lesson.className}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs font-bold text-slate-500 truncate">{lesson.subject}</span>
                    <span className="ml-auto text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1">
                       <Clock className="w-3 h-3"/> {lesson.hour}° ora
                    </span>
                  </div>

                  <div className="space-y-1">
                    {note.toDo && (
                      <p className="text-sm text-slate-600 line-clamp-1 italic">
                        <span className="font-bold text-blue-400 text-[10px] uppercase mr-1">Fare:</span>
                        {cleanText(note.toDo)}
                      </p>
                    )}
                    {note.toCheck && (
                      <p className="text-sm text-slate-600 line-clamp-1 italic">
                        <span className="font-bold text-amber-400 text-[10px] uppercase mr-1">Check:</span>
                        {cleanText(note.toCheck)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="self-center p-2 rounded-full bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center animate-magi-fade">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">Nessun compito trovato</p>
              <p className="text-sm">Prova a cambiare i filtri o la parola chiave.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Trovati {filteredResults.length} risultati
          </p>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
