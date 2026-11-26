
import React, { useState, useEffect } from 'react';
import { X, Clock, Hourglass, CheckCircle2, Coffee } from 'lucide-react';
import { Recess } from '../types';

interface EditTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  hour: number;
  currentLabel: string;
  onSave: (hour: number, newLabel: string) => void;
  periodInfo?: {
    id: string;
    label?: string;
    startDate: string;
    endDate: string;
  };
  associatedRecess?: Recess | null;
}

const EditTimeModal: React.FC<EditTimeModalProps> = ({
  isOpen,
  onClose,
  hour,
  currentLabel,
  onSave,
  periodInfo,
  associatedRecess,
}) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [duration, setDuration] = useState<60 | 55 | 50 | 45>(60);

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  const addMinutes = (time: string, minutesToAdd: number) => {
      if (!time) return '';
      const [h, m] = time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return ''; // Robustness check
      const totalMinutes = h * 60 + m + minutesToAdd;
      const newH = Math.floor(totalMinutes / 60);
      const newM = totalMinutes % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isOpen && currentLabel) {
      const parts = currentLabel.split('-').map(p => p.trim());
      if (parts.length === 2) {
        setStart(parts[0]);
        setEnd(parts[1]);

        const [h1, m1] = parts[0].split(':').map(Number);
        const [h2, m2] = parts[1].split(':').map(Number);
        
        // Calcola la durata attuale per impostare lo switch corretto
        if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
            const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff === 45) setDuration(45);
            else if (diff === 50) setDuration(50);
            else if (diff === 55) setDuration(55);
            else setDuration(60); 
        }
      }
    }
  }, [isOpen, currentLabel]);

  if (!isOpen) return null;

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = e.target.value;
      setStart(newStart);
      if (newStart) {
          setEnd(addMinutes(newStart, duration));
      }
  };

  const handleDurationChange = (newDuration: 60 | 55 | 50 | 45) => {
      setDuration(newDuration);
      if (start) {
          setEnd(addMinutes(start, newDuration));
      }
  };

  const handleCloseAndSave = () => {
    if (start && end) {
      onSave(hour, `${start} - ${end}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Modifica Orario {hour}° Ora
          </h2>
          <button onClick={handleCloseAndSave} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {periodInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">
                  Orario Provvisorio{periodInfo.label ? `: ${periodInfo.label}` : ''}
                </p>
                <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                  Valido solo dal {formatDisplayDate(periodInfo.startDate)} al {formatDisplayDate(periodInfo.endDate)}. L'orario ordinario non verrà modificato.
                </p>
              </div>
            </div>
          )}
          
          {/* Selettore Durata */}
          <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Hourglass className="w-4 h-4" /> Durata Lezione
                </label>
                <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {duration} min
                </span>
              </div>
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-4 gap-1 shadow-inner">
                  <button
                      type="button"
                      onClick={() => handleDurationChange(60)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all text-center ${
                          duration === 60 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                      60 Min
                  </button>
                  <button
                      type="button"
                      onClick={() => handleDurationChange(55)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all text-center ${
                          duration === 55 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                      55 Min
                  </button>
                  <button
                      type="button"
                      onClick={() => handleDurationChange(50)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all text-center ${
                          duration === 50 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                      50 Min
                  </button>
                  <button
                      type="button"
                      onClick={() => handleDurationChange(45)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all text-center ${
                          duration === 45 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                      45 Min
                  </button>
              </div>

              {associatedRecess && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span>Ricreazione associata ({associatedRecess.duration} min)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800 leading-snug">
                    Durata integrata complessiva: <strong className="font-extrabold text-amber-950">{duration + associatedRecess.duration} min</strong> ({duration} min lezione + {associatedRecess.duration} min ricreazione).
                  </p>
                </div>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inizio</label>
              <input
                type="time"
                value={start}
                onChange={handleStartChange}
                className="w-full p-2 border border-slate-300 rounded-lg text-center font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fine</label>
              <input
                type="time"
                value={end}
                onChange={(e) => {
                  const newEnd = e.target.value;
                  setEnd(newEnd);
                  if (start && newEnd) {
                    const [h1, m1] = start.split(':').map(Number);
                    const [h2, m2] = newEnd.split(':').map(Number);
                    if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
                      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                      if (diff === 50) setDuration(50);
                      else if (diff === 55) setDuration(55);
                      else if (diff === 60) setDuration(60);
                    }
                  }
                }}
                className="w-full p-2 border border-slate-300 rounded-lg text-center font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-slate-400 pt-2">
             <CheckCircle2 className="w-4 h-4" />
             <span className="text-xs font-medium italic">Salvataggio automatico alla chiusura</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EditTimeModal;
