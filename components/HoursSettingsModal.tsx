
import React, { useState } from 'react';
import { X, Clock, CheckCircle2, ChevronLeft } from 'lucide-react';

interface HoursSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  currentMaxHours: number;
  onSave: (hours: number) => void;
}

const HoursSettingsModal: React.FC<HoursSettingsModalProps> = ({
  isOpen,
  onClose,
  onBack,
  currentMaxHours,
  onSave,
}) => {
  const [selectedHours, setSelectedHours] = useState(currentMaxHours);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedHours);
    onClose();
  };

  const options = Array.from({ length: 9 }, (_, i) => i + 4); // Da 4 a 12 ore

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold flex items-center gap-2 flex-1">
            <Clock className="w-6 h-6 text-blue-400" />
            Configurazione Ore
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-slate-500 mb-4">
            Imposta il numero massimo di ore di lezione giornaliere visualizzate nel diario.
          </p>

          <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ore Giornaliere</label>
              <div className="grid grid-cols-3 gap-2">
                  {options.map(num => (
                      <button
                        key={num}
                        onClick={() => setSelectedHours(num)}
                        className={`py-3 rounded-xl font-bold border-2 transition-all ${
                            selectedHours === num 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                          {num} Ore
                      </button>
                  ))}
              </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-200"
          >
            Salva Impostazioni
          </button>
          
          <div className="flex items-center justify-center gap-2 text-slate-400 pt-4">
             <CheckCircle2 className="w-4 h-4" />
             <span className="text-xs font-medium italic">Modifica applicata immediatamente</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HoursSettingsModal;
