
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { X, Calendar, Eraser, AlertCircle, CheckSquare, StickyNote, Check, Clock, XCircle, Users, Triangle, Presentation, Copy, Trash2, Pencil, ArrowRight, GraduationCap, PenTool, FileText, Ban, BookOpen, FileCheck, Repeat, ChevronDown } from 'lucide-react';
import { Lesson, LessonNote, NoteStatus, TaskTemplate, Student, RepeatMode } from '../types';
import { isDisposizioneLesson } from '../utils/repetitionUtils';

interface AssignmentModalProps {
  lesson: Lesson;
  dateStr: string; 
  isOpen: boolean;
  onClose: () => void;
  note: LessonNote | undefined;
  allNotes: LessonNote[]; 
  taskTemplates?: TaskTemplate[];
  onSaveNote: (note: LessonNote) => void;
  onDeleteLesson: (id: string, dateStr?: string) => void;
  onPropagate: (sourceLessonId: string, sourceDateStr: string, field: 'toCheck' | 'toDo' | 'misc', content: string) => void;
  onMoveToNextDay: (sourceLessonId: string, sourceDateStr: string, field: 'toCheck' | 'toDo' | 'misc', content: string) => boolean;
  onMoveAllToNext: (sourceLessonId: string, sourceDateStr: string, content: { toCheck: string, toDo: string, misc: string }) => boolean;
  onMoveNoteItem: (lessonId: string, dateStr: string, field: 'toCheck' | 'toDo' | 'misc', text: string) => void;
  onRemovePropagated: (sourceLessonId: string, sourceDateStr: string, content: string) => void;
  onRestoreFromNext: (sourceLessonId: string, sourceDateStr: string, content: { toCheck: string, toDo: string, misc: string }) => void;
  onEdit: (lesson: Lesson) => void;
  students?: Student[];
  onAddRecoveryNote?: (absentNames: string[], examType: string) => void;
  onUpdateRepeatMode?: (lesson: Lesson, mode: RepeatMode, dateStr: string) => void;
}

const TAG_DONE = '{V}';
const TAG_NOT_DONE = '{X}';
const TAG_PENDING = '{O}';

type FieldType = 'toCheck' | 'toDo' | 'misc';

interface DragItem {
    field: FieldType;
    index: number;
    text: string;
    status: string;
}

const cleanTagContent = (text: string) => text.replace(/\{[VXO]\}/g, '').trim();

const InteractiveList = ({ 
    field,
    value, 
    onChange, 
    placeholder, 
    disabled, 
    theme,
    textColorClass,
    suggestionsPool,
    onLineAction,
    onMoveLine,
    onDragStart,
    onDropItem,
    isDraggingGlobal
}: { 
    field: FieldType,
    value: string, 
    onChange: (val: string) => void, 
    placeholder: string, 
    disabled?: boolean,
    theme: 'amber' | 'blue' | 'violet',
    textColorClass?: string,
    suggestionsPool: string[], 
    onLineAction: (lineText: string, action: 'done' | 'not_done' | 'pending' | 'none') => void,
    onMoveLine: (lineText: string) => boolean,
    onDragStart: (field: FieldType, index: number, text: string, status: string) => void,
    onDropItem: (targetField: FieldType, targetIndex: number) => void,
    isDraggingGlobal: boolean
}) => {
    const rawItems = value ? value.split('\n') : [''];
    const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    const [inlineSuggestion, setInlineSuggestion] = useState<{ index: number, text: string, suffix: string } | null>(null);

    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null); 

    const items = rawItems.map(line => {
        if (line.startsWith(TAG_DONE)) {
            const content = line.substring(TAG_DONE.length);
            return { status: 'done', text: content.startsWith(' ') ? content.substring(1) : content };
        }
        if (line.startsWith(TAG_NOT_DONE)) {
            const content = line.substring(TAG_NOT_DONE.length);
            return { status: 'not_done', text: content.startsWith(' ') ? content.substring(1) : content };
        }
        if (line.startsWith(TAG_PENDING)) {
            const content = line.substring(TAG_PENDING.length);
            return { status: 'pending', text: content.startsWith(' ') ? content.substring(1) : content };
        }
        return { status: 'none', text: line };
    });

    useEffect(() => {
        if (focusIndex !== null && inputRefs.current[focusIndex]) {
            inputRefs.current[focusIndex]?.focus();
            setFocusIndex(null);
        }
    }, [items.length, focusIndex]);

    useLayoutEffect(() => {
        inputRefs.current.forEach(el => {
            if (!el) return;
            el.style.height = 'auto';
            if (el.scrollHeight > 0) {
                el.style.height = `${el.scrollHeight}px`;
            } else {
                el.style.height = '';
            }
        });
    }, [value, items.length]);

    const updateParent = (newItemsData: { status: string, text: string }[]) => {
        const joined = newItemsData.map(item => {
            let prefix = '';
            if (item.status === 'done') prefix = TAG_DONE + ' ';
            else if (item.status === 'not_done') prefix = TAG_NOT_DONE + ' ';
            else if (item.status === 'pending') prefix = TAG_PENDING + ' ';
            return prefix + item.text;
        }).join('\n');
        onChange(joined);
    };

    const handleChange = (index: number, newText: string) => {
        let foundSuffix = '';
        let foundFullText = '';
        if (newText.length > 2 && suggestionsPool.length > 0) {
            const lowerText = newText.toLowerCase();
            // Analisi: cerchiamo corrispondenza sia per singola riga che per blocchi
            const match = suggestionsPool.find(s => s.toLowerCase().startsWith(lowerText) && s.toLowerCase() !== lowerText);
            if (match) {
                foundFullText = match;
                foundSuffix = match.substring(newText.length);
            }
        }
        if (foundSuffix) {
            setInlineSuggestion({ index, text: foundFullText, suffix: foundSuffix });
        } else {
            setInlineSuggestion(null);
        }

        if (newText.includes('\n')) {
            const pastedLines = newText.split('\n');
            const newItems = [...items];
            newItems[index].text = pastedLines[0];
            const newEntries = pastedLines.slice(1).map(line => ({ status: 'none', text: line }));
            newItems.splice(index + 1, 0, ...newEntries);
            updateParent(newItems);
            setFocusIndex(index + newEntries.length);
            setInlineSuggestion(null);
        } else {
            const newItems = [...items];
            newItems[index].text = newText;
            updateParent(newItems);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (inlineSuggestion && inlineSuggestion.index === index) {
            if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                const newItems = [...items];
                // Gestione inserimento blocchi multi-riga dal database
                const acceptedText = inlineSuggestion.text;
                if (acceptedText.includes('\n')) {
                    const blockLines = acceptedText.split('\n');
                    newItems[index].text = blockLines[0];
                    const newEntries = blockLines.slice(1).map(l => ({ status: 'none', text: l }));
                    newItems.splice(index + 1, 0, ...newEntries);
                    updateParent(newItems);
                    setFocusIndex(index + newEntries.length);
                } else {
                    newItems[index].text = acceptedText;
                    updateParent(newItems);
                }
                setInlineSuggestion(null);
                return;
            }
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const newItems = [...items];
            newItems.splice(index + 1, 0, { status: 'none', text: '' }); 
            updateParent(newItems);
            setFocusIndex(index + 1);
            setInlineSuggestion(null);
        } else if (e.key === 'Backspace' && items[index].text === '' && items.length > 1) {
            e.preventDefault();
            const newItems = [...items];
            newItems.splice(index, 1); 
            updateParent(newItems);
            setFocusIndex(Math.max(0, index - 1));
            setInlineSuggestion(null);
        }
    };

    const clearActiveTouch = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleStatusClick = (e: React.MouseEvent, index: number, action: 'done' | 'not_done' | 'pending') => {
        e.stopPropagation();
        clearActiveTouch();
        const newItems = [...items];
        const currentStatus = newItems[index].status;
        if (currentStatus === action) {
            newItems[index].status = 'none';
            onLineAction(newItems[index].text, 'none');
        } else {
            newItems[index].status = action;
            onLineAction(newItems[index].text, action);
        }
        updateParent(newItems);
    };

    const handleDeleteLine = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        clearActiveTouch();
        const textToDelete = items[index].text;
        if (textToDelete.trim()) onLineAction(textToDelete, 'none');
        const newItems = [...items];
        newItems.splice(index, 1);
        if (newItems.length === 0) newItems.push({ status: 'none', text: '' }); 
        updateParent(newItems);
    };

    const handleMoveClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        clearActiveTouch();
        const textToMove = items[index].text;
        if (textToMove.trim()) {
            const success = onMoveLine(textToMove);
            if (success) {
                const newItems = [...items];
                newItems.splice(index, 1);
                if (newItems.length === 0) newItems.push({ status: 'none', text: '' });
                updateParent(newItems);
            }
        }
    };

    const handleCopyClick = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        clearActiveTouch();
        navigator.clipboard.writeText(text);
    };

    const handleTouchStart = (_e: React.TouchEvent, index: number) => {
        if (disabled || items[index].text === '') return;
        clearActiveTouch();
        longPressTimer.current = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            setDraggingIndex(index);
            onDragStart(field, index, items[index].text, items[index].status);
        }, 500); 
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (longPressTimer.current) {
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const dropRow = target?.closest('[data-droppable="true"]');
            if (dropRow) {
                const targetField = dropRow.getAttribute('data-field') as FieldType;
                const targetIndex = parseInt(dropRow.getAttribute('data-index') || '0', 10);
                if (targetField && !isNaN(targetIndex)) {
                    onDropItem(targetField, targetIndex);
                }
            }
            clearActiveTouch();
            setDraggingIndex(null);
        }
    };

    const styles = {
        amber: { dot: 'bg-amber-400', focus: 'focus:border-amber-300' },
        blue: { dot: 'bg-blue-400', focus: 'focus:border-blue-300' },
        violet: { dot: 'bg-violet-400', focus: 'focus:border-violet-300' },
    }[theme];

    return (
        <div className="flex-1 w-full overflow-y-auto min-h-[120px] sm:min-h-0 flex flex-col gap-2 pr-1 scrollbar-thin pb-4">
            {items.map((item, index) => {
                const isBeingDragged = isDraggingGlobal && draggingIndex === index;
                const hasSuggestion = inlineSuggestion && inlineSuggestion.index === index;
                return (
                <div 
                    key={`${field}-${index}`} 
                    className={`flex items-start gap-2 group p-1 rounded-md transition-all relative
                        ${isBeingDragged ? 'bg-blue-100 opacity-50 border border-blue-300' : 'hover:bg-slate-50 border border-transparent'}
                    `}
                    draggable={item.text.trim().length > 0}
                    onDragStart={() => onDragStart(field, index, item.text, item.status)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); onDropItem(field, index); }}
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    onTouchMove={clearActiveTouch}
                    onTouchEnd={handleTouchEnd}
                    data-droppable="true"
                    data-field={field}
                    data-index={index}
                >
                    <div className="shrink-0 w-8 flex justify-center mt-1.5 pointer-events-none">
                        {item.status === 'done' && (
                            <div className="bg-emerald-500 border border-emerald-600 text-white p-1 rounded-md shadow-sm transform transition-transform">
                                <Check className="w-3.5 h-3.5" strokeWidth={4} />
                            </div>
                        )}
                        {item.status === 'not_done' && (
                            <div className="bg-rose-500 border border-rose-600 text-white p-1 rounded-md shadow-sm transform transition-transform">
                                <XCircle className="w-3.5 h-3.5" strokeWidth={3} />
                            </div>
                        )}
                        {item.status === 'pending' && (
                            <div className="bg-amber-400 border border-amber-500 text-white p-1 rounded-md shadow-sm transform transition-transform">
                                <Clock className="w-3.5 h-3.5" strokeWidth={3} />
                            </div>
                        )}
                        {item.status === 'none' && (
                             <div className={`w-2 h-2 rounded-full ${styles.dot} opacity-40 mt-1.5`} />
                        )}
                    </div>
                    
                    <div className="flex-1 relative font-medium text-base leading-normal">
                         <div className="absolute inset-0 z-20 pointer-events-none whitespace-pre-wrap break-words px-2 py-1 font-sans text-base">
                            <span className="opacity-0">{item.text}</span>
                            {hasSuggestion && (
                                <span className="text-slate-400 opacity-60 pointer-events-auto cursor-pointer select-none bg-slate-100/50 rounded px-0.5">
                                    {inlineSuggestion.suffix}
                                </span>
                            )}
                         </div>
                        <textarea ref={el => { inputRefs.current[index] = el; if (el && el.scrollHeight > 0) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} rows={1} value={item.text} onChange={(e) => handleChange(index, e.target.value)} onKeyDown={(e) => handleKeyDown(e, index)} placeholder={items.length === 1 ? placeholder : ''} className={`w-full min-h-[2rem] relative z-10 bg-transparent border-b border-transparent hover:border-slate-200 ${styles.focus} focus:ring-0 px-2 py-1 text-base ${textColorClass || 'text-slate-800'} outline-none transition-all rounded-sm placeholder:text-slate-300 font-medium resize-none overflow-hidden block leading-normal`} disabled={disabled} />
                    </div>

                    {(item.text.trim().length > 0) && (
                        <div className="flex flex-col gap-1 ml-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-within:opacity-100 mt-0.5 shrink-0 z-20">
                             <div className="flex items-center gap-1">
                                <button onClick={(e) => handleStatusClick(e, index, 'done')} className={`p-1 rounded border transition-all ${item.status === 'done' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200'}`} tabIndex={-1}>
                                    <Check className="w-3 h-3" />
                                </button>
                                <button onClick={(e) => handleStatusClick(e, index, 'not_done')} className={`p-1 rounded border transition-all ${item.status === 'not_done' ? 'bg-rose-600 text-white border-rose-700' : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'}`} tabIndex={-1}>
                                    <XCircle className="w-3 h-3" />
                                </button>
                                <button onClick={(e) => handleStatusClick(e, index, 'pending')} className={`p-1 rounded border transition-all ${item.status === 'pending' ? 'bg-amber-500 text-white border-amber-600' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-yellow-200'}`} tabIndex={-1}>
                                    <Clock className="w-3 h-3" />
                                </button>
                             </div>
                             <div className="flex items-center gap-1">
                                <button onClick={(e) => handleCopyClick(e, item.text)} className="p-1 rounded border border-slate-200 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all" tabIndex={-1}>
                                    <Copy className="w-3 h-3" />
                                </button>
                                <button onClick={(e) => handleMoveClick(e, index)} className="p-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all" tabIndex={-1}>
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                                <button onClick={(e) => handleDeleteLine(e, index)} className="p-1 rounded border border-slate-200 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all" tabIndex={-1}>
                                    <Trash2 className="w-3 h-3" />
                                </button>
                             </div>
                        </div>
                    )}
                </div>
                );
            })}
            <div className="flex-1 min-h-[20px] cursor-text" onClick={() => { const newItems = [...items, { status: 'none', text: '' }]; updateParent(newItems); setFocusIndex(newItems.length - 1); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onDropItem(field, items.length); }} data-droppable="true" data-field={field} data-index={items.length} />
        </div>
    );
};

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  lesson,
  dateStr,
  isOpen,
  onClose,
  note,
  allNotes,
  taskTemplates = [],
  onSaveNote,
  onDeleteLesson,
  onPropagate,
  onMoveToNextDay,
  onMoveAllToNext,
  onRemovePropagated,
  onRestoreFromNext,
  onEdit,
  students = [],
  onAddRecoveryNote,
  onUpdateRepeatMode
}) => {
  const isDisposizione = isDisposizioneLesson(lesson);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(lesson.repeatMode || (lesson.weekStart ? 'none' : 'weekly'));
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);

  useEffect(() => {
    if (isOpen && lesson) {
      setRepeatMode(lesson.repeatMode || (lesson.weekStart ? 'none' : 'weekly'));
      setShowRepeatMenu(false);
    }
  }, [isOpen, lesson]);

  const handleSelectRepeatMode = (mode: RepeatMode) => {
    setRepeatMode(mode);
    setShowRepeatMenu(false);
    if (onUpdateRepeatMode) {
      onUpdateRepeatMode(lesson, mode, dateStr);
    }
  };

  const [toCheck, setToCheck] = useState(() => note?.toCheck || '');
  const [checkStatus, setCheckStatus] = useState<NoteStatus>(() => note?.checkStatus || 'pending');
  const [toDo, setToDo] = useState(() => note?.toDo || '');
  const [doStatus, setDoStatus] = useState<NoteStatus>(() => note?.doStatus || 'pending');
  const [misc, setMisc] = useState(() => note?.misc || '');
  const [miscStatus, setMiscStatus] = useState<NoteStatus>(() => note?.miscStatus || 'pending');
  const [lessonType, setLessonType] = useState<LessonNote['type']>(() => note?.type || 'lesson');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [backupContent, setBackupContent] = useState<{ toCheck: string, toDo: string, misc: string } | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [reSynced, setRESynced] = useState(() => note?.reSynced || false);
  const [votoSynced, setVotoSynced] = useState(() => note?.votoSynced || false);
  const [showAbsentPicker, setShowAbsentPicker] = useState(false);
  const [isSubmission, setIsSubmission] = useState(false);
  const [isSubmissionAbsenceMode, setIsSubmissionAbsenceMode] = useState(false);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);

  const hasLocalEditsRef = useRef(false);
  const lastSessionKeyRef = useRef('');
  const lastSyncedNoteSigRef = useRef('');

  const handleToCheckChange = (val: string) => {
    hasLocalEditsRef.current = true;
    setToCheck(val);
  };

  const handleToDoChange = (val: string) => {
    hasLocalEditsRef.current = true;
    setToDo(val);
  };

  const handleMiscChange = (val: string) => {
    hasLocalEditsRef.current = true;
    setMisc(val);
  };

  const suggestionsPool = useMemo(() => {
      if (!isOpen) return [];
      const uniqueLines = new Set<string>();

      // 1. Database Compiti: Analisi per blocchi (separati da riga vuota)
      taskTemplates.forEach(template => {
          if (!template.associatedClassNames || template.associatedClassNames.length === 0 || template.associatedClassNames.includes(lesson.className)) {
              if (template.tasks) {
                  // Analisi avanzata: lo split per riga vuota raggruppa testi correlati
                  const blocks = template.tasks.split(/\n\s*\n/);
                  blocks.forEach(block => {
                      const cleanBlock = block.trim();
                      if (cleanBlock.length > 3) uniqueLines.add(cleanBlock);
                  });
                  // Aggiungiamo anche le singole righe per massimizzare le possibilità di match parziale
                  template.tasks.split('\n').forEach(line => {
                      const clean = cleanTagContent(line);
                      if (clean.length > 5) uniqueLines.add(clean);
                  });
              }
          }
      });

      // 2. Cronologia note: Memoria di tutti i compiti inseriti esternamente al database
      if (allNotes) {
        allNotes.forEach(n => {
            [n.toDo, n.toCheck, n.misc].forEach(block => {
                if (block) {
                    // Analisi blocchi storici
                    const historyBlocks = block.split(/\n\s*\n/);
                    historyBlocks.forEach(hb => {
                        const clean = cleanTagContent(hb);
                        if (clean.length > 3) uniqueLines.add(clean);
                    });
                    // Singole righe storiche
                    block.split('\n').forEach(line => {
                        const clean = cleanTagContent(line);
                        if (clean.length > 5) uniqueLines.add(clean);
                    });
                }
            });
        });
      }

      // Ordiniamo per lunghezza per favorire match più specifici
      return Array.from(uniqueLines).sort((a, b) => a.length - b.length);
  }, [allNotes, taskTemplates, lesson.className, isOpen]);

  const specialTypes = ['assembly', 'skipped_lesson', 'practical_exam', 'oral_exam', 'written_exam'];

  useEffect(() => {
    if (!isOpen) {
      hasLocalEditsRef.current = false;
      lastSessionKeyRef.current = '';
      lastSyncedNoteSigRef.current = '';
      return;
    }

    const sessionKey = `${lesson.id}__${dateStr}`;
    const noteSig = JSON.stringify({
      toCheck: note?.toCheck || '',
      checkStatus: note?.checkStatus || 'pending',
      toDo: note?.toDo || '',
      doStatus: note?.doStatus || 'pending',
      misc: note?.misc || '',
      miscStatus: note?.miscStatus || 'pending',
      type: note?.type || 'lesson',
      reSynced: note?.reSynced || false,
      votoSynced: note?.votoSynced || false
    });

    const isNewSession = lastSessionKeyRef.current !== sessionKey;
    if (isNewSession) {
      hasLocalEditsRef.current = false;
      lastSessionKeyRef.current = sessionKey;
    }

    // Sincronizza i campi all'apertura o quando la nota cambia esternamente (senza sovrascrivere modifiche locali in corso)
    if (isNewSession || (!hasLocalEditsRef.current && lastSyncedNoteSigRef.current !== noteSig)) {
      lastSyncedNoteSigRef.current = noteSig;
      setToCheck(note?.toCheck || '');
      setCheckStatus(note?.checkStatus || 'pending');
      setToDo(note?.toDo || '');
      setDoStatus(note?.doStatus || 'pending');
      setMisc(note?.misc || '');
      setMiscStatus(note?.miscStatus || 'pending');
      setLessonType(note?.type || 'lesson');
      setRESynced(note?.reSynced || false);
      setVotoSynced(note?.votoSynced || false);

      const hasSubmissionKeyword =
        (note?.toDo || '').toUpperCase().includes('CONSEGNA ELABORATI') ||
        (note?.toCheck || '').toUpperCase().includes('CONSEGNA ELABORATI') ||
        (note?.misc || '').toUpperCase().includes('CONSEGNA ELABORATI');

      setIsSubmission(hasSubmissionKeyword);
      if (isNewSession) {
        setBackupContent(null);
        setDragItem(null);
        setShowDeleteConfirm(false);
      }
    }
  }, [isOpen, lesson.id, dateStr, note]);

  if (!isOpen) return null;

  const displayDate = (() => {
    const parts = (dateStr || '').split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const handleClose = () => {
    const hasMeaningfulContent = Boolean(
      toCheck.trim() ||
      toDo.trim() ||
      misc.trim() ||
      lessonType !== 'lesson' ||
      reSynced ||
      votoSynced
    );
    // Salva solo se l'utente ha effettivamente modificato qualcosa nella finestra corrente:
    // impedisce che la semplice apertura/chiusura possa sovrascrivere compiti esistenti.
    if (hasLocalEditsRef.current && (note || hasMeaningfulContent)) {
      const updatedNote: LessonNote = {
        lessonId: lesson.id,
        date: dateStr,
        hour: lesson.hour,
        className: lesson.className,
        subject: lesson.subject,
        toCheck,
        checkStatus,
        toDo,
        doStatus,
        misc,
        miscStatus,
        type: lessonType,
        reSynced,
        votoSynced
      };
      onSaveNote(updatedNote);
    }
    onClose();
  };

  const handleTypeSelect = (type: LessonNote['type']) => {
      hasLocalEditsRef.current = true;
      if (lessonType === type && type !== 'lesson') {
          if (backupContent) {
              onRestoreFromNext(lesson.id, dateStr, backupContent);
              setToCheck(backupContent.toCheck);
              setToDo(backupContent.toDo);
              setBackupContent(null);
          }
          setLessonType('lesson');
      } else {
          setIsSubmission(false); // Reset submission mode when selecting a type
          if (specialTypes.includes(type) && !specialTypes.includes(lessonType)) {
             if (toCheck || toDo) {
                const contentToMove = { toCheck, toDo, misc: '' };
                onMoveAllToNext(lesson.id, dateStr, contentToMove);
                setBackupContent(contentToMove);
                setToCheck(''); setToDo('');
             }
          }
          setLessonType(type);
      }
  };

  const handleAddMiscTag = (tag: string) => {
      hasLocalEditsRef.current = true;
      setMisc(prev => (prev ? prev + '\n' + tag + ' ' : tag + ' '));
  };

  const handleDropItem = (targetField: FieldType, targetIndex: number) => {
      if (!dragItem) return;
      hasLocalEditsRef.current = true;
      const { field: sourceField, index: sourceIndex, text, status } = dragItem;
      if (sourceField === targetField && sourceIndex === targetIndex) {
          setDragItem(null);
          return;
      }

      const removeFromList = (currentVal: string) => {
          const items = currentVal.split('\n');
          items.splice(sourceIndex, 1);
          return items.join('\n');
      };

      const addToList = (currentVal: string) => {
          let prefix = '';
          if (status === 'done') prefix = TAG_DONE + ' ';
          else if (status === 'not_done') prefix = TAG_NOT_DONE + ' ';
          else if (status === 'pending') prefix = TAG_PENDING + ' ';
          const newLine = prefix + text;
          const items = currentVal ? currentVal.split('\n') : [];
          const safeIndex = Math.min(targetIndex, items.length);
          items.splice(safeIndex, 0, newLine);
          return items.join('\n');
      };

      const getVal = (f: FieldType) => (f === 'toCheck' ? toCheck : f === 'toDo' ? toDo : misc);
      const setVal = (f: FieldType, val: string) => (f === 'toCheck' ? setToCheck(val) : f === 'toDo' ? setToDo(val) : setMisc(val));

      if (sourceField === targetField) {
          const currentList = getVal(sourceField).split('\n');
          const [movedItem] = currentList.splice(sourceIndex, 1);
          const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
          currentList.splice(adjustedTargetIndex, 0, movedItem);
          setVal(sourceField, currentList.join('\n'));
      } else {
          setVal(sourceField, removeFromList(getVal(sourceField)));
          setVal(targetField, addToList(getVal(targetField)));
      }
      setDragItem(null);
  };

  const handleLineAction = (content: string, action: 'done' | 'not_done' | 'pending' | 'none', field: FieldType) => {
      if (!content.trim()) return;
      onRemovePropagated(lesson.id, dateStr, content);
      if (action === 'none') return;
      if (field === 'toDo') {
          if (action === 'done') onPropagate(lesson.id, dateStr, 'toCheck', content);
          else onPropagate(lesson.id, dateStr, 'toDo', content);
      } else if (action !== 'done') {
          onPropagate(lesson.id, dateStr, field, content);
      }
  };

  const isInputDisabled = specialTypes.includes(lessonType);
  
  const isSubmissionDetected = useMemo(() => {
    const keyword = 'CONSEGNA ELABORATI';
    return isSubmission || 
           toDo.toUpperCase().includes(keyword) || 
           toCheck.toUpperCase().includes(keyword) || 
           misc.toUpperCase().includes(keyword);
  }, [isSubmission, toDo, toCheck, misc]);

  const canShowAbsentBtn = ['practical_exam', 'oral_exam', 'written_exam'].includes(lessonType) || isSubmissionDetected;

  const handleConfirmAbsents = () => {
      if (absentStudentIds.length > 0 && onAddRecoveryNote && students) {
          const names = students.filter(s => absentStudentIds.includes(s.id)).map(s => s.name);
          // If in submission mode, we pass a specific type to onAddRecoveryNote
          // which will be handled in the parent to put it in the "Misc" section
          onAddRecoveryNote(names, isSubmissionAbsenceMode ? 'submission_submission' : lessonType);
          setAbsentStudentIds([]);
          setShowAbsentPicker(false);
          setIsSubmissionAbsenceMode(false);
      }
  };

  const toggleAbsent = (id: string) => {
      setAbsentStudentIds(prev => 
          prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
  };

  const handleConsegnaElaborati = () => {
    hasLocalEditsRef.current = true;
    const text = "CONSEGNA ELABORATI DA TAV. XX a TAV. YY";
    setToDo(prev => {
        const lines = prev.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (!lines.includes(text)) {
            lines.push(text);
        }
        return lines.join('\n');
    });
    
    // Attiva la modalità consegna per mostrare il tasto giallo degli assenti
    setIsSubmission(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-6 landscape:p-0 animate-magi-fade" onClick={handleClose}>
      <div className={`bg-white shadow-2xl flex flex-col overflow-hidden w-full max-w-[95vw] h-[95vh] sm:h-[90vh] rounded-2xl landscape:w-full landscape:h-full landscape:max-w-full landscape:rounded-none animate-magi-modal`} onClick={(e) => e.stopPropagation()}>
        <div className="bg-primary text-white p-2 sm:p-3 shrink-0 flex flex-col xl:flex-row gap-3">
          <div className="flex items-center justify-between w-full xl:w-auto xl:justify-start xl:gap-4">
             <div className="flex items-center gap-3">
                 <div className="bg-white/10 p-1.5 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
                 <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold leading-none">{lesson.className}</h2>
                        <button onClick={() => onEdit(lesson)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white magi-press"><Pencil className="w-4 h-4" /></button>

                        {/* Repetition Button EXCLUSIVELY for ore a disposizione */}
                        {isDisposizione && (
                          <div className="relative">
                            <button
                              onClick={() => setShowRepeatMenu(prev => !prev)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/25 hover:bg-amber-400/35 active:bg-amber-400/40 border border-amber-300/40 text-amber-100 font-bold text-xs transition-all magi-press shadow-xs"
                              title="Imposta ripetizione ora a disposizione"
                            >
                              <Repeat className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                              <span>Ripetizione:</span>
                              <span className="text-white underline decoration-amber-300 decoration-2 underline-offset-2">
                                {repeatMode === 'weekly' ? 'Ogni settimana' : repeatMode === 'biweekly' ? 'A settimane alterne' : 'Nessuna'}
                              </span>
                              <ChevronDown className="w-3 h-3 text-amber-200 shrink-0" />
                            </button>

                            {showRepeatMenu && (
                              <>
                                <div className="fixed inset-0 z-[70]" onClick={() => setShowRepeatMenu(false)} />
                                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[80] text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                                  <div className="px-3 py-2 border-b border-slate-100">
                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <Repeat className="w-3.5 h-3.5 text-primary" /> Ripetizione Ora a Disposizione
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      Fino al termine delle lezioni dell'anno scolastico
                                    </p>
                                  </div>
                                  <div className="py-1 space-y-1">
                                    <button
                                      onClick={() => handleSelectRepeatMode('weekly')}
                                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${
                                        repeatMode === 'weekly' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        repeatMode === 'weekly' ? 'border-primary bg-primary text-white' : 'border-slate-300'
                                      }`}>
                                        {repeatMode === 'weekly' && <Check className="w-2.5 h-2.5" />}
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold">Ogni settimana</div>
                                        <div className="text-[10px] text-slate-500 font-normal">Ripetuta nella stessa posizione ogni settimana fino alla fine delle lezioni</div>
                                      </div>
                                    </button>

                                    <button
                                      onClick={() => handleSelectRepeatMode('biweekly')}
                                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${
                                        repeatMode === 'biweekly' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        repeatMode === 'biweekly' ? 'border-primary bg-primary text-white' : 'border-slate-300'
                                      }`}>
                                        {repeatMode === 'biweekly' && <Check className="w-2.5 h-2.5" />}
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold">A settimane alterne</div>
                                        <div className="text-[10px] text-slate-500 font-normal">Ripetuta una settimana sì e una no a partire da questa settimana fino alla fine delle lezioni</div>
                                      </div>
                                    </button>

                                    <button
                                      onClick={() => handleSelectRepeatMode('none')}
                                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${
                                        repeatMode === 'none' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        repeatMode === 'none' ? 'border-primary bg-primary text-white' : 'border-slate-300'
                                      }`}>
                                        {repeatMode === 'none' && <Check className="w-2.5 h-2.5" />}
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold">Nessuna ripetizione</div>
                                        <div className="text-[10px] text-slate-500 font-normal">L'ora rimane limitata esclusivamente a questa settimana</div>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                    </div>
                    <p className="text-white/80 text-[11px] -mt-[4px] h-[16px] leading-[16px] font-medium">{displayDate}</p>
                 </div>
             </div>
             <button onClick={handleClose} className="xl:hidden p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors magi-press"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex bg-primary-hover/50 rounded-lg p-0.5 border border-primary-light w-full xl:w-auto gap-0.5 overflow-x-auto no-scrollbar items-center h-[38px]">
               <button onClick={() => handleTypeSelect('lesson')} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${lessonType === 'lesson' ? 'bg-white text-primary shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><Presentation className="w-2.5 h-2.5" /> Lezione</button>
               <button onClick={() => handleTypeSelect('practical_exam')} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${lessonType === 'practical_exam' ? 'bg-emerald-600 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><Triangle className="w-2.5 h-2.5" /> Compito Pratico</button>
               <button onClick={() => handleTypeSelect('oral_exam')} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${lessonType === 'oral_exam' ? 'bg-amber-600 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><BookOpen className="w-2.5 h-2.5" /> Compito di Teoria</button>
               <button onClick={() => handleTypeSelect('written_exam')} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${lessonType === 'written_exam' ? 'bg-rose-600 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><FileText className="w-2.5 h-2.5" /> Compito Scritto</button>
               <button onClick={handleConsegnaElaborati} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${isSubmissionDetected ? 'bg-orange-500 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><FileCheck className="w-2.5 h-2.5" /> Consegna elaborati</button>
               <button onClick={() => handleTypeSelect('assembly')} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${lessonType === 'assembly' ? 'bg-purple-600 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><Users className="w-2.5 h-2.5" /> Assemblea</button>
               <button onClick={() => handleTypeSelect('skipped_lesson')} className={`flex-1 sm:flex-none h-full flex items-center justify-center gap-1.5 px-2.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all ${lessonType === 'skipped_lesson' ? 'bg-slate-600 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><Ban className="w-2.5 h-2.5" /> Saltata</button>
               
               {canShowAbsentBtn && (
                 <div className="flex items-center ml-0.5 pl-0.5 border-l border-white/20">
                    <button 
                     onClick={() => {
                         if (isSubmissionDetected) setIsSubmissionAbsenceMode(true);
                         setShowAbsentPicker(true);
                     }}
                     title="Segna Assenti"
                     className="flex flex-none items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm active:scale-90"
                    >
                        <Users className="w-3 h-3" />
                    </button>
                 </div>
               )}
          </div>
          <button onClick={handleClose} className="hidden xl:flex ml-auto p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors magi-press"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 bg-slate-50 p-2 sm:p-3 min-h-0 overflow-y-auto sm:overflow-hidden flex flex-col gap-2 sm:gap-3">
          
          {/* Repetition Bar in Body EXCLUSIVELY for ore a disposizione */}
          {isDisposizione && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-900 flex items-center gap-1.5">
                    Ora a disposizione
                  </span>
                  <p className="text-[11px] text-amber-700">
                    Ripetizione: <strong className="font-bold underline decoration-amber-400">{repeatMode === 'weekly' ? 'Ogni settimana' : repeatMode === 'biweekly' ? 'A settimane alterne' : 'Nessuna ripetizione (solo questa settimana)'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => handleSelectRepeatMode('weekly')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all magi-press ${
                    repeatMode === 'weekly' ? 'bg-primary text-white shadow-xs' : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  Ogni settimana
                </button>
                <button
                  onClick={() => handleSelectRepeatMode('biweekly')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all magi-press ${
                    repeatMode === 'biweekly' ? 'bg-primary text-white shadow-xs' : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  Settimane alterne
                </button>
                <button
                  onClick={() => handleSelectRepeatMode('none')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all magi-press ${
                    repeatMode === 'none' ? 'bg-primary text-white shadow-xs' : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  Nessuna
                </button>
              </div>
            </div>
          )}

          <div className="flex-none sm:flex-[2] flex-col sm:flex-row flex gap-4 min-h-0">
            <div className={`flex-none sm:flex-1 flex flex-col p-4 rounded-xl border shadow-sm h-auto min-h-[250px] sm:min-h-0 transition-all ${isInputDisabled ? 'bg-slate-100 opacity-60' : 'bg-white border-amber-200'}`}>
              <div className="flex flex-col items-center mb-2 shrink-0">
                <label className="flex items-center gap-2 text-amber-800 font-bold text-lg uppercase tracking-wide"><AlertCircle className="w-5 h-5" />Controllare</label>
              </div>
              <InteractiveList field="toCheck" value={toCheck} onChange={handleToCheckChange} placeholder="Lista controlli..." disabled={isInputDisabled} theme="amber" suggestionsPool={suggestionsPool} onLineAction={(t, a) => handleLineAction(t, a, 'toCheck')} onMoveLine={(t) => onMoveToNextDay(lesson.id, dateStr, 'toCheck', t)} onDragStart={(f, i, t, s) => setDragItem({ field: f, index: i, text: t, status: s })} onDropItem={handleDropItem} isDraggingGlobal={!!dragItem} />
            </div>
            <div className={`flex-none sm:flex-1 flex flex-col p-4 rounded-xl border shadow-sm h-auto min-h-[250px] sm:min-h-0 transition-all ${isInputDisabled ? 'bg-slate-100 opacity-60' : 'bg-white border-blue-200'}`}>
              <div className="flex flex-col items-center mb-2 shrink-0">
                <label className="flex items-center gap-2 text-blue-800 font-bold text-lg uppercase tracking-wide"><CheckSquare className="w-5 h-5" />Fare</label>
              </div>
              <InteractiveList field="toDo" value={toDo} onChange={handleToDoChange} placeholder="Attività da fare..." disabled={isInputDisabled} theme="blue" suggestionsPool={suggestionsPool} onLineAction={(t, a) => handleLineAction(t, a, 'toDo')} onMoveLine={(t) => onMoveToNextDay(lesson.id, dateStr, 'toDo', t)} onDragStart={(f, i, t, s) => setDragItem({ field: f, index: i, text: t, status: s })} onDropItem={handleDropItem} isDraggingGlobal={!!dragItem} />
            </div>
          </div>
          <div className="flex-none sm:flex-1 min-h-[250px] sm:min-h-[150px]">
            <div className="flex flex-col p-4 rounded-xl border shadow-sm h-full bg-white border-violet-200">
               <div className="flex flex-col xl:flex-row items-center justify-between gap-2 mb-2 shrink-0">
                <label className="flex items-center gap-2 text-violet-800 font-bold text-lg uppercase tracking-wide"><StickyNote className="w-5 h-5" />Varie</label>
                <div className="flex flex-wrap justify-center gap-1.5">
                    <button onClick={() => handleAddMiscTag('INTERROGAZIONE:')} className="bg-violet-600 text-white text-[10px] px-2 py-1 rounded shadow-sm magi-press flex items-center gap-1"><GraduationCap className="w-3 h-3" />INTERROGAZIONE</button>
                    <button onClick={() => handleAddMiscTag('RECUPERO PRATICO:')} className="bg-rose-600 text-white text-[10px] px-2 py-1 rounded shadow-sm magi-press flex items-center gap-1"><Triangle className="w-3 h-3" />RECUPERO PRATICO</button>
                    <button onClick={() => handleAddMiscTag('RECUPERO TEORIA:')} className="bg-amber-600 text-white text-[10px] px-2 py-1 rounded shadow-sm magi-press flex items-center gap-1"><BookOpen className="w-3 h-3" />RECUPERO TEORIA</button>
                    <button onClick={() => handleAddMiscTag('RECUPERO SCRITTO:')} className="bg-emerald-600 text-white text-[10px] px-2 py-1 rounded shadow-sm magi-press flex items-center gap-1"><PenTool className="w-3 h-3" />RECUPERO SCRITTO</button>
                    <button onClick={() => handleAddMiscTag('VOTI:')} className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded shadow-sm magi-press flex items-center gap-1"><Check className="w-3 h-3" />INSERIRE VOTI</button>
                </div>
              </div>
              <InteractiveList field="misc" value={misc} onChange={handleMiscChange} placeholder="Note varie..." disabled={false} theme="violet" suggestionsPool={suggestionsPool} onLineAction={(t, a) => handleLineAction(t, a, 'misc')} onMoveLine={(t) => onMoveToNextDay(lesson.id, dateStr, 'misc', t)} onDragStart={(f, i, t, s) => setDragItem({ field: f, index: i, text: t, status: s })} onDropItem={handleDropItem} isDraggingGlobal={!!dragItem} />
            </div>
          </div>
        </div>
        <div className="px-3 sm:px-4 py-0 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
             <div className="hidden sm:block text-xs text-slate-400 italic">Salvataggio automatico</div>
             {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} className="ml-auto text-red-500 text-xs font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-50 magi-press"><Eraser className="w-4 h-4" /> Elimina</button>
             ) : (
                <div className="ml-auto bg-red-50 border border-red-200 rounded-lg p-1 flex items-center gap-2">
                    <span className="text-xs text-red-800 font-medium px-1">Eliminare?</span>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-md magi-press">No</button>
                    <button onClick={() => { onDeleteLesson(lesson.id, dateStr); onClose(); }} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md shadow-sm magi-press">Sì</button>
                </div>
             )}
        </div>

        {/* Modal Assenti */}
        {showAbsentPicker && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-magi-fade" onClick={(e) => { e.stopPropagation(); setShowAbsentPicker(false); setIsSubmissionAbsenceMode(false); }}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-magi-modal flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-primary text-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <Users className="w-5 h-5" />
                           <h3 className="font-bold">Seleziona Alunni Assenti</h3>
                        </div>
                        <button onClick={() => { setShowAbsentPicker(false); setIsSubmissionAbsenceMode(false); }} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-800 text-[10px] font-medium border-b border-amber-100 italic">
                        Gli alunni selezionati riceveranno una nota di recupero automatica nella prossima lezione.
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 gap-2">
                        {students && students.length > 0 ? (
                            [...students].sort((a, b) => a.name.localeCompare(b.name)).map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleAbsent(student.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left uppercase text-sm font-bold ${
                                        absentStudentIds.includes(student.id)
                                            ? 'bg-primary/5 border-primary text-primary shadow-sm'
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="truncate">{student.name}</span>
                                    {absentStudentIds.includes(student.id) ? (
                                        <Check className="w-5 h-5 shrink-0" />
                                    ) : (
                                        <div className="w-5 h-5 border-2 border-slate-200 rounded-full shrink-0" />
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400 italic text-sm">
                                Nessun alunno trovato per questa classe.
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                        <button onClick={() => { setShowAbsentPicker(false); setIsSubmissionAbsenceMode(false); }} className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all magi-press">Annulla</button>
                        <button 
                            onClick={handleConfirmAbsents}
                            disabled={absentStudentIds.length === 0}
                            className="flex-[2] py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 magi-press"
                        >
                            <Check className="w-5 h-5" /> Conferma Assenti ({absentStudentIds.length})
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentModal;
