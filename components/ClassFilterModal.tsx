
import React from 'react';
import { X, Users, Filter, Check } from 'lucide-react';
import { ClassEntity } from '../types';

interface ClassFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassEntity[];
  selectedClass: string | null;
  onSelect: (className: string | null) => void;
}

const ClassFilterModal: React.FC<ClassFilterModalProps> = ({
  isOpen,
  onClose,
  classes,
  selectedClass,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-magi-backdrop" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-magi-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Filter className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Filtro Classi</h2>
          </div>
          <p className="text-white/70 text-sm font-medium">
            Seleziona una classe per evidenziare solo le sue ore nell'orario.
          </p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => {
                onSelect(null);
                onClose();
              }}
              className={`flex items-center justify-between p-4 rounded-2xl transition-all font-bold text-lg magi-press ${
                selectedClass === null 
                ? 'bg-primary text-white shadow-lg' 
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5" />
                <span>Mostra Tutte</span>
              </div>
              {selectedClass === null && <Check className="w-5 h-5" />}
            </button>

            <div className="h-px bg-slate-100 my-2"></div>

            {[...classes].sort((a, b) => a.name.localeCompare(b.name)).map((cls) => {
              const isSelected = selectedClass === cls.name;
              return (
                <button
                  key={cls.id}
                  onClick={() => {
                    onSelect(cls.name);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all font-bold text-lg magi-press ${
                    isSelected 
                    ? `shadow-lg ring-2 ring-primary ring-offset-2 ${cls.colorStyles}` 
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-3 h-3 rounded-full ${cls.colorStyles.split(' ').find(s => s.startsWith('border-'))?.replace('border-', 'bg-') || 'bg-slate-300'}`}
                    ></div>
                    <span>{cls.name}</span>
                  </div>
                  {isSelected && <Check className="w-5 h-5" />}
                </button>
              );
            })}
          </div>

          {classes.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Users className="w-12 h-12 opacity-20" />
              <p className="font-bold">Nessuna classe configurata</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all magi-press shadow-sm"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassFilterModal;
