
import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, ChevronLeft, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { SchoolYear } from '../types';

interface StartDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  schoolYears: SchoolYear[];
  currentDate: Date;
  onSave: (schoolYears: SchoolYear[]) => void;
}

const StartDateModal: React.FC<StartDateModalProps> = ({
  isOpen,
  onClose,
  onBack,
  schoolYears,
  currentDate,
  onSave,
}) => {
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [localYears, setLocalYears] = useState<SchoolYear[]>(() => {
    if (schoolYears.length > 0) return JSON.parse(JSON.stringify(schoolYears));
    return [];
  });

  const [selectedYearId, setSelectedYearId] = useState<string>(() => {
    const dateStr = getLocalDateStr(currentDate);
    const active = schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate);
    return active ? active.id : (schoolYears[0]?.id || '');
  });

  const [newClosure, setNewClosure] = useState({ start: '', end: '', label: '' });

  if (!isOpen) return null;

  const selectedYear = localYears.find(y => y.id === selectedYearId);

  const updateSelectedYear = (updates: Partial<SchoolYear>) => {
    setLocalYears(prev => prev.map(y => y.id === selectedYearId ? { ...y, ...updates } : y));
  };

  const handleAddNewYear = () => {
    const lastYear = localYears[localYears.length - 1];
    let nextStart = new Date();
    if (lastYear) {
        nextStart = new Date(lastYear.startDate);
        nextStart.setFullYear(nextStart.getFullYear() + 1);
    } else {
        nextStart.setMonth(8); nextStart.setDate(11);
    }
    
    const nextEnd = new Date(nextStart);
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    nextEnd.setMonth(5); nextEnd.setDate(15);
    
    const nextSplit = new Date(nextStart);
    nextSplit.setFullYear(nextSplit.getFullYear() + 1);
    nextSplit.setMonth(0); nextSplit.setDate(31);

    const label = `${nextStart.getFullYear()}/${nextStart.getFullYear() + 1}`;
    const newYear: SchoolYear = {
        id: crypto.randomUUID(),
        label,
        startDate: formatDate(nextStart),
        endDate: formatDate(nextEnd),
        splitDate: formatDate(nextSplit),
        isSixDayWeek: lastYear?.isSixDayWeek ?? false,
        closures: []
    };
    setLocalYears([...localYears, newYear]);
    setSelectedYearId(newYear.id);
  };

  const handleRemoveYear = (id: string) => {
      if (localYears.length <= 1) {
          alert("Deve esserci almeno un anno scolastico.");
          return;
      }
      if (confirm("Sei sicuro di voler eliminare questo anno scolastico?")) {
          const newList = localYears.filter(y => y.id !== id);
          setLocalYears(newList);
          setSelectedYearId(newList[0].id);
      }
  };

  const handleAddClosure = () => {
      if (!newClosure.start || !newClosure.end || !selectedYear) return;
      const id = crypto.randomUUID();
      const updatedClosures = [...selectedYear.closures, { 
          id, 
          startDate: newClosure.start, 
          endDate: newClosure.end, 
          label: newClosure.label || 'Chiusura programmata' 
      }];
      updateSelectedYear({ closures: updatedClosures });
      setNewClosure({ start: '', end: '', label: '' });
  };

  const handleRemoveClosure = (id: string) => {
      if (!selectedYear) return;
      updateSelectedYear({ closures: selectedYear.closures.filter(c => c.id !== id) });
  };

  const handleCloseAndSave = () => {
    onSave(localYears);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-2 sm:p-4 animate-magi-fade" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-magi-modal flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 flex items-center gap-2 shrink-0">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1 magi-press">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold flex items-center gap-2 flex-1">
            <Calendar className="w-6 h-6 text-emerald-400" />
            Calendario Scolastico
          </h2>
          <button onClick={handleCloseAndSave} className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Year Selector */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3 shrink-0">
            <div className="flex-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Seleziona Anno</label>
                <select 
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all"
                >
                    {localYears.map(y => (
                        <option key={y.id} value={y.id}>{y.label}</option>
                    ))}
                </select>
            </div>
            <div className="flex gap-2 mt-5">
                <button 
                    onClick={handleAddNewYear}
                    className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all magi-press shadow-sm"
                    title="Aggiungi nuovo anno"
                >
                    <Plus className="w-6 h-6" />
                </button>
                <button 
                    onClick={() => handleRemoveYear(selectedYearId)}
                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl transition-all magi-press shadow-sm"
                    title="Elimina anno selezionato"
                >
                    <Trash2 className="w-6 h-6" />
                </button>
            </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8 overflow-y-auto scrollbar-thin">
          
          {selectedYear ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                    Etichetta Anno (es. 2025/2026)
                    </label>
                    <input 
                        type="text"
                        value={selectedYear.label}
                        onChange={(e) => updateSelectedYear({ label: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-slate-800 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                    Inizio Anno Scolastico
                    </label>
                    <div className="relative group">
                    <Calendar className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 z-10" />
                    <input 
                        type="date" 
                        required
                        value={selectedYear.startDate}
                        onChange={(e) => updateSelectedYear({ startDate: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-slate-800 transition-all"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                    Fine Anno Scolastico
                    </label>
                    <div className="relative group">
                    <Calendar className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 z-10" />
                    <input 
                        type="date" 
                        required
                        value={selectedYear.endDate}
                        onChange={(e) => updateSelectedYear({ endDate: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-slate-800 transition-all"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
                    Inizio 2° Quadrimestre
                    </label>
                    <div className="relative group">
                    <Calendar className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 z-10" />
                    <input 
                        type="date" 
                        required
                        value={selectedYear.splitDate}
                        onChange={(e) => updateSelectedYear({ splitDate: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-slate-800 transition-all"
                    />
                    </div>
                </div>
              </div>

              {/* 6-Day Week Toggle */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                      <div className="text-sm font-bold text-slate-800 uppercase tracking-tight">Settimana Lavorativa</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">
                          {selectedYear.isSixDayWeek ? 'Settimana Lunga (Lun-Sab)' : 'Settimana Corta (Lun-Ven)'}
                      </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSelectedYear({ isSixDayWeek: !selectedYear.isSixDayWeek })}
                    className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        selectedYear.isSixDayWeek ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                      <span className={`${selectedYear.isSixDayWeek ? 'translate-x-6' : 'translate-x-0'}
                          pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
                      />
                  </button>
              </div>

              {/* CHIUSURE PROGRAMMATE SECTION */}
              <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      Chiusure Programmate ({selectedYear.label})
                  </h3>
                  
                  <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-[10px] font-black text-amber-700 uppercase mb-1">Dalla Data</label>
                              <input 
                                type="date" 
                                value={newClosure.start}
                                onChange={(e) => setNewClosure({...newClosure, start: e.target.value})}
                                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300" 
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-amber-700 uppercase mb-1">Alla Data</label>
                              <input 
                                type="date" 
                                value={newClosure.end}
                                onChange={(e) => setNewClosure({...newClosure, end: e.target.value})}
                                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300" 
                              />
                          </div>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Etichetta (es. Vacanze di Natale)" 
                        value={newClosure.label}
                        onChange={(e) => setNewClosure({...newClosure, label: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button 
                        onClick={handleAddClosure}
                        disabled={!newClosure.start || !newClosure.end}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2 magi-press"
                      >
                          <Plus className="w-5 h-5" /> Aggiungi Chiusura
                      </button>
                  </div>

                  {selectedYear.closures.length > 0 && (
                      <div className="space-y-2">
                          {selectedYear.closures.map(closure => (
                              <div key={closure.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-amber-200 transition-colors">
                                  <div className="flex-1 min-w-0">
                                      <div className="font-bold text-slate-800 text-sm truncate">{closure.label}</div>
                                      <div className="text-xs text-slate-500 font-medium">
                                          Dal {new Date(closure.startDate).toLocaleDateString('it-IT')} al {new Date(closure.endDate).toLocaleDateString('it-IT')}
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveClosure(closure.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all magi-press"
                                    title="Rimuovi chiusura"
                                  >
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 font-medium">
                Nessun anno scolastico selezionato.
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 text-slate-400 pt-2 pb-2">
             <CheckCircle2 className="w-4 h-4" />
             <span className="text-[10px] font-bold uppercase tracking-widest italic">Sincronizzazione Automatica</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StartDateModal;
