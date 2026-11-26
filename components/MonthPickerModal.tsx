
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar, School } from 'lucide-react';
import { MONTH_HEADER_STYLES } from '../constants';
import { SchoolYear } from '../types';

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  schoolYears?: SchoolYear[];
}

const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  onSelectDate,
  schoolYears = []
}) => {
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedYear(currentDate.getFullYear());
    }
  }, [isOpen, currentDate]);

  if (!isOpen) return null;

  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const currentDateStr = getLocalDateStr(currentDate);

  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const handleYearChange = (delta: number) => {
    setSelectedYear(prev => prev + delta);
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(selectedYear, monthIndex, 1);
    // Imposta le ore a 12:00 per evitare problemi di fuso orario
    newDate.setHours(12, 0, 0, 0); 
    onSelectDate(newDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header: Year Selector */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
            <button 
                onClick={() => handleYearChange(-1)}
                className="p-2 hover:bg-slate-700 rounded-full transition-colors"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="text-xl font-black tracking-widest flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                {selectedYear}
            </div>

            <button 
                onClick={() => handleYearChange(1)}
                className="p-2 hover:bg-slate-700 rounded-full transition-colors"
            >
                <ChevronRight className="w-6 h-6" />
            </button>
        </div>

        <div className="bg-slate-50 border-b border-slate-200 p-2 flex justify-between items-center">
            {schoolYears && schoolYears.length > 1 ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 pl-2">
                Anni Scolastici:
              </span>
            ) : <span />}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Quick School Years Switcher */}
        {schoolYears && schoolYears.length > 1 && (
          <div className="bg-slate-100/80 p-2.5 border-b border-slate-200 flex flex-wrap gap-1.5 justify-center">
            {schoolYears.map(sy => {
              const isSyActive = currentDateStr >= sy.startDate && currentDateStr <= sy.endDate;
              return (
                <button
                  key={sy.id}
                  onClick={() => {
                    const [y, m, d] = sy.startDate.split('-').map(Number);
                    setSelectedYear(y);
                    const targetDate = new Date(y, m - 1, d, 12, 0, 0);
                    onSelectDate(targetDate);
                    onClose();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 magi-press ${
                    isSyActive 
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30' 
                      : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>A.S. {sy.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Grid Months */}
        <div className="p-4 grid grid-cols-3 gap-3">
            {months.map((month, index) => {
                const style = MONTH_HEADER_STYLES[index];
                const isCurrentMonth = currentDate.getMonth() === index && currentDate.getFullYear() === selectedYear;

                return (
                    <button
                        key={month}
                        onClick={() => handleMonthSelect(index)}
                        className={`
                            py-3 px-1 rounded-xl text-sm font-bold transition-all shadow-sm
                            flex flex-col items-center justify-center gap-1
                            ${style.bg} ${style.text} ${style.border} border-b-4 active:border-b-0 active:translate-y-1
                            ${isCurrentMonth ? 'ring-4 ring-offset-2 ring-slate-400 scale-105' : 'opacity-90 hover:opacity-100 hover:scale-105'}
                        `}
                    >
                        <span>{month.substring(0, 3)}</span>
                    </button>
                );
            })}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
            <button 
                onClick={() => {
                    const now = new Date();
                    setSelectedYear(now.getFullYear());
                    handleMonthSelect(now.getMonth());
                }}
                className="text-xs font-bold text-blue-600 hover:underline uppercase tracking-wider"
            >
                Torna a Oggi
            </button>
        </div>

      </div>
    </div>
  );
};

export default MonthPickerModal;
