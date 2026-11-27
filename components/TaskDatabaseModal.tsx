
import React, { useState, useEffect, useRef } from 'react';
import { X, ClipboardList, Plus, Trash2, CheckCircle2, ChevronLeft, Maximize2, Minimize2, Check } from 'lucide-react';
import { TaskTemplate, ClassEntity } from '../types';

interface TaskDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  templates: TaskTemplate[];
  classes: ClassEntity[];
  onSave: (templates: TaskTemplate[]) => void;
  initialExpandedTemplateId?: string | null;
  initialScrollTop?: number;
  initialExpandedScrollTop?: number;
  sessionRestoreKey?: number;
  onExpandedTemplateChange?: (templateId: string | null) => void;
  onScrollPositionChange?: (key: 'taskDatabaseModal' | 'taskDatabaseExpanded', scrollTop: number) => void;
}

const TaskDatabaseModal: React.FC<TaskDatabaseModalProps> = ({
  isOpen,
  onClose,
  onBack,
  templates,
  classes,
  onSave,
  initialExpandedTemplateId = null,
  initialScrollTop = 0,
  initialExpandedScrollTop = 0,
  sessionRestoreKey = 0,
  onExpandedTemplateChange,
  onScrollPositionChange
}) => {
  const [localTemplates, setLocalTemplates] = useState<TaskTemplate[]>(() => JSON.parse(JSON.stringify(templates || [])));
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(initialExpandedTemplateId);
  const hasLocalEditsRef = useRef(false);
  const wasOpenRef = useRef(isOpen);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const expandedScrollRef = useRef<HTMLDivElement | null>(null);
  const lastRestoreKeyRef = useRef<number>(0);

  const updateExpandedTemplateId = (id: string | null) => {
    setExpandedTemplateId(id);
    if (onExpandedTemplateChange) {
      onExpandedTemplateChange(id);
    }
  };

  useEffect(() => {
    if (!sessionRestoreKey || sessionRestoreKey === lastRestoreKeyRef.current) return;
    lastRestoreKeyRef.current = sessionRestoreKey;
    if (initialExpandedTemplateId && (templates || []).some(t => t.id === initialExpandedTemplateId)) {
      setExpandedTemplateId(initialExpandedTemplateId);
    } else {
      setExpandedTemplateId(null);
    }
  }, [sessionRestoreKey, initialExpandedTemplateId, templates]);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen) {
      hasLocalEditsRef.current = false;
      setLocalTemplates(JSON.parse(JSON.stringify(templates || [])));
      setExpandedTemplateId(null);
      return;
    }

    if (justOpened || !hasLocalEditsRef.current) {
      hasLocalEditsRef.current = false;
      setLocalTemplates(JSON.parse(JSON.stringify(templates || [])));
      if (justOpened) {
        const validRestoredId =
          initialExpandedTemplateId && (templates || []).some(t => t.id === initialExpandedTemplateId)
            ? initialExpandedTemplateId
            : null;
        setExpandedTemplateId(validRestoredId);
      }
    }
  }, [isOpen, templates, initialExpandedTemplateId]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      if (listScrollRef.current && initialScrollTop > 0) {
        listScrollRef.current.scrollTop = initialScrollTop;
      }
      if (expandedScrollRef.current && initialExpandedScrollTop > 0) {
        expandedScrollRef.current.scrollTop = initialExpandedScrollTop;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, expandedTemplateId, sessionRestoreKey]);

  if (!isOpen) return null;

  const handleAddTemplate = () => {
    hasLocalEditsRef.current = true;
    const newId = crypto.randomUUID();
    const newTemplate: TaskTemplate = { 
        id: newId, 
        title: 'Nuovo Gruppo Compiti', 
        tasks: '', 
        associatedClassNames: [] 
    };
    setLocalTemplates([...localTemplates, newTemplate]);
  };

  const handleRemoveTemplate = (id: string) => {
    if (confirm('Eliminare questo gruppo di compiti?')) {
        hasLocalEditsRef.current = true;
        setLocalTemplates(localTemplates.filter(t => t.id !== id));
        if (expandedTemplateId === id) {
          updateExpandedTemplateId(null);
        }
    }
  };

  const updateTemplate = (id: string, field: keyof TaskTemplate, value: any) => {
    hasLocalEditsRef.current = true;
    setLocalTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const toggleClassForTemplate = (id: string, className: string) => {
      hasLocalEditsRef.current = true;
      setLocalTemplates(prev => prev.map(t => {
          if (t.id !== id) return t;
          const classNames = t.associatedClassNames || [];
          if (classNames.includes(className)) {
              return { ...t, associatedClassNames: classNames.filter(c => c !== className) };
          } else {
              return { ...t, associatedClassNames: [...classNames, className] };
          }
      }));
  };

  const handleCloseAction = (isBack: boolean = false) => {
    if (hasLocalEditsRef.current || JSON.stringify(localTemplates) !== JSON.stringify(templates || [])) {
      onSave(localTemplates);
    }
    if (expandedTemplateId !== null) {
      updateExpandedTemplateId(null);
    }
    if (isBack && onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const renderTemplateCard = (template: TaskTemplate) => (
    <div key={template.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all animate-magi-fade">
      <div className="flex items-center justify-between mb-4 gap-4">
        <input
          type="text"
          value={template.title}
          onChange={(e) => updateTemplate(template.id, 'title', e.target.value)}
          placeholder="Esempio: Compiti Classi Prime"
          className="flex-1 bg-transparent border-b-2 border-slate-100 focus:border-amber-400 outline-none font-black text-slate-800 text-lg py-1 transition-all"
        />
        <div className="flex items-center gap-1">
          <button 
            onClick={() => updateExpandedTemplateId(template.id)}
            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all magi-press"
            title="Espandi editing"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleRemoveTemplate(template.id)}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all magi-press"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
          <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Elenco Compiti (riga vuota = compito diverso)</label>
              <textarea
                  value={template.tasks}
                  onChange={(e) => updateTemplate(template.id, 'tasks', e.target.value)}
                  placeholder="TAV.1 - Proiezioni ortogonali...&#10;&#10;TAV.2 - Sezioni..."
                  rows={4}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-200 focus:bg-white transition-all resize-none"
              />
          </div>

          <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Classi Associate</label>
                <div className="flex flex-wrap gap-1.5">
                    {classes.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Crea delle classi nel menu "Classi e Materie"</span>
                    ) : (
                        classes.map(cls => {
                            const isSelected = (template.associatedClassNames || []).includes(cls.name);
                            return (
                                <button
                                    key={cls.id}
                                    onClick={() => toggleClassForTemplate(template.id, cls.name)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 magi-press
                                        ${isSelected 
                                            ? 'bg-slate-800 border-slate-900 text-white shadow-md' 
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    {isSelected && <Check className="w-3 h-3" strokeWidth={4} />}
                                    {cls.name}
                                </button>
                            );
                        })
                    )}
                </div>
              </div>
          </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] relative">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex items-center gap-2 shrink-0">
          {onBack && (
            <button onClick={() => handleCloseAction(true)} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1 magi-press">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold flex items-center gap-2 flex-1">
            <ClipboardList className="w-6 h-6 text-amber-400" />
            Database Compiti
          </h2>
          <button onClick={() => handleCloseAction(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div
          ref={listScrollRef}
          onScroll={onScrollPositionChange ? (e) => onScrollPositionChange('taskDatabaseModal', e.currentTarget.scrollTop) : undefined}
          className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-thin bg-slate-50"
        >
          <p className="text-sm text-slate-500 font-medium">
            Configura dei set di compiti predefiniti. Inserisci una riga vuota per distinguere compiti diversi.
          </p>

          <div className="space-y-4">
            {localTemplates.map((template) => renderTemplateCard(template))}

            {localTemplates.length === 0 && (
              <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 animate-magi-fade">
                 <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                 <p className="text-slate-400 font-bold">Nessun gruppo di compiti creato.</p>
                 <button 
                    onClick={handleAddTemplate}
                    className="mt-4 px-6 py-2 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 transition-all magi-press"
                 >
                    Inizia ora
                 </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleAddTemplate}
            className="w-full mt-4 py-4 border-2 border-dashed border-amber-200 text-amber-600 font-bold rounded-2xl hover:bg-amber-50 transition-colors flex items-center justify-center gap-2 magi-press"
          >
            <Plus className="w-5 h-5" /> Aggiungi Nuovo Gruppo
          </button>
        </div>
        
        {/* Expanded View Modal Overlay */}
        {expandedTemplateId && (
            <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="bg-slate-800 text-white p-5 flex items-center justify-between shrink-0">
                    <h3 className="font-bold flex items-center gap-2">
                        <Maximize2 className="w-5 h-5 text-amber-400" />
                        Editor Espanso
                    </h3>
                    <button 
                        onClick={() => updateExpandedTemplateId(null)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-all magi-press"
                    >
                        <Minimize2 className="w-6 h-6" />
                    </button>
                </div>
                <div
                  ref={expandedScrollRef}
                  onScroll={onScrollPositionChange ? (e) => onScrollPositionChange('taskDatabaseExpanded', e.currentTarget.scrollTop) : undefined}
                  className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto bg-slate-50"
                >
                    {localTemplates.filter(t => t.id === expandedTemplateId).map(template => (
                        <React.Fragment key={template.id}>
                            <div className="shrink-0">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Titolo Gruppo</label>
                                <input
                                    type="text"
                                    value={template.title}
                                    onChange={(e) => updateTemplate(template.id, 'title', e.target.value)}
                                    className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl focus:border-amber-400 outline-none font-black text-slate-800 text-xl shadow-sm transition-all"
                                />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contenuto Compiti (riga vuota = compito diverso)</label>
                                <textarea
                                    value={template.tasks}
                                    onChange={(e) => updateTemplate(template.id, 'tasks', e.target.value)}
                                    className="flex-1 w-full p-6 bg-white border-2 border-slate-200 rounded-3xl text-lg font-medium text-slate-700 outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-400 transition-all resize-none shadow-sm"
                                    placeholder="Scrivi qui i compiti..."
                                />
                            </div>
                            <div className="shrink-0 space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Classi Associate</label>
                                    <div className="flex flex-wrap gap-2">
                                        {classes.map(cls => {
                                            const isSelected = (template.associatedClassNames || []).includes(cls.name);
                                            return (
                                                <button
                                                    key={cls.id}
                                                    onClick={() => toggleClassForTemplate(template.id, cls.name)}
                                                    className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 magi-press
                                                        ${isSelected 
                                                            ? 'bg-slate-800 border-slate-900 text-white shadow-lg scale-105' 
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100'
                                                        }
                                                    `}
                                                >
                                                    {isSelected && <Check className="w-4 h-4" strokeWidth={4} />}
                                                    {cls.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
                <div className="p-4 bg-white border-t border-slate-100 flex justify-center">
                    <button 
                        onClick={() => setExpandedTemplateId(null)}
                        className="bg-slate-800 text-white px-8 py-3 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-900 transition-all magi-press shadow-lg"
                    >
                        Chiudi Editor
                    </button>
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-center">
             <div className="flex items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Archiviazione Locale MagiClass</span>
             </div>
        </div>

      </div>
    </div>
  );
};

export default TaskDatabaseModal;
