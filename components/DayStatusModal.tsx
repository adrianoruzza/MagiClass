
import React from 'react';
import { X, Users, UserMinus, Stethoscope, CalendarCheck, School, MapPin } from 'lucide-react';
import { SpecialDayType } from '../types';

interface DayStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  currentStatus: SpecialDayType | null;
  onSave: (type: SpecialDayType | null) => void;
}

const DayStatusModal: React.FC<DayStatusModalProps> = ({
  isOpen,
  onClose,
  date,
  currentStatus,
  onSave,
}) => {
  if (!isOpen) return null;

  const dateStr = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleSelect = (type: SpecialDayType | null) => {
    onSave(type);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold">Stato Giornaliero</h2>
            <p className="text-slate-400 text-sm capitalize">{dateStr}</p>
          </div>
          {/* Tasto X ottimizzato per touch */}
          <button 
            onClick={onClose} 
            className="p-3 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-full transition-all shadow-md active:scale-95 flex-shrink-0"
            aria-label="Chiudi finestra"
          >
            <X className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          
          <button
            onClick={() => handleSelect(null)}
            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
              currentStatus === null 
                ? 'bg-slate-100 border-slate-400 shadow-inner' 
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="p-2 bg-slate-200 rounded-lg text-slate-600">
               <CalendarCheck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">Giornata Normale</div>
              <div className="text-xs text-slate-500">Lezioni regolari</div>
            </div>
            {currentStatus === null && <div className="ml-auto w-3 h-3 bg-green-500 rounded-full"></div>}
          </button>

          <button
            onClick={() => handleSelect('ASSEMBLY')}
            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
              currentStatus === 'ASSEMBLY' 
                ? 'bg-purple-50 border-purple-400 shadow-inner' 
                : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-purple-50/50'
            }`}
          >
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
               <Users className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">Assemblea Istituto</div>
              <div className="text-xs text-slate-500">Attività sospese</div>
            </div>
            {currentStatus === 'ASSEMBLY' && <div className="ml-auto w-3 h-3 bg-purple-500 rounded-full"></div>}
          </button>

          <button
            onClick={() => handleSelect('PERMISSION')}
            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
              currentStatus === 'PERMISSION' 
                ? 'bg-amber-50 border-amber-400 shadow-inner' 
                : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
            }`}
          >
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
               <UserMinus className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">Giorno di Permesso</div>
              <div className="text-xs text-slate-500">Assenza programmata</div>
            </div>
            {currentStatus === 'PERMISSION' && <div className="ml-auto w-3 h-3 bg-amber-500 rounded-full"></div>}
          </button>

          <button
            onClick={() => handleSelect('SICK')}
            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
              currentStatus === 'SICK' 
                ? 'bg-red-50 border-red-400 shadow-inner' 
                : 'bg-white border-slate-200 hover:border-red-200 hover:bg-red-50/50'
            }`}
          >
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
               <Stethoscope className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">Giorno di Malattia</div>
              <div className="text-xs text-slate-500">Assenza per salute</div>
            </div>
            {currentStatus === 'SICK' && <div className="ml-auto w-3 h-3 bg-red-500 rounded-full"></div>}
          </button>

          <button
            onClick={() => handleSelect('TRIP')}
            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
              currentStatus === 'TRIP' 
                ? 'bg-blue-50 border-blue-400 shadow-inner' 
                : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/50'
            }`}
          >
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
               <MapPin className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">Visita Guidata</div>
              <div className="text-xs text-slate-500">Uscita o Viaggio d'istruzione</div>
            </div>
            {currentStatus === 'TRIP' && <div className="ml-auto w-3 h-3 bg-blue-500 rounded-full"></div>}
          </button>

          <button
            onClick={() => handleSelect('SCHOOL_CLOSED')}
            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
              currentStatus === 'SCHOOL_CLOSED' 
                ? 'bg-slate-200 border-slate-500 shadow-inner' 
                : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-100'
            }`}
          >
            <div className="p-2 bg-slate-200 rounded-lg text-slate-700">
               <School className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-800">Chiusura Scuola</div>
              <div className="text-xs text-slate-500">Festività o Chiusura</div>
            </div>
            {currentStatus === 'SCHOOL_CLOSED' && <div className="ml-auto w-3 h-3 bg-slate-600 rounded-full"></div>}
          </button>

        </div>
      </div>
    </div>
  );
};

export default DayStatusModal;
