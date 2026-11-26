import React, { useState } from 'react';
import { X, Coffee, Plus, Trash2, CheckCircle2, ChevronLeft, Link2, Unlink } from 'lucide-react';
import { Recess } from '../types';

interface RecessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  recesses: Recess[];
  maxHours: number;
  durations?: Record<number, number>;
  timeSlots?: Record<number, string>;
  onSave: (recesses: Recess[]) => void;
}

const addMinutes = (time: string, minutesToAdd: number) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const totalMinutes = h * 60 + m + minutesToAdd;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

const RecessModal: React.FC<RecessModalProps> = ({
  isOpen,
  onClose,
  onBack,
  recesses,
  maxHours,
  durations = {},
  timeSlots = {},
  onSave,
}) => {
  const [localRecesses, setLocalRecesses] = useState<Recess[]>(() => JSON.parse(JSON.stringify(recesses)));

  if (!isOpen) return null;

  const hoursArray = Array.from({ length: maxHours }, (_, i) => i + 1);

  const handleAddRecess = () => {
    const newId = crypto.randomUUID();
    // Pre-imposta per default dopo la 2ª ora, 10 min, associata alla 3ª ora
    const defaultAfter = Math.min(2, maxHours - 1);
    const defaultAssoc = defaultAfter + 1 <= maxHours ? defaultAfter + 1 : null;
    setLocalRecesses([...localRecesses, { id: newId, afterHour: defaultAfter, duration: 10, associatedHour: defaultAssoc }]);
  };

  const handleRemoveRecess = (id: string) => {
    setLocalRecesses(localRecesses.filter(r => r.id !== id));
  };

  const handleChange = (id: string, field: keyof Recess, value: any) => {
    setLocalRecesses(prev => prev.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const handleCloseAndSave = () => {
    onSave(localRecesses);
    onClose();
  };

  const getRecessTimeRange = (recess: Recess) => {
    const hourSlot = timeSlots[recess.afterHour];
    if (hourSlot) {
      const parts = hourSlot.split('-').map(s => s.trim());
      const startTime = parts[1];
      if (startTime) {
        const endTime = addMinutes(startTime, recess.duration);
        return { start: startTime, end: endTime };
      }
    }
    return { start: '--:--', end: '--:--' };
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-magi-fade">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 sm:p-5 flex items-center gap-2 shrink-0">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1">
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 flex-1">
            <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            Gestione Ricreazione
          </h2>
          <button onClick={handleCloseAndSave} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Configura le pause di ricreazione. Puoi posizionarle dopo una specifica ora, sceglierne la durata e <strong>associarle a un'ora di lezione</strong> per integrarne la durata nella timeline e nell'orario.
          </p>

          <div className="space-y-3.5">
            {localRecesses.map((recess, idx) => {
              const timeRange = getRecessTimeRange(recess);
              const assocHour = recess.associatedHour;
              const lessonDuration = assocHour ? (durations[assocHour] || 60) : null;
              const totalIntegratedDuration = (assocHour && lessonDuration) ? lessonDuration + recess.duration : null;

              return (
                <div key={recess.id} className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                  
                  {/* Riga Superiore: Titolo Pausa + Orario Calcolato + Elimina */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                        <Coffee className="w-4 h-4 text-amber-500" />
                        Pausa #{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono font-bold text-[11px] sm:text-xs">
                        {timeRange.start} – {timeRange.end}
                      </span>
                    </div>

                    <button 
                      onClick={() => handleRemoveRecess(recess.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Elimina ricreazione"
                    >
                      <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </button>
                  </div>

                  {/* Configurazione: Dopo l'ora e Durata */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Collocazione (dopo l'ora)
                      </label>
                      <select 
                        value={recess.afterHour}
                        onChange={(e) => handleChange(recess.id, 'afterHour', parseInt(e.target.value, 10))}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {hoursArray.slice(0, -1).map(h => (
                          <option key={h} value={h}>Dopo la {h}ª Ora</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Durata pausa
                      </label>
                      <select 
                        value={recess.duration}
                        onChange={(e) => handleChange(recess.id, 'duration', parseInt(e.target.value, 10))}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value={10}>10 minuti</option>
                        <option value={20}>20 minuti</option>
                        <option value={30}>30 minuti</option>
                      </select>
                    </div>
                  </div>

                  {/* Associazione a Ora di Lezione */}
                  <div className="pt-1">
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5 text-blue-600" />
                        Associa a un'ora di lezione
                      </span>
                      {assocHour && (
                        <button
                          type="button"
                          onClick={() => handleChange(recess.id, 'associatedHour', null)}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 normal-case"
                        >
                          <Unlink className="w-3 h-3" /> Rimuovi associazione
                        </button>
                      )}
                    </label>

                    <select 
                      value={assocHour ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        handleChange(recess.id, 'associatedHour', val);
                      }}
                      className={`w-full p-2 border rounded-xl text-xs sm:text-sm font-bold outline-none transition-colors ${
                        assocHour 
                          ? 'bg-blue-50/60 border-blue-300 text-blue-900 focus:ring-2 focus:ring-blue-500' 
                          : 'bg-white border-slate-300 text-slate-600 focus:ring-2 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Nessuna associazione</option>
                      {hoursArray.map(h => (
                        <option key={h} value={h}>
                          {h}ª Ora di lezione
                        </option>
                      ))}
                    </select>

                    {/* Stato Associazione e Durata Integrata */}
                    {assocHour ? (
                      <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-900 text-xs">
                        <div className="flex items-center justify-between font-bold">
                          <span>Associata a: <strong>{assocHour}ª Ora</strong></span>
                          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-[11px] font-mono">
                            {totalIntegratedDuration} min totali
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-blue-800 leading-tight">
                          Durata integrata: {lessonDuration} min lezione + {recess.duration} min ricreazione = <strong>{totalIntegratedDuration} min complessivi</strong>.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400 italic">
                        Nessuna associazione: la ricreazione non altera la durata nominale delle ore.
                      </p>
                    )}
                  </div>

                </div>
              );
            })}

            {localRecesses.length === 0 && (
              <div className="text-center py-8 text-slate-400 italic text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                Nessuna ricreazione impostata.
              </div>
            )}
          </div>

          <button 
            onClick={handleAddRecess}
            className="w-full mt-2 py-3 border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 magi-press"
          >
            <Plus className="w-4 h-4" /> Aggiungi Pausa Ricreazione
          </button>
          
          <div className="flex items-center justify-center gap-2 text-slate-400 pt-3">
             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
             <span className="text-xs font-medium italic">Salvataggio e ricalcolo automatico alla chiusura</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RecessModal;
