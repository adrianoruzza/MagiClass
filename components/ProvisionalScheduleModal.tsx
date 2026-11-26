import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  Plus,
  Trash2,
  Edit2,
  CalendarClock,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ProvisionalSchedulePeriod } from '../types';

interface ProvisionalScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  provisionalPeriods: ProvisionalSchedulePeriod[];
  currentDate: Date;
  onSave: (periods: ProvisionalSchedulePeriod[]) => void;
  defaultTimeSlots: Record<number, string>;
  maxHours: number;
}

const formatDisplayDate = (dStr: string) => {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (totalMinutes: number): string => {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const addMinutes = (timeStr: string, mins: number): string => {
  if (!timeStr) return '';
  return minutesToTime(timeToMinutes(timeStr) + mins);
};

const ProvisionalScheduleModal: React.FC<ProvisionalScheduleModalProps> = ({
  isOpen,
  onClose,
  onBack,
  provisionalPeriods,
  currentDate: _currentDate,
  onSave,
  defaultTimeSlots,
  maxHours,
}) => {
  const [localPeriods, setLocalPeriods] = useState<ProvisionalSchedulePeriod[]>(() => {
    return Array.isArray(provisionalPeriods) ? JSON.parse(JSON.stringify(provisionalPeriods)) : [];
  });

  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Synchronize local state with props whenever provisionalPeriods or modal visibility changes
  useEffect(() => {
    if (Array.isArray(provisionalPeriods)) {
      setLocalPeriods(JSON.parse(JSON.stringify(provisionalPeriods)));
    }
  }, [provisionalPeriods, isOpen]);

  // Form states for creating / editing period
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for time intervals
  const [customHoursActive, setCustomHoursActive] = useState(false);
  const [isHoursSectionExpanded, setIsHoursSectionExpanded] = useState(false);
  const [formTimeSlots, setFormTimeSlots] = useState<Record<number, string>>({});

  // Direct modal / view for editing time slots of a configured period from the list
  const [directEditingPeriodId, setDirectEditingPeriodId] = useState<string | null>(null);
  const [directTimeSlots, setDirectTimeSlots] = useState<Record<number, string>>({});
  const [expandedPreviewPeriodId, setExpandedPreviewPeriodId] = useState<string | null>(null);

  if (!isOpen) return null;

  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  const hoursList = Array.from({ length: maxHours }, (_, i) => i + 1);

  // Helpers to get fallback slot for an hour
  const getFallbackSlot = (hour: number): string => {
    return defaultTimeSlots[hour] || '08:00 - 09:00';
  };

  const resetForm = () => {
    setEditingId(null);
    setStartDate('');
    setEndDate('');
    setLabel('');
    setFormError(null);
    setCustomHoursActive(false);
    setIsHoursSectionExpanded(false);
    setFormTimeSlots({});
  };

  const handleStartEdit = (p: ProvisionalSchedulePeriod) => {
    setEditingId(p.id);
    setStartDate(p.startDate);
    setEndDate(p.endDate);
    setLabel(p.label || '');
    setFormError(null);

    const hasCustomSlots = !!(p.timeSlots && Object.keys(p.timeSlots).length > 0);
    setCustomHoursActive(hasCustomSlots);
    setIsHoursSectionExpanded(hasCustomSlots);

    // Initialise slots
    const initialSlots: Record<number, string> = {};
    for (let h = 1; h <= maxHours; h++) {
      initialSlots[h] = (p.timeSlots && p.timeSlots[h]) || getFallbackSlot(h);
    }
    setFormTimeSlots(initialSlots);
  };

  const handleToggleCustomHours = () => {
    if (!customHoursActive) {
      // Activating custom hours
      const initialSlots: Record<number, string> = {};
      for (let h = 1; h <= maxHours; h++) {
        initialSlots[h] = formTimeSlots[h] || getFallbackSlot(h);
      }
      setFormTimeSlots(initialSlots);
      setCustomHoursActive(true);
      setIsHoursSectionExpanded(true);
    } else {
      // Disabling custom hours
      setCustomHoursActive(false);
      setIsHoursSectionExpanded(false);
    }
  };

  const handleHourTimeChange = (
    hour: number,
    field: 'start' | 'end',
    val: string,
    isDirect: boolean = false
  ) => {
    const slots = isDirect ? directTimeSlots : formTimeSlots;
    const setter = isDirect ? setDirectTimeSlots : setFormTimeSlots;

    const currentLabel = slots[hour] || getFallbackSlot(hour);
    const [currentStart, currentEnd] = currentLabel.split('-').map(s => s.trim());

    if (field === 'start') {
      const oldDiff = timeToMinutes(currentEnd) - timeToMinutes(currentStart);
      const safeDiff = oldDiff > 0 && oldDiff <= 180 ? oldDiff : 60;
      const newEnd = val ? addMinutes(val, safeDiff) : currentEnd;
      setter(prev => ({
        ...prev,
        [hour]: `${val || '08:00'} - ${newEnd}`,
      }));
    } else {
      setter(prev => ({
        ...prev,
        [hour]: `${currentStart || '08:00'} - ${val || '09:00'}`,
      }));
    }
  };

  const handleSetHourDuration = (
    hour: number,
    durationMins: number,
    isDirect: boolean = false
  ) => {
    const slots = isDirect ? directTimeSlots : formTimeSlots;
    const setter = isDirect ? setDirectTimeSlots : setFormTimeSlots;
    const currentLabel = slots[hour] || getFallbackSlot(hour);
    const [currentStart] = currentLabel.split('-').map(s => s.trim());
    const validStart = currentStart || '08:00';
    const newEnd = addMinutes(validStart, durationMins);
    setter(prev => ({
      ...prev,
      [hour]: `${validStart} - ${newEnd}`,
    }));
  };

  const handleCopyFromOrdinary = (isDirect: boolean = false) => {
    const setter = isDirect ? setDirectTimeSlots : setFormTimeSlots;
    const slots: Record<number, string> = {};
    for (let h = 1; h <= maxHours; h++) {
      slots[h] = getFallbackSlot(h);
    }
    setter(slots);
  };

  const handleBatchSetDuration = (durationMins: number, isDirect: boolean = false) => {
    const slots = isDirect ? directTimeSlots : formTimeSlots;
    const setter = isDirect ? setDirectTimeSlots : setFormTimeSlots;
    const updated: Record<number, string> = { ...slots };
    for (let h = 1; h <= maxHours; h++) {
      const currentLabel = updated[h] || getFallbackSlot(h);
      const [start] = currentLabel.split('-').map(s => s.trim());
      const validStart = start || '08:00';
      updated[h] = `${validStart} - ${addMinutes(validStart, durationMins)}`;
    }
    setter(updated);
  };

  const handleSavePeriod = () => {
    setFormError(null);
    setSaveSuccessMessage(null);
    if (!startDate || !endDate) {
      setFormError('Specificare sia la data di inizio che la data di fine.');
      return;
    }
    if (startDate > endDate) {
      setFormError('La data di inizio deve essere precedente o uguale alla data di fine.');
      return;
    }

    const timeSlotsToSave =
      customHoursActive && Object.keys(formTimeSlots).length > 0
        ? { ...formTimeSlots }
        : undefined;

    let updatedPeriods: ProvisionalSchedulePeriod[];
    if (editingId) {
      updatedPeriods = localPeriods.map(p =>
        p.id === editingId
          ? {
              ...p,
              startDate,
              endDate,
              label: label.trim() || undefined,
              timeSlots: timeSlotsToSave,
            }
          : p
      );
    } else {
      const newPeriod: ProvisionalSchedulePeriod = {
        id: crypto.randomUUID(),
        startDate,
        endDate,
        label: label.trim() || undefined,
        timeSlots: timeSlotsToSave,
      };
      updatedPeriods = [...localPeriods, newPeriod];
    }

    setLocalPeriods(updatedPeriods);
    onSave(updatedPeriods); // Immediate persistence to state & local database
    setSaveSuccessMessage(editingId ? 'Periodo modificato e salvato con successo!' : 'Nuovo periodo creato e salvato con successo!');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
    resetForm();
  };

  const handleDeletePeriod = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo periodo di orario provvisorio?')) {
      const updatedPeriods = localPeriods.filter(p => p.id !== id);
      setLocalPeriods(updatedPeriods);
      onSave(updatedPeriods); // Immediate persistence
      setSaveSuccessMessage('Periodo eliminato e modifiche salvate.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      if (editingId === id) resetForm();
      if (directEditingPeriodId === id) setDirectEditingPeriodId(null);
    }
  };

  const handleOpenDirectHourEditor = (p: ProvisionalSchedulePeriod) => {
    setDirectEditingPeriodId(p.id);
    const slots: Record<number, string> = {};
    for (let h = 1; h <= maxHours; h++) {
      slots[h] = (p.timeSlots && p.timeSlots[h]) || getFallbackSlot(h);
    }
    setDirectTimeSlots(slots);
  };

  const handleSaveDirectHours = () => {
    if (!directEditingPeriodId) return;
    const updatedPeriods = localPeriods.map(p => {
      if (p.id === directEditingPeriodId) {
        return {
          ...p,
          timeSlots: { ...directTimeSlots },
        };
      }
      return p;
    });
    setLocalPeriods(updatedPeriods);
    onSave(updatedPeriods); // Immediate persistence
    setSaveSuccessMessage('Orari del periodo aggiornati e salvati!');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
    setDirectEditingPeriodId(null);
  };

  const handleResetDirectToOrdinary = () => {
    if (!directEditingPeriodId) return;
    const updatedPeriods = localPeriods.map(p => {
      if (p.id === directEditingPeriodId) {
        const { timeSlots: _, ...rest } = p;
        return rest;
      }
      return p;
    });
    setLocalPeriods(updatedPeriods);
    onSave(updatedPeriods); // Immediate persistence
    setSaveSuccessMessage('Orari reimpostati a quelli ordinari!');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
    setDirectEditingPeriodId(null);
  };

  const handleCloseAndSave = () => {
    onSave(localPeriods);
    onClose();
  };

  const handleBackAndSave = () => {
    onSave(localPeriods);
    if (onBack) onBack();
    else onClose();
  };

  const activeDirectPeriod = localPeriods.find(p => p.id === directEditingPeriodId);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-2 sm:p-4 animate-magi-fade"
      onClick={handleCloseAndSave}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-magi-modal flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 sm:p-6 flex items-center gap-2 shrink-0">
          {onBack && (
            <button
              onClick={handleBackAndSave}
              className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1 magi-press"
              title="Indietro"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold flex items-center gap-2 flex-1">
            <CalendarClock className="w-6 h-6 text-amber-400" />
            Orario Provvisorio
          </h2>
          <button
            onClick={handleCloseAndSave}
            className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press"
            title="Salva e chiudi"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 text-slate-800 scrollbar-thin">
          {saveSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-magi-fade shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
          {/* Sub-view: Focused Direct Hour Editor for a specific period */}
          {activeDirectPeriod ? (
            <div className="space-y-4 animate-magi-fade">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setDirectEditingPeriodId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors magi-press"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Torna alla lista periodi
                </button>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
                  Orari Periodo Provvisorio
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 space-y-1 shadow-sm">
                <p className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Intervalli Orari: {activeDirectPeriod.label || 'Periodo selezionato'}
                </p>
                <p className="text-amber-800">
                  Valido dal <strong>{formatDisplayDate(activeDirectPeriod.startDate)}</strong> al{' '}
                  <strong>{formatDisplayDate(activeDirectPeriod.endDate)}</strong>.
                </p>
                <p className="text-amber-700 leading-relaxed">
                  Gli orari impostati saranno utilizzati <strong>esclusivamente</strong> all'interno di questo periodo. L'orario ordinario e gli altri periodi rimarranno invariati.
                </p>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                <span className="font-bold text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Azioni rapide durata:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleBatchSetDuration(45, true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold transition-colors magi-press"
                  >
                    Tutte a 45m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchSetDuration(50, true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold transition-colors magi-press"
                  >
                    Tutte a 50m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchSetDuration(55, true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold transition-colors magi-press"
                  >
                    Tutte a 55m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchSetDuration(60, true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold transition-colors magi-press"
                  >
                    Tutte a 60m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyFromOrdinary(true)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold transition-colors magi-press"
                  >
                    Copia da Ordinario
                  </button>
                </div>
              </div>

              {/* List of Hours to configure */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {hoursList.map(h => {
                  const labelVal = directTimeSlots[h] || getFallbackSlot(h);
                  const [startVal, endVal] = labelVal.split('-').map(s => s.trim());
                  const startMin = timeToMinutes(startVal);
                  const endMin = timeToMinutes(endVal);
                  const diff = endMin - startMin;
                  const isValid = diff > 0;

                  return (
                    <div
                      key={h}
                      className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center shrink-0">
                          {h}°
                        </span>
                        <div>
                          <span className="font-bold text-slate-800 text-sm">
                            {h}ª Ora di Lezione
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isValid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {isValid ? `${diff} min` : 'Orario non valido'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Da</label>
                          <input
                            type="time"
                            value={startVal || ''}
                            onChange={e => handleHourTimeChange(h, 'start', e.target.value, true)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">A</label>
                          <input
                            type="time"
                            value={endVal || ''}
                            onChange={e => handleHourTimeChange(h, 'end', e.target.value, true)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetHourDuration(h, 45, true)}
                            className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                              diff === 45
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Imposta a 45 min"
                          >
                            45m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetHourDuration(h, 50, true)}
                            className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                              diff === 50
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Imposta a 50 min"
                          >
                            50m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetHourDuration(h, 55, true)}
                            className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                              diff === 55
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Imposta a 55 min"
                          >
                            55m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetHourDuration(h, 60, true)}
                            className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                              diff === 60
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Imposta a 60 min"
                          >
                            60m
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions for Direct Hour Editor */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 gap-2">
                <button
                  type="button"
                  onClick={handleResetDirectToOrdinary}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors magi-press flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ripristina Orari Ordinari
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectEditingPeriodId(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors magi-press"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDirectHours}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all magi-press flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Salva Orari Periodo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Informational Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="font-bold text-amber-950 text-sm">
                    Gestione Periodi e Intervalli Orari Indipendenti
                  </p>
                  <p className="leading-relaxed">
                    Nelle settimane comprese nei periodi configurati, le lezioni sono considerate{' '}
                    <strong>provvisorie</strong> e non si propagano alle settimane successive.
                  </p>
                  <p className="leading-relaxed text-amber-900">
                    Inoltre, per ciascun periodo è possibile configurare <strong>orari di inizio e fine specifici per ogni ora di lezione</strong>. Tali intervalli orari saranno attivi solo durante il periodo associato, lasciando l'orario ordinario intatto.
                  </p>
                </div>
              </div>

              {/* Form: Add or Edit Period */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                  {editingId ? (
                    <>
                      <Edit2 className="w-4 h-4 text-amber-600" />
                      Modifica Periodo Provvisorio
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-amber-600" />
                      Aggiungi Nuovo Periodo
                    </>
                  )}
                </h3>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Data di Inizio *
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Data di Fine *
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Etichetta / Descrizione (opzionale)
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Prime due settimane di scuola (orario ridotto)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                </div>

                {/* Independent Time Intervals Section in Form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <div>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          Intervalli Orari delle Lezioni
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Personalizza gli orari di inizio e fine per questo periodo
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleCustomHours}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all magi-press ${
                        customHoursActive
                          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {customHoursActive ? 'Orari Dedicati: Attivi' : 'Usa Orario Ordinario'}
                    </button>
                  </div>

                  {customHoursActive && (
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setIsHoursSectionExpanded(!isHoursSectionExpanded)}
                          className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 magi-press"
                        >
                          {isHoursSectionExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" /> Nascondi dettaglio ore
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" /> Mostra e modifica dettaglio ore (
                              {maxHours} ore)
                            </>
                          )}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyFromOrdinary(false)}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
                          >
                            Copia da Ordinario
                          </button>
                        </div>
                      </div>

                      {isHoursSectionExpanded && (
                        <div className="space-y-2 pt-1 animate-magi-fade">
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 pb-1">
                            <span>Imposta rapidamente durata per tutte le ore:</span>
                            <button
                              type="button"
                              onClick={() => handleBatchSetDuration(45, false)}
                              className="font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              45 min
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBatchSetDuration(50, false)}
                              className="font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              50 min
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBatchSetDuration(55, false)}
                              className="font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              55 min
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBatchSetDuration(60, false)}
                              className="font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              60 min
                            </button>
                          </div>

                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {hoursList.map(h => {
                              const labelVal = formTimeSlots[h] || getFallbackSlot(h);
                              const [startVal, endVal] = labelVal.split('-').map(s => s.trim());
                              const diff = timeToMinutes(endVal) - timeToMinutes(startVal);
                              const isValid = diff > 0;

                              return (
                                <div
                                  key={h}
                                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                                      {h}°
                                    </span>
                                    <span className="font-bold text-slate-700">{h}ª Ora</span>
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        isValid
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {isValid ? `${diff}m` : '!'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="time"
                                      value={startVal || ''}
                                      onChange={e =>
                                        handleHourTimeChange(h, 'start', e.target.value, false)
                                      }
                                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-400 outline-none"
                                    />
                                    <span className="text-slate-400 font-bold">-</span>
                                    <input
                                      type="time"
                                      value={endVal || ''}
                                      onChange={e =>
                                        handleHourTimeChange(h, 'end', e.target.value, false)
                                      }
                                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-400 outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSetHourDuration(h, 45, false)}
                                      className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-amber-50 border border-slate-200 rounded"
                                      title="45 min"
                                    >
                                      45m
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetHourDuration(h, 50, false)}
                                      className="px-1.5 py-1 text-[10px] font-bold bg-white hover:bg-amber-50 border border-slate-200 rounded"
                                      title="50 min"
                                    >
                                      50m
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors magi-press"
                    >
                      Annulla
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSavePeriod}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all magi-press flex items-center gap-1.5"
                  >
                    {editingId ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Aggiorna Periodo
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Aggiungi Periodo
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* List of Configured Periods */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                    Periodi Configurati
                  </h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {localPeriods.length} {localPeriods.length === 1 ? 'periodo' : 'periodi'}
                  </span>
                </div>

                {localPeriods.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 text-xs">
                    <CalendarClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 text-sm mb-1">
                      Nessun periodo configurato
                    </p>
                    <p>
                      L'orario delle lezioni si propaga attualmente a tutte le settimane successive con gli intervalli ordinari. Aggiungi un periodo sopra per isolare orario e orari lezioni.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {localPeriods.map(p => {
                      const isActiveNow = todayStr >= p.startDate && todayStr <= p.endDate;
                      const isFuture = todayStr < p.startDate;
                      const isPast = todayStr > p.endDate;
                      const hasCustomHours = !!(p.timeSlots && Object.keys(p.timeSlots).length > 0);
                      const isPreviewExpanded = expandedPreviewPeriodId === p.id;

                      return (
                        <div
                          key={p.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            editingId === p.id
                              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800 text-sm sm:text-base">
                                  Dal {formatDisplayDate(p.startDate)} al{' '}
                                  {formatDisplayDate(p.endDate)}
                                </span>
                                {isActiveNow && (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Attivo ora
                                  </span>
                                )}
                                {isFuture && (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                                    In programma
                                  </span>
                                )}
                                {isPast && (
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                    Concluso
                                  </span>
                                )}
                              </div>
                              {p.label && (
                                <p className="text-xs text-slate-600 font-medium">{p.label}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenDirectHourEditor(p)}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors magi-press"
                                title="Configura orari lezioni per questo periodo"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(p)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors magi-press"
                                title="Modifica periodo"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePeriod(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors magi-press"
                                title="Elimina periodo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Time Slots Indicator / Quick Expand */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              {hasCustomHours ? (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full text-[11px]">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  Orari dedicati attivi (1ª: {p.timeSlots![1] || getFallbackSlot(1)})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  Orari ordinari
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedPreviewPeriodId(isPreviewExpanded ? null : p.id)
                                }
                                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                              >
                                {isPreviewExpanded ? 'Nascondi orari' : 'Vedi orari'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDirectHourEditor(p)}
                                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-lg transition-colors magi-press"
                              >
                                Modifica orari
                              </button>
                            </div>
                          </div>

                          {/* Expanded Preview of Hours */}
                          {isPreviewExpanded && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs animate-magi-fade">
                              <p className="font-bold text-slate-700 mb-1.5 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Orari lezioni di questo periodo:
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {hoursList.map(h => {
                                  const slotStr =
                                    (p.timeSlots && p.timeSlots[h]) || getFallbackSlot(h);
                                  return (
                                    <div
                                      key={h}
                                      className="bg-white border border-slate-200 rounded-lg p-1.5 flex items-center justify-between"
                                    >
                                      <span className="font-bold text-slate-700">{h}°</span>
                                      <span className="font-mono text-slate-900 font-semibold text-[11px]">
                                        {slotStr}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCloseAndSave}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-rose-900/10 transition-all flex items-center justify-center gap-2 magi-press"
          >
            <CheckCircle2 className="w-5 h-5" />
            Salva e Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProvisionalScheduleModal;
