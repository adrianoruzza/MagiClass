import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Clock, 
  GraduationCap, 
  Calendar, 
  ChevronDown, 
  Briefcase, 
  Hourglass, 
  AlertTriangle,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { 
  SchoolYear, 
  Lesson, 
  LessonNote, 
  SpecialDay, 
  SchoolClosure, 
  ProvisionalSchedulePeriod,
  ClassEntity
} from '../types';
import { getLocalDateString } from '../utils/provisionalSchedule';
import { calculateSchoolYearStats } from '../utils/remainingHoursCalculation';

interface RemainingHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolYears: SchoolYear[];
  schedule: Lesson[];
  lessonNotes: LessonNote[];
  specialDays: SpecialDay[];
  schoolClosures: SchoolClosure[];
  timeSlots: Record<number, string>;
  provisionalPeriods: ProvisionalSchedulePeriod[];
  maxHours: number;
  initialSchoolYearId?: string;
  classes?: ClassEntity[];
  // Optional backward-compat props
  remainingHours?: Record<string, number>;
  remainingDays?: number;
  endDate?: Date;
  schoolEndDate?: Date;
}

const formatDateDisplay = (dateStr?: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const RemainingHoursModal: React.FC<RemainingHoursModalProps> = ({ 
  isOpen, 
  onClose, 
  schoolYears,
  schedule,
  lessonNotes,
  specialDays,
  schoolClosures,
  timeSlots,
  provisionalPeriods,
  maxHours,
  initialSchoolYearId
}) => {
  // Trova l'anno scolastico in corso in base alla data locale odierna
  const currentSchoolYear = useMemo(() => {
    if (!schoolYears || schoolYears.length === 0) return null;
    const todayStr = getLocalDateString(new Date());
    return schoolYears.find(y => todayStr >= y.startDate && todayStr <= y.endDate) || schoolYears[0];
  }, [schoolYears]);

  // Stato per l'anno scolastico selezionato nel menu
  const [selectedYearId, setSelectedYearId] = useState<string>(() => {
    return initialSchoolYearId || currentSchoolYear?.id || (schoolYears && schoolYears[0]?.id) || '';
  });

  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const preferredId = initialSchoolYearId || currentSchoolYear?.id || (schoolYears && schoolYears[0]?.id) || '';
      setSelectedYearId(preferredId);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialSchoolYearId, currentSchoolYear, schoolYears]);

  // Oggetto anno scolastico selezionato
  const selectedYear = useMemo(() => {
    if (!schoolYears || schoolYears.length === 0) return null;
    return schoolYears.find(y => y.id === selectedYearId) || currentSchoolYear || schoolYears[0];
  }, [schoolYears, selectedYearId, currentSchoolYear]);

  // Calcolo statistiche per l'anno selezionato (ore svolte, residue, 1° e 2° quadrimestre)
  const stats = useMemo(() => {
    if (!selectedYear) {
      return {
        classes: {},
        disposizione: { heldHours: 0, remainingHours: 0, totalHours: 0 },
        buco: { heldHours: 0, remainingHours: 0, totalHours: 0 },
        daysHeld: 0,
        daysRemaining: 0,
        totalDays: 0,
        totalClassHoursHeld: 0,
        totalClassHoursRemaining: 0,
        totalClassHours: 0,
        totalClassHoursQ1: 0,
        totalClassHoursQ2: 0,
        totalGeneralHoursHeld: 0,
        totalGeneralHoursRemaining: 0,
        totalGeneralHours: 0,
        hasActiveProvisionalPeriod: false,
        startDate: new Date(),
        endDate: new Date(),
        mode: 'current' as const,
        classCounts: {},
        disposizioneHours: 0,
        bucoHours: 0,
        remainingDays: 0
      };
    }

    return calculateSchoolYearStats({
      selectedYear,
      allSchoolYears: schoolYears,
      schedule,
      lessonNotes,
      specialDays,
      schoolClosures,
      defaultTimeSlots: timeSlots,
      provisionalPeriods,
      maxHours
    });
  }, [
    selectedYear, 
    schoolYears, 
    schedule, 
    lessonNotes, 
    specialDays, 
    schoolClosures, 
    timeSlots, 
    provisionalPeriods, 
    maxHours
  ]);

  if (!isOpen) return null;

  const sortedClasses = Object.values(stats.classes).sort((a, b) => 
    a.className.localeCompare(b.className, undefined, { numeric: true })
  );

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-2 sm:p-4 animate-magi-fade" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-magi-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-primary text-white p-3.5 sm:p-4 shrink-0 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black truncate leading-tight">
                Riepilogo Ore e Quadrimestri
              </h2>
              <p className="text-[10px] sm:text-xs text-white/80 font-medium truncate">
                Ore svolte, residue, 1° e 2° quadrimestre
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors magi-press shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Selettore Anno Scolastico */}
        {schoolYears && schoolYears.length > 0 && (
          <div className="px-3.5 sm:px-5 pt-3 pb-1 shrink-0">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2 sm:p-2.5 shadow-xs">
              <label htmlFor="school-year-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 pl-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Anno Scolastico:</span>
              </label>
              <div className="relative">
                <select
                  id="school-year-select"
                  value={selectedYear?.id || ''}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1 pr-7 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
                >
                  {schoolYears.map(y => {
                    const isCurrent = y.id === currentSchoolYear?.id;
                    return (
                      <option key={y.id} value={y.id}>
                        {y.label} {isCurrent ? '(In corso)' : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3.5 sm:px-5 py-2.5 space-y-3 scrollbar-thin">
          
          {/* Avviso Orario Provvisorio in vigore */}
          {stats.hasActiveProvisionalPeriod && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 shadow-xs text-amber-900 animate-magi-fade">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-tight font-medium">
                <span className="font-bold block text-amber-950 mb-0.5">Orario provvisorio in vigore</span>
                Le ore svolte sono conteggiate regolarmente. Le ore residue future considerano l'orario applicabile.
              </div>
            </div>
          )}

          {/* Dettaglio Periodo Anno Scolastico */}
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium text-center bg-slate-50/80 rounded-lg py-1 px-2 border border-slate-100">
            {selectedYear && (
              <span>
                A.S. {selectedYear.label}: dal {formatDateDisplay(selectedYear.startDate)} al {formatDateDisplay(selectedYear.endDate)}
                {selectedYear.splitDate && (
                  <span className="text-slate-400"> (cambio quadrimestre: {formatDateDisplay(selectedYear.splitDate)})</span>
                )}
              </span>
            )}
          </div>

          {/* Card Compatta Giorni e Totali Quadrimestri */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2 text-center shadow-xs">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Giorni Svolti</span>
              <span className="text-lg sm:text-xl font-black text-emerald-700 leading-tight">{stats.daysHeld}</span>
              <span className="text-[9px] text-emerald-600/80 block">di {stats.totalDays} gg</span>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2 text-center shadow-xs">
              <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">Giorni Residui</span>
              <span className="text-lg sm:text-xl font-black text-primary leading-tight">{stats.daysRemaining}</span>
              <span className="text-[9px] text-primary/70 block">rimanenti</span>
            </div>

            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2 text-center shadow-xs">
              <span className="text-[9px] font-bold text-blue-800 uppercase tracking-wider block">Tot. 1° Quad.</span>
              <span className="text-lg sm:text-xl font-black text-blue-700 leading-tight">{stats.totalClassHoursQ1}h</span>
              <span className="text-[9px] text-blue-600/80 block">ore classi</span>
            </div>

            <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-2 text-center shadow-xs">
              <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wider block">Tot. 2° Quad.</span>
              <span className="text-lg sm:text-xl font-black text-purple-700 leading-tight">{stats.totalClassHoursQ2}h</span>
              <span className="text-[9px] text-purple-600/80 block">ore classi</span>
            </div>
          </div>

          {/* RIEPILOGO COMPATTO PER CLASSE: ORE SVOLTE, RESIDUE, TOT 1° Q, TOT 2° Q */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-primary" />
                Riepilogo per Classe
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {sortedClasses.length} {sortedClasses.length === 1 ? 'classe' : 'classi'}
              </span>
            </div>

            <div className="space-y-2">
              {sortedClasses.map(cls => (
                <div 
                  key={cls.className} 
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center">
                        {cls.className}
                      </span>
                      <span className="text-sm font-black text-slate-800">Classe {cls.className}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-xs">
                      Totale: <strong className="text-slate-800">{cls.totalHours}h</strong>
                    </span>
                  </div>

                  {/* Blocco compatto 4 colonne: Svolte, Residue, 1° Quadrimestre, 2° Quadrimestre */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl py-1.5 px-1 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-emerald-800 uppercase tracking-tighter block truncate w-full">
                        Svolte
                      </span>
                      <span className="text-base sm:text-lg font-black text-emerald-700 leading-none mt-0.5">
                        {cls.heldHours}
                      </span>
                    </div>

                    <div className="bg-rose-50/90 border border-rose-200/80 rounded-xl py-1.5 px-1 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-primary uppercase tracking-tighter block truncate w-full">
                        Residue
                      </span>
                      <span className="text-base sm:text-lg font-black text-primary leading-none mt-0.5">
                        {cls.remainingHours}
                      </span>
                    </div>

                    <div className="bg-blue-50/90 border border-blue-200/80 rounded-xl py-1.5 px-1 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-blue-800 uppercase tracking-tighter block truncate w-full">
                        Tot. 1° Q.
                      </span>
                      <span className="text-base sm:text-lg font-black text-blue-700 leading-none mt-0.5">
                        {cls.q1TotalHours}
                      </span>
                    </div>

                    <div className="bg-purple-50/90 border border-purple-200/80 rounded-xl py-1.5 px-1 flex flex-col items-center justify-center">
                      <span className="text-[8px] sm:text-[9px] font-bold text-purple-800 uppercase tracking-tighter block truncate w-full">
                        Tot. 2° Q.
                      </span>
                      <span className="text-base sm:text-lg font-black text-purple-700 leading-none mt-0.5">
                        {cls.q2TotalHours}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {sortedClasses.length === 0 && (
                <div className="text-center py-6 text-slate-400 font-medium text-xs sm:text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Nessuna lezione associata a classi per questo anno scolastico.
                </div>
              )}
            </div>
          </div>

          {/* RIEPILOGO ORE NON ASSOCIATE A CLASSI */}
          <div className="pt-0.5">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Ore non associate a classi
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* A Disposizione */}
              <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-2 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-amber-600" />
                    A Disposizione
                  </span>
                  <span className="text-[10px] font-bold text-amber-900">{stats.disposizione.totalHours}h</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-center text-[10px] pt-1 border-t border-amber-100">
                  <span className="text-slate-600 font-medium">Svolte: <strong className="text-amber-800">{stats.disposizione.heldHours}</strong></span>
                  <span className="text-slate-600 font-medium">Residue: <strong className="text-amber-800">{stats.disposizione.remainingHours}</strong></span>
                </div>
              </div>

              {/* Ore di Buco */}
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-2 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                    <Hourglass className="w-3 h-3 text-slate-500" />
                    Ore di Buco
                  </span>
                  <span className="text-[10px] font-bold text-slate-700">{stats.buco.totalHours}h</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-center text-[10px] pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-medium">Svolte: <strong className="text-slate-700">{stats.buco.heldHours}</strong></span>
                  <span className="text-slate-600 font-medium">Residue: <strong className="text-slate-700">{stats.buco.remainingHours}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Totale Ore di Lezione (Classi)
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium">
              <strong className="text-emerald-700">{stats.totalClassHoursHeld}</strong> svolte + <strong className="text-primary">{stats.totalClassHoursRemaining}</strong> residue
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-base sm:text-lg font-black text-slate-800 leading-tight">
              {stats.totalClassHours} ore
            </span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">Totale A.S.</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RemainingHoursModal;
