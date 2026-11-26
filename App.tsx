
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';

import ScheduleView from './components/ScheduleView';
import AssignmentModal from './components/AssignmentModal';
import AddLessonModal from './components/AddLessonModal';
import EditLessonModal from './components/EditLessonModal';
import StartDateModal from './components/StartDateModal';
import DayStatusModal from './components/DayStatusModal';
import BackupModal from './components/BackupModal';
import GuideModal from './components/GuideModal';
import EditTimeModal from './components/EditTimeModal';
import RecessModal from './components/RecessModal';
import SubjectManagerModal from './components/SubjectManagerModal';
import MonthPickerModal from './components/MonthPickerModal';
import HoursSettingsModal from './components/HoursSettingsModal';
import SettingsMenuModal from './components/SettingsMenuModal';
import SearchModal from './components/SearchModal';
import TaskDatabaseModal from './components/TaskDatabaseModal';
import RemainingHoursModal from './components/RemainingHoursModal';
import ClassFilterModal from './components/ClassFilterModal';
import ProvisionalScheduleModal from './components/ProvisionalScheduleModal';

import { INITIAL_SCHEDULE, INITIAL_NOTES, DAYS, DAYS_SIX, TIME_SLOTS as DEFAULT_TIME_SLOTS, DEFAULT_DURATIONS, DEFAULT_SUBJECTS, INITIAL_CLASSES, LAST_BACKUP_STORAGE_KEY, APP_VERSION } from './constants';
import { Lesson, LessonNote, DayOfWeek, SpecialDay, SpecialDayType, Recess, Subject, ClassEntity, SchoolClosure, TaskTemplate, SchoolYear, ProvisionalSchedulePeriod, LinkedSubjectGroup, RepeatMode } from './types';
import { 
  isWeekInProvisionalPeriod, 
  isDateInProvisionalPeriod, 
  getProvisionalPeriodForDate, 
  getMondayFromDateStr,
  getMondayDateStrFromDate,
  getLocalDateString,
  syncProvisionalPeriodsWithSchedule,
  reallocateLessonNotesForPeriods
} from './utils/provisionalSchedule';
import { getMatchingSubjectNames } from './utils/subjectLinks';
import { performSelectiveRestore, DetectedYearSummary, extractBackupTimestamp } from './utils/backupRestore';
import { applyLessonRepetition, isDisposizioneLesson } from './utils/repetitionUtils';
import { findNoteIndexForLesson, normalizeNoteDate, hasMeaningfulNoteContent } from './utils/noteLookup';
import {
  LocalAppState,
  initAndLoadLocalDatabase,
  saveAppStateToLocalDb,
  createLocalSnapshot,
  getSnapshotById,
  safeSetLocalStorageItem
} from './utils/localDatabase';

// --- HELPER FUNCTIONS ---

const getMondayDateStr = getMondayDateStrFromDate;
const getLocalDateStr = getLocalDateString;

const safeSetLocalStorage = (key: string, value: string) => {
  const res = safeSetLocalStorageItem(key, value);
  if (!res.ok) {
    console.warn(`LocalStorage write error for ${key}`);
  }
};

const escapeHtml = (input: string): string => {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const findTargetNoteIndex = (
  notes: LessonNote[], 
  lessonId: string, 
  dateStr: string, 
  _className?: string, 
  _subject?: string,
  targetHour?: number,
  scheduleList?: Lesson[],
  subjectsList?: Subject[],
  linkedGroupsList?: LinkedSubjectGroup[]
): number => {
  return findNoteIndexForLesson(
    notes,
    lessonId,
    dateStr,
    { className: _className, subject: _subject, hour: targetHour },
    scheduleList,
    subjectsList,
    linkedGroupsList
  );
};

const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
};

const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getSmartInitialDate = () => {
    const d = new Date();
    const day = d.getDay(); 
    const isSixDay = localStorage.getItem('techdraw_is_six_day') === 'true';

    if (day === 0) {
        d.setDate(d.getDate() + 1);
        return d;
    }

    if (day === 6 && !isSixDay) {
        d.setDate(d.getDate() + 2);
        return d;
    }

    return d;
};

// Snapshot completo dello stato per Undo/Redo
interface AppStateSnapshot {
  schedule: Lesson[];
  lessonNotes: LessonNote[];
  specialDays: SpecialDay[];
  schoolClosures: SchoolClosure[];
  timeSlots: Record<number, string>;
  recesses: Recess[];
  subjects: Subject[];
  classes: ClassEntity[];
  durations: Record<number, number>;
  maxHours: number;
  schoolStartDate: string; // ISO String
  schoolEndDate: string; // ISO String
  semesterSplitDate: string; // ISO String
  isSixDayWeek: boolean;
  schoolYears?: SchoolYear[];
  taskTemplates: TaskTemplate[];
  provisionalPeriods?: ProvisionalSchedulePeriod[];
  linkedSubjectGroups?: LinkedSubjectGroup[];
}

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(getSmartInitialDate());

  // --- APP STATE ---
  const [schedule, setSchedule] = useState<Lesson[]>(() => {
     const saved = localStorage.getItem('techdraw_schedule');
     if (saved) return JSON.parse(saved);
     const todayMonday = getMondayDateStr(new Date());
     return INITIAL_SCHEDULE.map(l => ({ ...l, weekStart: todayMonday }));
  });

  const [lessonNotes, setLessonNotes] = useState<LessonNote[]>(() => {
    const saved = localStorage.getItem('techdraw_notes');
    return saved ? JSON.parse(saved) : INITIAL_NOTES;
  });

  const [specialDays, setSpecialDays] = useState<SpecialDay[]>(() => {
    const saved = localStorage.getItem('techdraw_special_days');
    return saved ? JSON.parse(saved) : [];
  });

  const [schoolClosures, setSchoolClosures] = useState<SchoolClosure[]>(() => {
    const saved = localStorage.getItem('techdraw_closures');
    return saved ? JSON.parse(saved) : [];
  });

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(() => {
    const saved = localStorage.getItem('techdraw_school_years');
    return saved ? JSON.parse(saved) : [];
  });

  const [timeSlots, setTimeSlots] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('techdraw_time_slots');
    return saved ? JSON.parse(saved) : DEFAULT_TIME_SLOTS;
  });

  const [durations, setDurations] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem('techdraw_durations');
    return saved ? JSON.parse(saved) : DEFAULT_DURATIONS;
  });

  const [recesses, setRecesses] = useState<Recess[]>(() => {
    const saved = localStorage.getItem('techdraw_recesses');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'r1', afterHour: 2, duration: 10 },
      { id: 'r2', afterHour: 4, duration: 10 }
    ];
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('techdraw_subjects');
    return saved ? JSON.parse(saved) : DEFAULT_SUBJECTS;
  });

  const [classes, setClasses] = useState<ClassEntity[]>(() => {
    const saved = localStorage.getItem('techdraw_classes');
    return saved ? JSON.parse(saved) : INITIAL_CLASSES;
  });

  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>(() => {
    const saved = localStorage.getItem('techdraw_task_templates');
    return saved ? JSON.parse(saved) : [];
  });

  const [provisionalPeriods, setProvisionalPeriods] = useState<ProvisionalSchedulePeriod[]>(() => {
    const saved = localStorage.getItem('techdraw_provisional_periods');
    return saved ? JSON.parse(saved) : [];
  });

  const [linkedSubjectGroups, setLinkedSubjectGroups] = useState<LinkedSubjectGroup[]>(() => {
    const saved = localStorage.getItem('techdraw_linked_subject_groups');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [schoolStartDate, setSchoolStartDate] = useState<Date>(() => {
    const saved = localStorage.getItem('techdraw_start_date');
    if (saved) return new Date(saved);
    const d = new Date();
    if (d.getMonth() < 7) d.setFullYear(d.getFullYear() - 1);
    d.setMonth(8); // September
    d.setDate(11);
    d.setHours(12, 0, 0, 0);
    return d;
  });

  const [schoolEndDate, setSchoolEndDate] = useState<Date>(() => {
    const saved = localStorage.getItem('techdraw_end_date');
    if (saved) return new Date(saved);
    const d = new Date(schoolStartDate);
    d.setFullYear(d.getFullYear() + 1);
    d.setMonth(5); // June
    d.setDate(15);
    d.setHours(12, 0, 0, 0);
    return d;
  });

  const [semesterSplitDate, setSemesterSplitDate] = useState<Date>(() => {
    const saved = localStorage.getItem('techdraw_semester_split');
    if (saved) return new Date(saved);
    const d = new Date();
    const currentMonth = new Date().getMonth();
    const yearOffset = currentMonth > 7 ? 1 : 0;
    d.setFullYear(new Date().getFullYear() + yearOffset);
    d.setMonth(0); // January
    d.setDate(31);
    return d;
  });

  const [isSixDayWeek, setIsSixDayWeek] = useState<boolean>(() => {
      const saved = localStorage.getItem('techdraw_is_six_day');
      return saved === 'true';
  });

  const [maxHours, setMaxHours] = useState<number>(() => {
      const saved = localStorage.getItem('techdraw_max_hours');
      return saved ? parseInt(saved, 10) : 7;
  });

  const visibleDays = useMemo(() => isSixDayWeek ? DAYS_SIX : DAYS, [isSixDayWeek]);

  // --- IN-APP TOAST NOTIFICATION ---
  interface ToastNotification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ id: crypto.randomUUID(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // --- UNDO/REDO LOGIC ---
  const [history, setHistory] = useState<AppStateSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  const isNavigatingHistoryRef = useRef(false);
  const lastSnapshotStrRef = useRef<string>('');

  const createSnapshot = useCallback((): AppStateSnapshot => {
      return JSON.parse(JSON.stringify({
          schedule,
          lessonNotes,
          specialDays,
          schoolClosures,
          timeSlots,
          recesses,
          subjects,
          classes,
          durations,
          maxHours,
          schoolStartDate: schoolStartDate.toISOString(),
          schoolEndDate: schoolEndDate.toISOString(),
          semesterSplitDate: semesterSplitDate.toISOString(),
          isSixDayWeek,
          schoolYears,
          taskTemplates,
          provisionalPeriods,
          linkedSubjectGroups
      }));
  }, [schedule, lessonNotes, specialDays, schoolClosures, timeSlots, recesses, subjects, classes, durations, maxHours, schoolStartDate, schoolEndDate, semesterSplitDate, isSixDayWeek, schoolYears, taskTemplates, provisionalPeriods, linkedSubjectGroups]);

  useEffect(() => {
    if (isNavigatingHistoryRef.current) return;
    const timer = setTimeout(() => {
        const snapshot = createSnapshot();
        const snapStr = JSON.stringify(snapshot);
        if (lastSnapshotStrRef.current === snapStr) return;
        lastSnapshotStrRef.current = snapStr;

        setHistory(prev => {
            const currentIdx = historyIndexRef.current;
            const newHistory = prev.slice(0, currentIdx + 1);
            newHistory.push(snapshot);
            if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
            return newHistory;
        });
        setHistoryIndex(prev => {
            const next = Math.min(prev + 1, 49);
            historyIndexRef.current = next;
            return next;
        });
    }, 1000); 
    return () => clearTimeout(timer);
  }, [schedule, lessonNotes, specialDays, schoolClosures, timeSlots, durations, recesses, subjects, classes, maxHours, schoolStartDate, schoolEndDate, semesterSplitDate, isSixDayWeek, schoolYears, taskTemplates, provisionalPeriods, linkedSubjectGroups]);

  useEffect(() => {
      if (history.length === 0) {
          const initSnapshot = createSnapshot();
          lastSnapshotStrRef.current = JSON.stringify(initSnapshot);
          setHistory([initSnapshot]);
          setHistoryIndex(0);
          historyIndexRef.current = 0;
      }
  }, []);

  const applySnapshot = useCallback((snapshot: AppStateSnapshot) => {
      isNavigatingHistoryRef.current = true;
      lastSnapshotStrRef.current = JSON.stringify(snapshot);
      setSchedule(snapshot.schedule);
      setLessonNotes(snapshot.lessonNotes);
      setSpecialDays(snapshot.specialDays);
      setSchoolClosures(snapshot.schoolClosures || []);
      setTimeSlots(snapshot.timeSlots);
      setRecesses(snapshot.recesses);
      setSubjects(snapshot.subjects);
      setClasses(snapshot.classes);
      setDurations(snapshot.durations);
      setMaxHours(snapshot.maxHours);
      setTaskTemplates(snapshot.taskTemplates || []);
      if (snapshot.provisionalPeriods) setProvisionalPeriods(snapshot.provisionalPeriods);
      if (snapshot.linkedSubjectGroups) setLinkedSubjectGroups(snapshot.linkedSubjectGroups);
      setSchoolStartDate(new Date(snapshot.schoolStartDate));
      if (snapshot.schoolEndDate) setSchoolEndDate(new Date(snapshot.schoolEndDate));
      setSemesterSplitDate(new Date(snapshot.semesterSplitDate));
      setIsSixDayWeek(snapshot.isSixDayWeek);
      setTimeout(() => { isNavigatingHistoryRef.current = false; }, 500);
  }, []);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const snapshotToRestore = history[prevIndex];
      applySnapshot(snapshotToRestore);
      setHistoryIndex(prevIndex);
      historyIndexRef.current = prevIndex;
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshotToRestore = history[nextIndex];
      applySnapshot(snapshotToRestore);
      setHistoryIndex(nextIndex);
      historyIndexRef.current = nextIndex;
    }
  };

  // --- WEEK COUNTING LOGIC ---
  const getWeekNumberFormatted = useCallback(() => {
    const start = new Date(schoolStartDate);
    start.setHours(12, 0, 0, 0);
    
    // Iniziamo dal lunedì della settimana di inizio
    const startMonday = new Date(start);
    const day = startMonday.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    startMonday.setDate(startMonday.getDate() + diffToMon);

    const targetDate = new Date(currentDate);
    targetDate.setHours(12, 0, 0, 0);
    const targetMonday = new Date(targetDate);
    const targetDay = targetMonday.getDay();
    const diffToMonTarget = targetDay === 0 ? -6 : 1 - targetDay;
    targetMonday.setDate(targetMonday.getDate() + diffToMonTarget);

    // Fine anno scolastico stimata (es. metà giugno del prossimo anno o anno corrente)
    const endOfYear = new Date(startMonday);
    endOfYear.setMonth(endOfYear.getMonth() + 9);
    endOfYear.setDate(15); 

    let totalEffectiveWeeks = 0;
    let currentWeekEffectiveIndex = -1;

    let weekCursor = new Date(startMonday);
    let weekCounter = 0;

    while (weekCursor <= endOfYear) {
        // Controlla se questa settimana è interamente chiusa
        let isFullyClosed = true;
        for (let i = 0; i < visibleDays.length; i++) {
            const dayToCheck = new Date(weekCursor);
            dayToCheck.setDate(dayToCheck.getDate() + i);
            const dateStr = getLocalDateStr(dayToCheck);
            const isClosed = specialDays.some(sd => sd.date === dateStr && sd.type === 'SCHOOL_CLOSED');
            if (!isClosed) {
                isFullyClosed = false;
                break;
            }
        }

        if (!isFullyClosed) {
            totalEffectiveWeeks++;
            if (weekCursor.getTime() === targetMonday.getTime()) {
                currentWeekEffectiveIndex = totalEffectiveWeeks;
            }
        } else {
             if (weekCursor.getTime() === targetMonday.getTime()) {
                currentWeekEffectiveIndex = -1; // Siamo in una settimana chiusa
            }
        }

        weekCursor.setDate(weekCursor.getDate() + 7);
        weekCounter++;
        if (weekCounter > 52) break; // Sicurezza
    }

    if (currentWeekEffectiveIndex === -1) return "-";
    return `${currentWeekEffectiveIndex} / ${totalEffectiveWeeks}`;
  }, [schoolStartDate, currentDate, specialDays, visibleDays]);

  // --- HIGHLIGHT STATE ---
  const [highlightedLessonId, setHighlightedLessonId] = useState<string | null>(null);

  // --- INSTALL PROMPT STATE ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => { window.removeEventListener('beforeinstallprompt', handler); };
  }, []);

  const recalculateScheduleChain = (currentDurations: Record<number, number>, currentRecesses: Recess[], firstHourStartMin: number) => {
      const newSlots: Record<number, string> = {};
      let currentStartMin = firstHourStartMin;
      for (let h = 1; h <= 12; h++) {
          const prevRecess = currentRecesses.find(r => r.afterHour === h - 1);
          if (prevRecess) currentStartMin += prevRecess.duration;
          const duration = currentDurations[h] || 60; 
          const endMin = currentStartMin + duration;
          newSlots[h] = `${minutesToTime(currentStartMin)} - ${minutesToTime(endMin)}`;
          currentStartMin = endMin;
      }
      return newSlots;
  };

  // --- PERSISTENZA LOCALE INDEXEDDB (100% OFFLINE / AUTONOMA) ---
  const computeStateSnapshot = (
    sched: any, notes: any, spDays: any, closures: any, slots: any, durs: any, recs: any,
    subjs: any, cls: any, tTemplates: any, provPeriods: any, linkedGroups: any,
    startDate: any, endDate: any, splitDate: any, isSixDay: any, hours: any, years: any
  ): string => {
    return JSON.stringify({
      schedule: sched || [],
      lessonNotes: notes || [],
      specialDays: spDays || [],
      schoolClosures: closures || [],
      timeSlots: slots || {},
      durations: durs || {},
      recesses: recs || [],
      subjects: subjs || [],
      classes: cls || [],
      taskTemplates: tTemplates || [],
      provisionalPeriods: provPeriods || [],
      linkedSubjectGroups: linkedGroups || [],
      schoolStartDate: typeof startDate === 'string' ? startDate : (startDate?.toISOString?.() || ''),
      schoolEndDate: typeof endDate === 'string' ? endDate : (endDate?.toISOString?.() || ''),
      semesterSplitDate: typeof splitDate === 'string' ? splitDate : (splitDate?.toISOString?.() || ''),
      isSixDayWeek: Boolean(isSixDay),
      maxHours: Number(hours) || 7,
      schoolYears: years || []
    });
  };

  const isHydratingFromDbRef = useRef(false);
  const isLocalDbReadyRef = useRef(false);
  const lastSavedStateSnapshotRef = useRef<string>('');
  const lastStorageErrorToastRef = useRef<number>(0);

  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const buildCurrentLocalAppState = useCallback((overrides?: Partial<LocalAppState>): LocalAppState => {
    return {
      schedule: overrides?.schedule ?? schedule,
      lessonNotes: overrides?.lessonNotes ?? lessonNotes,
      specialDays: overrides?.specialDays ?? specialDays,
      schoolClosures: overrides?.schoolClosures ?? schoolClosures,
      schoolYears: overrides?.schoolYears ?? schoolYears,
      timeSlots: overrides?.timeSlots ?? timeSlots,
      durations: overrides?.durations ?? durations,
      recesses: overrides?.recesses ?? recesses,
      subjects: overrides?.subjects ?? subjects,
      classes: overrides?.classes ?? classes,
      taskTemplates: overrides?.taskTemplates ?? taskTemplates,
      provisionalPeriods: overrides?.provisionalPeriods ?? provisionalPeriods,
      linkedSubjectGroups: overrides?.linkedSubjectGroups ?? linkedSubjectGroups,
      schoolStartDate: overrides?.schoolStartDate ?? (typeof schoolStartDate === 'string' ? schoolStartDate : schoolStartDate.toISOString()),
      schoolEndDate: overrides?.schoolEndDate ?? (typeof schoolEndDate === 'string' ? schoolEndDate : schoolEndDate.toISOString()),
      semesterSplitDate: overrides?.semesterSplitDate ?? (typeof semesterSplitDate === 'string' ? semesterSplitDate : semesterSplitDate.toISOString()),
      isSixDayWeek: overrides?.isSixDayWeek ?? isSixDayWeek,
      maxHours: overrides?.maxHours ?? maxHours,
      timeSettingsUpdatedAt: overrides?.timeSettingsUpdatedAt ?? (localStorage.getItem('magiclass_time_settings_updated_at') || undefined)
    };
  }, [
    schedule, lessonNotes, specialDays, schoolClosures, schoolYears,
    timeSlots, durations, recesses, subjects, classes, taskTemplates,
    provisionalPeriods, linkedSubjectGroups, schoolStartDate, schoolEndDate,
    semesterSplitDate, isSixDayWeek, maxHours
  ]);

  const buildCurrentLocalAppStateRef = useRef(buildCurrentLocalAppState);
  useEffect(() => {
    buildCurrentLocalAppStateRef.current = buildCurrentLocalAppState;
  }, [buildCurrentLocalAppState]);

  const applyLocalAppStateToReact = useCallback((loaded: LocalAppState) => {
    isHydratingFromDbRef.current = true;
    isNavigatingHistoryRef.current = true;

    if (loaded.classes !== undefined) setClasses(loaded.classes);
    if (loaded.schedule !== undefined) setSchedule(loaded.schedule);
    if (loaded.provisionalPeriods !== undefined) setProvisionalPeriods(loaded.provisionalPeriods);
    if (loaded.lessonNotes !== undefined) setLessonNotes(loaded.lessonNotes);
    if (loaded.specialDays !== undefined) setSpecialDays(loaded.specialDays);
    if (loaded.schoolClosures !== undefined) setSchoolClosures(loaded.schoolClosures);
    if (loaded.timeSlots && Object.keys(loaded.timeSlots).length > 0) setTimeSlots(loaded.timeSlots);
    if (loaded.durations && Object.keys(loaded.durations).length > 0) setDurations(loaded.durations);
    if (loaded.recesses !== undefined) setRecesses(loaded.recesses);
    if (loaded.subjects !== undefined) setSubjects(loaded.subjects);
    if (loaded.taskTemplates !== undefined) setTaskTemplates(loaded.taskTemplates);
    if (loaded.schoolYears !== undefined) setSchoolYears(loaded.schoolYears);
    if (loaded.linkedSubjectGroups !== undefined) setLinkedSubjectGroups(loaded.linkedSubjectGroups);
    if (loaded.schoolStartDate) {
      const d = new Date(loaded.schoolStartDate);
      if (!isNaN(d.getTime())) setSchoolStartDate(d);
    }
    if (loaded.schoolEndDate) {
      const d = new Date(loaded.schoolEndDate);
      if (!isNaN(d.getTime())) setSchoolEndDate(d);
    }
    if (loaded.semesterSplitDate) {
      const d = new Date(loaded.semesterSplitDate);
      if (!isNaN(d.getTime())) setSemesterSplitDate(d);
    }
    if (loaded.isSixDayWeek !== undefined) setIsSixDayWeek(loaded.isSixDayWeek);
    if (loaded.maxHours !== undefined) setMaxHours(loaded.maxHours);
    if (loaded.timeSettingsUpdatedAt) {
      safeSetLocalStorage('magiclass_time_settings_updated_at', loaded.timeSettingsUpdatedAt);
    }

    lastSavedStateSnapshotRef.current = computeStateSnapshot(
      loaded.schedule,
      loaded.lessonNotes,
      loaded.specialDays,
      loaded.schoolClosures,
      loaded.timeSlots,
      loaded.durations,
      loaded.recesses,
      loaded.subjects,
      loaded.classes,
      loaded.taskTemplates,
      loaded.provisionalPeriods,
      loaded.linkedSubjectGroups,
      loaded.schoolStartDate,
      loaded.schoolEndDate,
      loaded.semesterSplitDate,
      loaded.isSixDayWeek,
      loaded.maxHours,
      loaded.schoolYears
    );

    setTimeout(() => {
      isNavigatingHistoryRef.current = false;
      isHydratingFromDbRef.current = false;
    }, 300);
  }, []);

  const reportStorageError = useCallback((message?: string) => {
    const now = Date.now();
    if (now - lastStorageErrorToastRef.current < 5000) return;
    lastStorageErrorToastRef.current = now;
    showToastRef.current(
      message || 'Errore nel salvataggio locale dei dati. Effettua un backup su disco.',
      'error'
    );
  }, []);

  // Inizializzazione database locale IndexedDB + migrazione verificata automatica da localStorage
  useEffect(() => {
    let cancelled = false;
    const initialSnapshotState = buildCurrentLocalAppStateRef.current();

    initAndLoadLocalDatabase(initialSnapshotState)
      .then((result) => {
        if (cancelled) return;
        isLocalDbReadyRef.current = true;
        if (result.record && result.record.data && !result.migratedFromLocalStorage) {
          applyLocalAppStateToReact(result.record.data);
        }
        if (result.warningMessage) {
          showToastRef.current(result.warningMessage, 'warning');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        isLocalDbReadyRef.current = true;
        console.warn('Avviso avvio database locale:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [applyLocalAppStateToReact]);

  // Persistenza automatica atomica su IndexedDB + copia speculare localStorage
  useEffect(() => {
    const stateSnapshot = computeStateSnapshot(
      schedule, lessonNotes, specialDays, schoolClosures, timeSlots, durations, recesses,
      subjects, classes, taskTemplates, provisionalPeriods, linkedSubjectGroups,
      schoolStartDate, schoolEndDate, semesterSplitDate, isSixDayWeek, maxHours, schoolYears
    );

    if (isNavigatingHistoryRef.current || isHydratingFromDbRef.current) {
      lastSavedStateSnapshotRef.current = stateSnapshot;
      return;
    }

    if (!lastSavedStateSnapshotRef.current) {
      lastSavedStateSnapshotRef.current = stateSnapshot;
      return;
    }

    if (stateSnapshot !== lastSavedStateSnapshotRef.current) {
      lastSavedStateSnapshotRef.current = stateSnapshot;
      const fullState = buildCurrentLocalAppState();
      saveAppStateToLocalDb(fullState).then((res) => {
        if (!res.ok) {
          reportStorageError(res.errorMessage);
        }
      });
    }
  }, [
    schedule, lessonNotes, specialDays, schoolClosures, timeSlots, durations, recesses,
    subjects, classes, taskTemplates, provisionalPeriods, linkedSubjectGroups,
    schoolStartDate, schoolEndDate, semesterSplitDate, isSixDayWeek, maxHours, schoolYears,
    buildCurrentLocalAppState, reportStorageError
  ]);

  useEffect(() => {
    if (schoolYears.length === 0 && schoolStartDate) {
      const yearLabel = `${schoolStartDate.getFullYear()}/${schoolStartDate.getFullYear() + 1}`;
      const initialYear: SchoolYear = {
        id: crypto.randomUUID(),
        label: yearLabel,
        startDate: getLocalDateStr(schoolStartDate),
        endDate: getLocalDateStr(schoolEndDate),
        splitDate: getLocalDateStr(semesterSplitDate),
        isSixDayWeek: isSixDayWeek,
        closures: schoolClosures
      };
      setSchoolYears([initialYear]);
    }
  }, [schoolStartDate, schoolEndDate, semesterSplitDate, isSixDayWeek, schoolClosures]);

  useEffect(() => {
    const dateStr = getLocalDateStr(currentDate);
    const year = schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate);
    if (year) {
      const newStart = new Date(year.startDate); newStart.setHours(12, 0, 0, 0);
      const newEnd = new Date(year.endDate); newEnd.setHours(12, 0, 0, 0);
      const newSplit = new Date(year.splitDate); newSplit.setHours(12, 0, 0, 0);
      
      if (schoolStartDate.getTime() !== newStart.getTime()) setSchoolStartDate(newStart);
      if (schoolEndDate.getTime() !== newEnd.getTime()) setSchoolEndDate(newEnd);
      if (semesterSplitDate.getTime() !== newSplit.getTime()) setSemesterSplitDate(newSplit);
      if (isSixDayWeek !== year.isSixDayWeek) setIsSixDayWeek(year.isSixDayWeek);
      if (JSON.stringify(schoolClosures) !== JSON.stringify(year.closures)) setSchoolClosures(year.closures);
    }
  }, [currentDate, schoolYears]);

  const persistLocalChanges = useCallback((partialData: Partial<LocalAppState>) => {
    const mergedState = buildCurrentLocalAppStateRef.current(partialData);
    saveAppStateToLocalDb(mergedState).then((res) => {
      if (!res.ok) {
        reportStorageError(res.errorMessage);
      }
    });
  }, [reportStorageError]);

  useEffect(() => {
    if (provisionalPeriods && provisionalPeriods.length > 0) {
      const ensured = syncProvisionalPeriodsWithSchedule(schedule, provisionalPeriods, schoolYears);
      const reallocatedNotes = reallocateLessonNotesForPeriods(
        lessonNotes,
        schedule,
        ensured,
        provisionalPeriods,
        provisionalPeriods,
        schoolYears,
        visibleDays,
        maxHours
      );

      let changed = false;
      const dataToPersist: Partial<LocalAppState> = {};
      if (ensured !== schedule) {
        setSchedule(ensured);
        dataToPersist.schedule = ensured;
        changed = true;
      }
      if (reallocatedNotes !== lessonNotes && JSON.stringify(reallocatedNotes) !== JSON.stringify(lessonNotes)) {
        setLessonNotes(reallocatedNotes);
        dataToPersist.lessonNotes = reallocatedNotes;
        changed = true;
      }
      if (changed && !isHydratingFromDbRef.current) {
        persistLocalChanges(dataToPersist);
      }
    }
  }, [provisionalPeriods, schoolYears]);

  const [isRecessModalOpen, setIsRecessModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{ lesson: Lesson, dateStr: string } | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isAddLessonModalOpen, setIsAddLessonModalOpen] = useState(false);
  const [addLessonSlot, setAddLessonSlot] = useState<{ day: DayOfWeek, hour: number, dateStr?: string } | null>(null);
  const [isStartDateModalOpen, setIsStartDateModalOpen] = useState(false);
  const [isDayStatusModalOpen, setIsDayStatusModalOpen] = useState(false);
  const [selectedDayStatusDate, setSelectedDayStatusDate] = useState<Date | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isEditTimeModalOpen, setIsEditTimeModalOpen] = useState(false);
  const [editingTimeHour, setEditingTimeHour] = useState<number | null>(null);
  const [isSubjectManagerOpen, setIsSubjectManagerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isHoursSettingsModalOpen, setIsHoursSettingsModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isTaskDatabaseModalOpen, setIsTaskDatabaseModalOpen] = useState(false);
  const [isRemainingHoursModalOpen, setIsRemainingHoursModalOpen] = useState(false);
  const [isClassFilterModalOpen, setIsClassFilterModalOpen] = useState(false);
  const [isProvisionalScheduleModalOpen, setIsProvisionalScheduleModalOpen] = useState(false);
  const [focusClass, setFocusClass] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem(LAST_BACKUP_STORAGE_KEY) ||
           localStorage.getItem('techdraw_last_backup_time') ||
           null;
  });

  const handleDayHeaderClick = (date: Date) => { setSelectedDayStatusDate(date); setIsDayStatusModalOpen(true); };

  const resolveLessonForDateAndSlot = useCallback((day: DayOfWeek, hour: number, date: Date, currentSchedule: Lesson[] = schedule): Lesson | null => {
    const dateStr = getLocalDateStr(date);
    const yearForDate = schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate) || schoolYears[0];
    if (!yearForDate) return null;

    const mondayDateStr = getMondayDateStr(date);
    const isProvisional = isDateInProvisionalPeriod(dateStr, provisionalPeriods);

    if (isProvisional) {
      const provLesson = currentSchedule.find(l => 
        l.isProvisional && 
        l.weekStart === mondayDateStr && 
        l.day === day && 
        l.hour === hour && 
        (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
      );
      if (provLesson) {
        if (provLesson.isDeleted || !provLesson.className) return null;
        return provLesson;
      }
      const periodForDate = getProvisionalPeriodForDate(dateStr, provisionalPeriods);
      if (periodForDate) {
        const periodLesson = currentSchedule.find(l =>
          l.isProvisional &&
          l.periodId === periodForDate.id &&
          l.day === day &&
          l.hour === hour &&
          (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
        );
        if (periodLesson) {
          if (periodLesson.isDeleted || !periodLesson.className) return null;
          return periodLesson;
        }
      }
    }

    // 1. Look for week-specific definitive lesson (e.g. weekStart === mondayDateStr)
    const weekSpecific = currentSchedule.find(l => 
      !l.isProvisional && 
      !l.isDeleted &&
      l.weekStart === mondayDateStr &&
      l.day === day && 
      l.hour === hour && 
      (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
    );
    if (weekSpecific) {
      if (weekSpecific.isDeleted || !weekSpecific.className) return null;
      return weekSpecific;
    }

    // 2. Fallback to base definitive lesson (lessons without weekStart)
    const baseLesson = currentSchedule.find(l => 
      !l.isProvisional && 
      !l.isDeleted &&
      !l.weekStart &&
      l.day === day && 
      l.hour === hour && 
      (l.schoolYearId === yearForDate.id || (!l.schoolYearId && yearForDate.id === schoolYears[0]?.id))
    );
    return baseLesson || null;
  }, [schedule, schoolYears, provisionalPeriods, isSixDayWeek]);

  const addLinesWithoutDuplicates = (existingText: string | undefined | null, linesToAdd: string | undefined | null) => {
    if (!linesToAdd) return existingText || '';
    const currentLines = (existingText || '').replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
    const cleanExisting = new Set(currentLines.map(l => l.replace(/\{[VXO]\}/g, '').trim()));
    const toAdd = (linesToAdd || '').replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
    const result = [...currentLines];
    toAdd.forEach(line => {
      const clean = line.replace(/\{[VXO]\}/g, '').trim();
      if (clean.length > 0 && !cleanExisting.has(clean)) {
        result.push(line);
        cleanExisting.add(clean);
      }
    });
    return result.join('\n');
  };

  const findNextValidLesson = (
    startDateStr: string, 
    className: string, 
    subject: string, 
    scheduleList: Lesson[] = schedule, 
    specialDaysList: SpecialDay[] = specialDays, 
    notesList: LessonNote[] = lessonNotes, 
    _activeDaysList: DayOfWeek[] = visibleDays, 
    skipSameDay: boolean = false
  ) => {
    const [y, m, d] = startDateStr.split('-').map(Number);
    let current = new Date(y, m - 1, d, 12, 0, 0); 
    if (skipSameDay) current.setDate(current.getDate() + 1);

    // Tipologie di giornate speciali che bloccano completamente l'attività
    const BLOCKING_DAY_TYPES = ['ASSEMBLY', 'PERMISSION', 'SICK', 'SCHOOL_CLOSED', 'TRIP'];

    // Tipologie di note/lezioni incompatibili con l'assegnazione o lo spostamento di compiti:
    // Eventi di scuola/classe: assemblea, lezione saltata, gita
    // Verifiche e prove: compito scritto, compito pratico, compito di teoria/interrogazione
    // NOTA: "Consegna elaborati" è considerata data DISPONIBILE e i compiti possono esservi regolarmente assegnati.
    const INCOMPATIBLE_LESSON_TYPES = [
      'assembly',
      'skipped_lesson',
      'trip',
      'written_exam',
      'practical_exam',
      'oral_exam'
    ];

    // Pattern testuale che rileva compiti in classe, verifiche, prove d'esame, interrogazioni programmate
    // (esclusa "Consegna elaborati", che è data valida e disponibile per i compiti)
    const EXAM_OR_BLOCKING_PATTERN = /(COMPITO\s+IN\s+CLASSE|VERIFICA|COMPITO\s+SCRITTO|COMPITO\s+PRATICO|COMPITO\s+(DI\s+)?TEORIA|INTERROGAZIONE\s+PROGRAMMATA|PROVA\s+(SCRITTA|ORALE|PRATICA|D'ESAME|DI\s+RECUPERO|COMUNE)|TEST\s+(SCRITTO|PRATICO|ORALE|DI\s+VERIFICA)|SIMULAZIONE)/i;
    
    const matchingSubjectNames = getMatchingSubjectNames(subject, subjects, linkedSubjectGroups)
      .map(n => n.trim().toLowerCase());

    const cleanTargetClass = (className || '').replace(/\s+/g, '').toUpperCase();

    // Funzione helper per verificare se una nota è incompatibile (esame/verifica/evento)
    const isNoteIncompatible = (note: LessonNote | undefined): boolean => {
      if (!note) return false;
      if (note.type && INCOMPATIBLE_LESSON_TYPES.includes(note.type as any)) return true;
      const allText = `${note.toDo || ''} ${note.toCheck || ''} ${note.misc || ''}`;
      if (EXAM_OR_BLOCKING_PATTERN.test(allText)) return true;
      return false;
    };

    for (let i = 0; i < 365; i++) {
        const dateStr = getLocalDateStr(current);

        // 1. Verifica anno scolastico di appartenenza
        const yearForDate = schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate);
        if (!yearForDate) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        // 2. Verifica chiusure scolastiche (vacanze natalizie, pasquali, ponti)
        const effectiveClosures = (yearForDate.closures && yearForDate.closures.length > 0) 
          ? yearForDate.closures 
          : schoolClosures;
        const isClosure = effectiveClosures.some(sc => dateStr >= sc.startDate && dateStr <= sc.endDate);
        if (isClosure) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        // 3. Verifica eventi speciali della giornata (malattia, permesso, assemblea d'istituto, chiusura straordinaria, gita)
        const specialDay = specialDaysList.find(sd => sd.date === dateStr);
        const isBlockingDay = specialDay && BLOCKING_DAY_TYPES.includes(specialDay.type as any);
        if (isBlockingDay) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        // 4. Verifica giorno della settimana e se fa parte dei giorni attivi (settimana a 5 o 6 giorni)
        const dayIndex = current.getDay(); 
        const dayMap = [null, DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN, DayOfWeek.SAB];
        const dayName = dayMap[dayIndex];
        const isSixDay = yearForDate.isSixDayWeek ?? isSixDayWeek;
        const allowedDays = isSixDay ? DAYS_SIX : DAYS;

        if (dayName && allowedDays.includes(dayName)) {
            const dailyLessons: Lesson[] = [];
            for (let h = 1; h <= maxHours; h++) {
                const l = resolveLessonForDateAndSlot(dayName, h, current, scheduleList);
                if (l && (l.className || '').replace(/\s+/g, '').toUpperCase() === cleanTargetClass) {
                    dailyLessons.push(l);
                }
            }
            dailyLessons.sort((a, b) => a.hour - b.hour);
            
            // Lezioni candidate che corrispondono alla classe e alla materia (o materie collegate)
            const candidateLessons = dailyLessons.filter(l => {
                if (!l.className || l.className === 'BUCO' || l.className === 'DISP' || isDisposizioneLesson(l)) return false;
                if (!l.subject) return true;
                if (!subject) return true;
                return matchingSubjectNames.includes(l.subject.trim().toLowerCase());
            });

            if (candidateLessons.length > 0) {
                // Verifichiamo se in questa data c'è già una verifica / compito in classe / evento per questa classe e materia
                const dayNotesForClassAndSubject = notesList.filter(n => {
                    if (n.date !== dateStr) return false;
                    const nClass = (n.className || '').replace(/\s+/g, '').toUpperCase();
                    if (nClass && nClass === cleanTargetClass) {
                        const nSubj = (n.subject || '').trim().toLowerCase();
                        if (!nSubj || !subject || matchingSubjectNames.includes(nSubj)) return true;
                    }
                    return candidateLessons.some(cl => cl.id === n.lessonId);
                });

                const isDayOccupiedByExam = dayNotesForClassAndSubject.some(n => isNoteIncompatible(n));
                if (isDayOccupiedByExam) {
                    // Questa data è occupata da un compito in classe, verifica o evento particolare: saltiamo al giorno successivo!
                    current.setDate(current.getDate() + 1);
                    continue;
                }

                // Cerchiamo la prima lezione libera tra quelle candidate
                for (const targetLesson of candidateLessons) {
                    const lessonNote = notesList.find(n => n.lessonId === targetLesson.id && n.date === dateStr);
                    if (!isNoteIncompatible(lessonNote)) {
                        return { lesson: targetLesson, dateStr };
                    }
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }
    return null;
  };

  const removeText = (original: string | undefined | null, toRemove: string) => {
      if (!original) return '';
      if (!toRemove) return original;
      const linesOriginal = original.replace(/\r/g, '').split('\n');
      const linesToRemove = toRemove.replace(/\r/g, '').split('\n');
      const filtered = linesOriginal.filter(line => {
          const cleanLine = line.replace(/\{[VXO]\}/g, '').trim();
          return cleanLine.length > 0 && !linesToRemove.some(r => r.replace(/\{[VXO]\}/g, '').trim() === cleanLine);
      });
      return filtered.join('\n').trim();
  };

  const handleSaveDayStatus = (type: SpecialDayType | null) => {
    if (!selectedDayStatusDate) return;
    const dateStr = getLocalDateStr(selectedDayStatusDate);
    
    // Calcoliamo i nuovi giorni speciali prima della ricerca della lezione successiva
    let newSpecialDays = specialDays.filter(sd => sd.date !== dateStr);
    if (type) newSpecialDays.push({ date: dateStr, type });

    // Creiamo una copia profonda delle note per evitare problemi di stato asincrono
    let notesToUpdate = lessonNotes.map(note => ({...note}));
    let contentMoved = false;

    if (type && type !== null) {
        const dayName = [null, DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN, DayOfWeek.SAB][selectedDayStatusDate.getDay()];
        if (dayName) {
            const dayLessons: Lesson[] = [];
            for (let h = 1; h <= maxHours; h++) {
                const l = resolveLessonForDateAndSlot(dayName, h, selectedDayStatusDate);
                if (l) dayLessons.push(l);
            }
            dayLessons.sort((a, b) => a.hour - b.hour);
            
            dayLessons.forEach(sourceLesson => {
                 const sourceNoteIndex = findTargetNoteIndex(notesToUpdate, sourceLesson.id, dateStr, sourceLesson.className, sourceLesson.subject, sourceLesson.hour, schedule, subjects, linkedSubjectGroups);
                 if (sourceNoteIndex >= 0) {
                     const note = { ...notesToUpdate[sourceNoteIndex] };
                     if (note.toCheck || note.toDo || note.misc) {
                        // Passiamo newSpecialDays e notesToUpdate alla funzione di ricerca per riflettere lo stato aggiornato
                        const next = findNextValidLesson(dateStr, sourceLesson.className, sourceLesson.subject, schedule, newSpecialDays, notesToUpdate, visibleDays, true);
                        if (next) {
                            const { lesson: targetLesson, dateStr: targetDateStr } = next;
                            const targetNoteIndex = findTargetNoteIndex(notesToUpdate, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
                            
                            let targetNote: LessonNote;
                            if (targetNoteIndex >= 0) {
                                targetNote = { ...notesToUpdate[targetNoteIndex], hour: targetLesson.hour };
                            } else {
                                targetNote = { lessonId: targetLesson.id, date: targetDateStr, hour: targetLesson.hour, className: targetLesson.className, subject: targetLesson.subject, toCheck: '', checkStatus: 'pending', toDo: '', doStatus: 'pending', misc: '', miscStatus: 'pending', type: 'lesson', reSynced: false };
                            }

                            targetNote.toCheck = addLinesWithoutDuplicates(targetNote.toCheck, note.toCheck);
                            targetNote.toDo = addLinesWithoutDuplicates(targetNote.toDo, note.toDo);
                            targetNote.misc = addLinesWithoutDuplicates(targetNote.misc, note.misc);
                            targetNote.reSynced = false;
                            
                            if (targetNoteIndex >= 0) {
                                notesToUpdate[targetNoteIndex] = targetNote;
                            } else {
                                notesToUpdate.push(targetNote);
                            }

                            note.toCheck = ''; note.toDo = ''; note.misc = '';
                            notesToUpdate[sourceNoteIndex] = note;
                            contentMoved = true;
                        }
                     }
                 }
            });
        }
    }
    
    // IMPORTANTE: Aggiorniamo lo stato e persistiamo nel database locale con i NUOVI dati
    setSpecialDays(newSpecialDays);
    setLessonNotes(notesToUpdate);
    
    persistLocalChanges({ 
        specialDays: newSpecialDays, 
        lessonNotes: notesToUpdate 
    });

    if (contentMoved) { 
        showToast('Tutti i compiti del giorno sono stati spostati alla prima data utile.', 'success'); 
    }
  };

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);
    if (direction === 'today') setCurrentDate(new Date());
    else if (direction === 'next') {
      const currentDay = newDate.getDay();
      const diffToMonday = currentDay === 0 ? 1 : 1 - currentDay;
      newDate.setDate(newDate.getDate() + diffToMonday + 7);
      setCurrentDate(newDate);
    } else {
      const currentDay = newDate.getDay();
      const targetDay = isSixDayWeek ? 6 : 5; 
      const diffToTarget = currentDay === 0 ? (targetDay - 7) : (targetDay - currentDay);
      newDate.setDate(newDate.getDate() + diffToTarget - 7);
      setCurrentDate(newDate);
    }
  };

  const handleSelectMonth = (date: Date) => { setCurrentDate(date); };
  const handleLessonClick = (lesson: Lesson, dateStr: string) => { 
    const mondayDateStr = getMondayFromDateStr(dateStr);
    const enrichedLesson = (isDisposizioneLesson(lesson) && !lesson.weekStart)
      ? { ...lesson, weekStart: mondayDateStr, repeatMode: lesson.repeatMode || 'weekly' }
      : lesson;
    setSelectedLesson({ lesson: enrichedLesson, dateStr }); 
    setIsAssignmentModalOpen(true); 
  };
  const handleEmptySlotClick = (day: DayOfWeek, hour: number, dateStr?: string) => { 
    setSelectedLesson(null);
    setAddLessonSlot({ day, hour, dateStr }); 
    setIsAddLessonModalOpen(true); 
  };

  const activeSchoolYear = useMemo(() => {
    const dateStr = getLocalDateStr(currentDate);
    return schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate) || schoolYears[0];
  }, [currentDate, schoolYears]);

  const filteredSchedule = useMemo(() => {
    const dateStr = getLocalDateStr(currentDate);
    const yearForDate = schoolYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate);
    
    if (!yearForDate) return [];
    
    return schedule.filter(l => {
        if (l.schoolYearId) return l.schoolYearId === yearForDate.id;
        // Se non ha ID, lo associamo al primo anno scolastico definito
        return yearForDate.id === schoolYears[0]?.id;
    });
  }, [schedule, currentDate, schoolYears]);

  const activeClasses = useMemo(() => {
    if (!activeSchoolYear) return classes;
    const yearClasses = classes.filter(c => c.schoolYearId === activeSchoolYear.id);
    if (yearClasses.length > 0) return yearClasses;
    const unassigned = classes.filter(c => !c.schoolYearId);
    return unassigned.length > 0 ? unassigned : classes;
  }, [classes, activeSchoolYear]);

  const activeSubjects = useMemo(() => {
    if (!activeSchoolYear) return subjects;
    const yearSubjects = subjects.filter(s => s.schoolYearId === activeSchoolYear.id);
    if (yearSubjects.length > 0) return yearSubjects;
    const unassigned = subjects.filter(s => !s.schoolYearId);
    return unassigned.length > 0 ? unassigned : subjects;
  }, [subjects, activeSchoolYear]);

  const handleAddLesson = (className: string, subject: string, room: string, repeatMode?: RepeatMode) => {
    if (addLessonSlot && activeSchoolYear) {
      const targetDateStr = addLessonSlot.dateStr || getLocalDateStr(currentDate);
      const mondayDateStr = getMondayFromDateStr(targetDateStr);
      const isProvisional = isWeekInProvisionalPeriod(mondayDateStr, provisionalPeriods, isSixDayWeek) || isDateInProvisionalPeriod(targetDateStr, provisionalPeriods);
      const isDisposiz = isDisposizioneLesson({ className } as Lesson);

      if (isProvisional) {
        const newLesson: Lesson = { 
          id: crypto.randomUUID(), 
          day: addLessonSlot.day, 
          hour: addLessonSlot.hour, 
          className, 
          subject, 
          room, 
          weekStart: mondayDateStr,
          schoolYearId: activeSchoolYear.id,
          isProvisional: true,
          ...(isDisposiz ? { repeatMode: repeatMode || 'none' } : {})
        };
        const cleanSchedule = schedule.filter(l => 
          !(l.isProvisional && l.weekStart === mondayDateStr && (l.schoolYearId === activeSchoolYear.id || (!l.schoolYearId && activeSchoolYear.id === schoolYears[0]?.id)) && l.day === addLessonSlot.day && l.hour === addLessonSlot.hour)
        );
        let newSchedule = [...cleanSchedule, newLesson];
        if (isDisposiz && (repeatMode === 'weekly' || repeatMode === 'biweekly')) {
          const res = applyLessonRepetition(newLesson, targetDateStr, repeatMode, newSchedule, activeSchoolYear, specialDays, schoolClosures);
          newSchedule = res.updatedSchedule;
        }
        setSchedule(newSchedule);
        setIsAddLessonModalOpen(false);
        setAddLessonSlot(null);
        persistLocalChanges({ schedule: newSchedule });
      } else {
        const newLesson: Lesson = { 
          id: crypto.randomUUID(), 
          day: addLessonSlot.day, 
          hour: addLessonSlot.hour, 
          className, 
          subject, 
          room, 
          schoolYearId: activeSchoolYear.id,
          isProvisional: false,
          ...(isDisposiz ? {
            weekStart: mondayDateStr,
            repeatMode: repeatMode || 'none',
          } : {})
        };
        const cleanSchedule = schedule.filter(l => 
          !(
            !l.isProvisional &&
            (l.schoolYearId === activeSchoolYear.id || (!l.schoolYearId && activeSchoolYear.id === schoolYears[0]?.id)) &&
            l.day === addLessonSlot.day &&
            l.hour === addLessonSlot.hour &&
            (!l.weekStart || l.weekStart === mondayDateStr)
          )
        );
        let newSchedule = [...cleanSchedule, newLesson];
        if (isDisposiz && (repeatMode === 'weekly' || repeatMode === 'biweekly')) {
          const res = applyLessonRepetition(newLesson, targetDateStr, repeatMode, newSchedule, activeSchoolYear, specialDays, schoolClosures);
          newSchedule = res.updatedSchedule;
        }
        setSchedule(newSchedule);
        setIsAddLessonModalOpen(false);
        setAddLessonSlot(null);
        persistLocalChanges({ schedule: newSchedule });
      }
    }
  };

  const handleDeleteLesson = (id: string, dateStrOverride?: string) => {
    const targetDateStr = dateStrOverride || selectedLesson?.dateStr || getLocalDateStr(currentDate);
    const mondayDateStr = getMondayFromDateStr(targetDateStr);
    const isProvisional = isWeekInProvisionalPeriod(mondayDateStr, provisionalPeriods, isSixDayWeek) || isDateInProvisionalPeriod(targetDateStr, provisionalPeriods);
    const existingLesson = schedule.find(l => l.id === id);

    if (isProvisional && existingLesson && activeSchoolYear) {
      const tombstone: Lesson = {
        id: crypto.randomUUID(),
        day: existingLesson.day,
        hour: existingLesson.hour,
        className: '',
        subject: '',
        room: '',
        weekStart: mondayDateStr,
        schoolYearId: existingLesson.schoolYearId || activeSchoolYear.id,
        isProvisional: true,
        isDeleted: true
      };

      const isProvForThisWeek = existingLesson.isProvisional && existingLesson.weekStart === mondayDateStr;

      const cleanSchedule = schedule.filter(l => {
        // Only remove existing provisional lesson for this exact week if deleting it directly
        if (isProvForThisWeek && l.id === id) return false;
        // Remove any duplicate tombstone or prov lesson for this slot in this provisional week
        if (l.isProvisional && l.weekStart === mondayDateStr && (l.schoolYearId === tombstone.schoolYearId || (!l.schoolYearId && tombstone.schoolYearId === schoolYears[0]?.id)) && l.day === tombstone.day && l.hour === tombstone.hour) {
          return false;
        }
        // Base definitive lessons must NOT be removed from schedule!
        return true;
      });
      const newSchedule = [...cleanSchedule, tombstone];
      setSchedule(newSchedule);
      persistLocalChanges({ schedule: newSchedule });
    } else {
      // Non-provisional: delete definitive lesson ONLY!
      const newSchedule = schedule.filter(l => !(l.id === id && !l.isProvisional));
      setSchedule(newSchedule);
      persistLocalChanges({ schedule: newSchedule });
    }
  };

  const handleSwapLessons = (sourceLessonId: string, targetDay: DayOfWeek, targetHour: number, sourceDateStr?: string, targetDateStr?: string) => {
      const sourceLesson = schedule.find(l => l.id === sourceLessonId);
      if (!sourceLesson || !activeSchoolYear) return;

      const effectiveSourceDateStr = sourceDateStr || targetDateStr || getLocalDateStr(currentDate);
      const effectiveTargetDateStr = targetDateStr || sourceDateStr || effectiveSourceDateStr;

      if (sourceLesson.day === targetDay && sourceLesson.hour === targetHour && effectiveSourceDateStr === effectiveTargetDateStr) {
          return;
      }

      const mondayDateStr = getMondayFromDateStr(effectiveSourceDateStr);
      const targetMondayDateStr = getMondayFromDateStr(effectiveTargetDateStr);

      const isProvisional = Boolean(
        sourceLesson.isProvisional ||
        isWeekInProvisionalPeriod(mondayDateStr, provisionalPeriods, isSixDayWeek) ||
        isWeekInProvisionalPeriod(targetMondayDateStr, provisionalPeriods, isSixDayWeek) ||
        isDateInProvisionalPeriod(effectiveSourceDateStr, provisionalPeriods) ||
        isDateInProvisionalPeriod(effectiveTargetDateStr, provisionalPeriods)
      );

      if (isProvisional) {
        const [ty, tm, td] = effectiveTargetDateStr.split('-').map(Number);
        const targetDate = new Date(ty, tm - 1, td, 12, 0, 0);
        const targetLesson = resolveLessonForDateAndSlot(targetDay, targetHour, targetDate);

        // Filtra lezioni provvisorie per la settimana considerata
        let newSchedule = schedule.filter(l => {
          if (
            l.isProvisional &&
            l.weekStart === mondayDateStr &&
            (l.schoolYearId === activeSchoolYear.id || (!l.schoolYearId && activeSchoolYear.id === schoolYears[0]?.id))
          ) {
            if ((l.day === sourceLesson.day && l.hour === sourceLesson.hour) || (l.day === targetDay && l.hour === targetHour)) {
              return false;
            }
            if (l.id === sourceLessonId || (targetLesson && l.id === targetLesson.id)) {
              return false;
            }
          }
          return true;
        });

        // Nuova istanza della lezione spostata nello slot di arrivo
        const newTargetProvId = crypto.randomUUID();
        const newTargetProv: Lesson = {
          id: newTargetProvId,
          day: targetDay,
          hour: targetHour,
          className: sourceLesson.className,
          subject: sourceLesson.subject,
          room: sourceLesson.room,
          weekStart: mondayDateStr,
          schoolYearId: sourceLesson.schoolYearId || activeSchoolYear.id,
          isProvisional: true,
          isDeleted: false
        };
        newSchedule.push(newTargetProv);

        let newSourceProv: Lesson | null = null;
        if (targetLesson && targetLesson.className && !targetLesson.isDeleted) {
          const newSourceProvId = crypto.randomUUID();
          newSourceProv = {
            id: newSourceProvId,
            day: sourceLesson.day,
            hour: sourceLesson.hour,
            className: targetLesson.className,
            subject: targetLesson.subject,
            room: targetLesson.room,
            weekStart: mondayDateStr,
            schoolYearId: targetLesson.schoolYearId || activeSchoolYear.id,
            isProvisional: true,
            isDeleted: false
          };
          newSchedule.push(newSourceProv);
        } else {
          // Nessuna lezione target: lo slot sorgente viene liberato
          newSchedule.push({
            id: crypto.randomUUID(),
            day: sourceLesson.day,
            hour: sourceLesson.hour,
            className: '',
            subject: '',
            room: '',
            weekStart: mondayDateStr,
            schoolYearId: activeSchoolYear.id,
            isProvisional: true,
            isDeleted: true
          });
        }

        // Trasferimento note e compiti (FARE, CONTROLLARE, VARIE e stati) strettamente per lezione/ora
        let newNotes = lessonNotes.map(note => {
          if (note.lessonId === sourceLessonId && note.date === effectiveSourceDateStr) {
            return {
              ...note,
              lessonId: newTargetProv.id,
              date: effectiveTargetDateStr,
              hour: targetHour,
              className: sourceLesson.className,
              subject: sourceLesson.subject
            };
          }
          if (targetLesson && note.lessonId === targetLesson.id && note.date === effectiveTargetDateStr) {
            if (newSourceProv) {
              return {
                ...note,
                lessonId: newSourceProv.id,
                date: effectiveSourceDateStr,
                hour: sourceLesson.hour,
                className: targetLesson.className,
                subject: targetLesson.subject
              };
            }
          }
          return note;
        });

        setSchedule(newSchedule);
        setLessonNotes(newNotes);
        persistLocalChanges({ schedule: newSchedule, lessonNotes: newNotes });

        if (selectedLesson && selectedLesson.lesson.id === sourceLessonId && selectedLesson.dateStr === effectiveSourceDateStr) {
          setSelectedLesson({ lesson: newTargetProv, dateStr: effectiveTargetDateStr });
        }
      } else {
        const targetLesson = schedule.find(
          l => !l.isProvisional &&
               !l.isDeleted &&
               (l.schoolYearId === activeSchoolYear.id || (!l.schoolYearId && activeSchoolYear.id === schoolYears[0]?.id)) &&
               l.day === targetDay &&
               l.hour === targetHour
        );

        let newSchedule = schedule.filter(l => l.id !== sourceLessonId);
        if (targetLesson) {
          newSchedule = newSchedule.filter(l => l.id !== targetLesson.id);
          newSchedule.push({
            ...targetLesson,
            day: sourceLesson.day,
            hour: sourceLesson.hour
          });
        }
        newSchedule.push({
          ...sourceLesson,
          day: targetDay,
          hour: targetHour
        });

        const newNotes = lessonNotes.map(note => {
          if (note.lessonId === sourceLessonId && note.date === effectiveSourceDateStr) {
            return {
              ...note,
              date: effectiveTargetDateStr,
              hour: targetHour,
              className: sourceLesson.className,
              subject: sourceLesson.subject
            };
          }
          if (targetLesson && note.lessonId === targetLesson.id && note.date === effectiveTargetDateStr) {
            return {
              ...note,
              date: effectiveSourceDateStr,
              hour: sourceLesson.hour,
              className: targetLesson.className,
              subject: targetLesson.subject
            };
          }
          return note;
        });

        setSchedule(newSchedule);
        setLessonNotes(newNotes);
        persistLocalChanges({ schedule: newSchedule, lessonNotes: newNotes });

        if (selectedLesson && selectedLesson.lesson.id === sourceLessonId && selectedLesson.dateStr === effectiveSourceDateStr) {
          setSelectedLesson({
            lesson: { ...sourceLesson, day: targetDay, hour: targetHour },
            dateStr: effectiveTargetDateStr
          });
        }
      }
  };

  const handleEditLesson = (lessonId: string, className: string, subject: string, room: string, dateStrOverride?: string, repeatMode?: RepeatMode) => {
    const targetDateStr = dateStrOverride || selectedLesson?.dateStr || getLocalDateStr(currentDate);
    const mondayDateStr = getMondayFromDateStr(targetDateStr);
    const isProvisional = isWeekInProvisionalPeriod(mondayDateStr, provisionalPeriods, isSixDayWeek) || isDateInProvisionalPeriod(targetDateStr, provisionalPeriods);
    const existingLesson = schedule.find(l => l.id === lessonId);
    const isDisposiz = className === 'A DISPOSIZIONE';

    if (isProvisional && existingLesson) {
      if (existingLesson.isProvisional && existingLesson.weekStart === mondayDateStr) {
        let newSchedule = schedule.map(l => l.id === lessonId ? { ...l, className, subject, room, isDeleted: false, ...(isDisposiz && repeatMode ? { repeatMode } : {}) } : l);
        let updatedLesson: Lesson = { ...existingLesson, className, subject, room, isDeleted: false, ...(isDisposiz && repeatMode ? { repeatMode } : {}) };
        if (isDisposiz && repeatMode && activeSchoolYear) {
          const res = applyLessonRepetition(updatedLesson, targetDateStr, repeatMode, newSchedule, activeSchoolYear, specialDays, schoolClosures);
          newSchedule = res.updatedSchedule;
          updatedLesson = res.updatedLesson;
        }
        setSchedule(newSchedule);
        persistLocalChanges({ schedule: newSchedule });
        if (selectedLesson && selectedLesson.lesson.id === lessonId) {
          setSelectedLesson({ ...selectedLesson, lesson: updatedLesson });
        }
      } else {
        const provLessonId = crypto.randomUUID();
        let provLesson: Lesson = {
          id: provLessonId,
          day: existingLesson.day,
          hour: existingLesson.hour,
          className,
          subject,
          room,
          weekStart: mondayDateStr,
          schoolYearId: existingLesson.schoolYearId || activeSchoolYear?.id,
          isProvisional: true,
          isDeleted: false,
          ...(isDisposiz ? { repeatMode: repeatMode || 'none' } : {})
        };
        const cleanSchedule = schedule.filter(l => 
          !(l.isProvisional && l.weekStart === mondayDateStr && (l.schoolYearId === provLesson.schoolYearId || (!l.schoolYearId && provLesson.schoolYearId === schoolYears[0]?.id)) && l.day === provLesson.day && l.hour === provLesson.hour)
        );
        let newSchedule = [...cleanSchedule, provLesson];
        if (isDisposiz && repeatMode && activeSchoolYear) {
          const res = applyLessonRepetition(provLesson, targetDateStr, repeatMode, newSchedule, activeSchoolYear, specialDays, schoolClosures);
          newSchedule = res.updatedSchedule;
          provLesson = res.updatedLesson;
        }

        let newNotes = lessonNotes;
        if (targetDateStr) {
          newNotes = lessonNotes.map(n => {
            if (n.lessonId === lessonId && n.date === targetDateStr) {
              return { ...n, lessonId: provLessonId, hour: provLesson.hour, className, subject };
            }
            return n;
          });
          setLessonNotes(newNotes);
        }

        setSchedule(newSchedule);
        persistLocalChanges({ schedule: newSchedule, ...(newNotes !== lessonNotes ? { lessonNotes: newNotes } : {}) });
        if (selectedLesson) {
          setSelectedLesson({ ...selectedLesson, lesson: provLesson, dateStr: targetDateStr });
        }
      }
    } else {
      // Non-provisional week: strictly update ONLY the definitive lesson (!l.isProvisional)
      let updatedTargetLesson: Lesson | undefined;
      let newSchedule = schedule.map(l => {
        if (!l.isProvisional && l.id === lessonId) {
          const updated: Lesson = { 
            ...l, 
            className, 
            subject, 
            room,
            ...(isDisposiz ? { weekStart: l.weekStart || mondayDateStr, repeatMode: repeatMode || l.repeatMode || 'none' } : {})
          };
          updatedTargetLesson = updated;
          return updated;
        }
        return l;
      });

      if (isDisposiz && repeatMode && updatedTargetLesson && activeSchoolYear) {
        const res = applyLessonRepetition(updatedTargetLesson, targetDateStr, repeatMode, newSchedule, activeSchoolYear, specialDays, schoolClosures);
        newSchedule = res.updatedSchedule;
        updatedTargetLesson = res.updatedLesson;
      }

      setSchedule(newSchedule);
      persistLocalChanges({ schedule: newSchedule });
      if (selectedLesson && selectedLesson.lesson.id === lessonId) {
        setSelectedLesson({ ...selectedLesson, lesson: updatedTargetLesson || { ...selectedLesson.lesson, className, subject, room } });
      }
    }
  };

  const handleUpdateLessonRepeatMode = (lesson: Lesson, mode: RepeatMode, dateStr: string) => {
    if (!activeSchoolYear) return;
    const { updatedSchedule, updatedLesson } = applyLessonRepetition(
      lesson,
      dateStr,
      mode,
      schedule,
      activeSchoolYear,
      specialDays,
      schoolClosures
    );
    setSchedule(updatedSchedule);
    if (selectedLesson && selectedLesson.lesson.id === lesson.id) {
      setSelectedLesson({ ...selectedLesson, lesson: updatedLesson });
    }
    persistLocalChanges({ schedule: updatedSchedule });

    if (mode === 'weekly') {
      showToast("Ripetizione impostata: ogni settimana fino al termine delle lezioni", "success");
    } else if (mode === 'biweekly') {
      showToast("Ripetizione impostata: a settimane alterne fino al termine delle lezioni", "success");
    } else {
      showToast("Ripetizione rimossa: l'ora rimane limitata a questa settimana", "info");
    }
  };

  const handleSaveNote = (note: LessonNote) => {
    const lesson = schedule.find(l => l.id === note.lessonId);
    const normalizedDate = normalizeNoteDate(note.date);
    const enrichedNote: LessonNote = {
      ...note,
      date: normalizedDate,
      hour: note.hour ?? lesson?.hour,
      className: note.className || lesson?.className || '',
      subject: note.subject || lesson?.subject || ''
    };
    const existingIndex = findTargetNoteIndex(
      lessonNotes,
      enrichedNote.lessonId,
      enrichedNote.date,
      enrichedNote.className,
      enrichedNote.subject,
      enrichedNote.hour,
      schedule,
      subjects,
      linkedSubjectGroups
    );
    let newNotes = [...lessonNotes];
    if (existingIndex >= 0) {
      newNotes[existingIndex] = enrichedNote;
      newNotes = newNotes.filter((n, idx) => {
        if (idx === existingIndex) return true;
        if (
          n.lessonId === enrichedNote.lessonId &&
          normalizeNoteDate(n.date) === enrichedNote.date &&
          !hasMeaningfulNoteContent(n)
        ) {
          return false;
        }
        return true;
      });
    } else {
      newNotes.push(enrichedNote);
    }
    setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
  };

  const handleUpdateNoteStatus = (lessonId: string, dateStr: string, field: 'toCheck' | 'toDo' | 'misc', text: string, newStatus: 'done' | 'not_done' | 'pending' | 'none') => {
      let newNotes = [...lessonNotes];
      const sourceLesson = schedule.find(l => l.id === lessonId);
      const existingNoteIndex = findTargetNoteIndex(newNotes, lessonId, dateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
      if (existingNoteIndex === -1) return;
      const currentNote = { ...newNotes[existingNoteIndex] };
      const lines = (currentNote[field] || '').split('\n');
      const updatedLines = lines.map(line => {
          const cleanLine = line.replace(/\{[VXO]\}/g, '').trim();
          if (cleanLine === text) {
              if (newStatus === 'done') return `{V} ${cleanLine}`;
              if (newStatus === 'not_done') return `{X} ${cleanLine}`;
              if (newStatus === 'pending') return `{O} ${cleanLine}`;
              return cleanLine;
          }
          return line;
      });
      currentNote[field] = updatedLines.join('\n');

      const sourceClassName = sourceLesson?.className || currentNote.className;
      const sourceSubject = sourceLesson?.subject || currentNote.subject || '';

      if (sourceLesson?.hour && !currentNote.hour) currentNote.hour = sourceLesson.hour;
      if (sourceClassName && !currentNote.className) currentNote.className = sourceClassName;
      if (sourceSubject && !currentNote.subject) currentNote.subject = sourceSubject;
      newNotes[existingNoteIndex] = currentNote;

      if (sourceClassName) {
          const next = findNextValidLesson(dateStr, sourceClassName, sourceSubject, schedule, specialDays, newNotes, visibleDays, true);
          if (next) {
              const { lesson: targetLesson, dateStr: targetDateStr } = next;
              const targetNoteIndex = findTargetNoteIndex(newNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
              let targetNote = targetNoteIndex >= 0 ? { ...newNotes[targetNoteIndex] } : { lessonId: targetLesson.id, date: targetDateStr, hour: targetLesson.hour, toCheck: '', checkStatus: 'pending', toDo: '', doStatus: 'pending', misc: '', miscStatus: 'pending', type: 'lesson' } as LessonNote;
              
              targetNote.lessonId = targetLesson.id;
              targetNote.date = targetDateStr;
              targetNote.hour = targetLesson.hour;
              targetNote.className = targetLesson.className;
              targetNote.subject = targetLesson.subject;

              targetNote.toCheck = removeText(targetNote.toCheck, text);
              targetNote.toDo = removeText(targetNote.toDo, text);
              targetNote.misc = removeText(targetNote.misc, text);
              if (newStatus !== 'none') {
                  if (field === 'toDo') {
                      if (newStatus === 'done') {
                          targetNote.toCheck = addLinesWithoutDuplicates(targetNote.toCheck, text);
                          targetNote.reSynced = false;
                      } else {
                          targetNote.toDo = addLinesWithoutDuplicates(targetNote.toDo, text);
                      }
                  } else if (field === 'toCheck') {
                      if (newStatus !== 'done') {
                          targetNote.toCheck = addLinesWithoutDuplicates(targetNote.toCheck, text);
                      }
                  } else if (field === 'misc') {
                      if (newStatus !== 'done') {
                          targetNote.misc = addLinesWithoutDuplicates(targetNote.misc, text);
                      }
                  }
              }
              if (targetNoteIndex >= 0) newNotes[targetNoteIndex] = targetNote;
              else if (newStatus !== 'none' || targetNote.toCheck || targetNote.toDo || targetNote.misc) newNotes.push(targetNote);

              if (newStatus === 'pending' || newStatus === 'not_done') {
                  const [ty, tm, td] = targetDateStr.split('-');
                  const statusLabel = newStatus === 'pending' ? 'Da finire' : 'Non fatto';
                  showToast(`${statusLabel}: spostato al ${td}/${tm}/${ty}`, 'info');
              }
          }
      }
      setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
  };

  const handleToggleREStatus = (lessonId: string, dateStr: string) => {
      let newNotes = [...lessonNotes];
      const lesson = schedule.find(s => s.id === lessonId);
      const index = findTargetNoteIndex(newNotes, lessonId, dateStr, lesson?.className, lesson?.subject, lesson?.hour, schedule, subjects, linkedSubjectGroups);
      if (index >= 0) {
          newNotes[index] = { ...newNotes[index], reSynced: !newNotes[index].reSynced };
      } else {
          newNotes.push({
              lessonId,
              date: dateStr,
              hour: lesson?.hour,
              className: lesson?.className || '',
              subject: lesson?.subject || '',
              toCheck: '',
              checkStatus: 'pending',
              toDo: '',
              doStatus: 'pending',
              misc: '',
              miscStatus: 'pending',
              type: 'lesson',
              reSynced: true
          });
      }
      setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
  };

  const handleToggleVotoStatus = (lessonId: string, dateStr: string) => {
    let newNotes = [...lessonNotes];
    const lesson = schedule.find(s => s.id === lessonId);
    const index = findTargetNoteIndex(newNotes, lessonId, dateStr, lesson?.className, lesson?.subject, lesson?.hour, schedule, subjects, linkedSubjectGroups);
    if (index >= 0) {
      newNotes[index] = { ...newNotes[index], votoSynced: !newNotes[index].votoSynced };
    } else {
      newNotes.push({
          lessonId,
          date: dateStr,
          hour: lesson?.hour,
          className: lesson?.className || '',
          subject: lesson?.subject || '',
          toCheck: '',
          checkStatus: 'pending',
          toDo: '',
          doStatus: 'pending',
          misc: '',
          miscStatus: 'pending',
          type: 'lesson',
          votoSynced: true
      });
    }
    setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
  };

  const handleMoveNoteItem = (lessonId: string, dateStr: string, field: 'toCheck' | 'toDo' | 'misc', text: string) => {
      const sourceLesson = schedule.find(l => l.id === lessonId);
      const sourceNoteIndex = findTargetNoteIndex(lessonNotes, lessonId, dateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
      const sourceNote = sourceNoteIndex >= 0 ? lessonNotes[sourceNoteIndex] : undefined;
      const className = sourceLesson?.className || sourceNote?.className;
      const subject = sourceLesson?.subject || sourceNote?.subject || '';
      if (!className) return;

      const next = findNextValidLesson(dateStr, className, subject, schedule, specialDays, lessonNotes, visibleDays, true);
      if (next) {
          const { lesson: targetLesson, dateStr: targetDateStr } = next;
          let newNotes = [...lessonNotes];
          if (sourceNoteIndex !== -1) {
              const updatedSource = { ...newNotes[sourceNoteIndex] };
              updatedSource[field] = removeText(updatedSource[field], text);
              newNotes[sourceNoteIndex] = updatedSource;
          }
          const targetNoteIndex = findTargetNoteIndex(newNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
          if (targetNoteIndex >= 0) {
              const targetNote = { ...newNotes[targetNoteIndex] };
              targetNote.lessonId = targetLesson.id;
              targetNote.date = targetDateStr;
              targetNote.hour = targetLesson.hour;
              targetNote.className = targetLesson.className;
              targetNote.subject = targetLesson.subject;
              targetNote.toCheck = removeText(targetNote.toCheck, text);
              targetNote.toDo = removeText(targetNote.toDo, text);
              targetNote.misc = removeText(targetNote.misc, text);
              targetNote[field] = addLinesWithoutDuplicates(targetNote[field], text);
              targetNote.reSynced = false; 
              newNotes[targetNoteIndex] = targetNote;
          } else {
              newNotes.push({ lessonId: targetLesson.id, date: targetDateStr, hour: targetLesson.hour, className: targetLesson.className, subject: targetLesson.subject, toCheck: field === 'toCheck' ? text : '', checkStatus: 'pending', toDo: field === 'toDo' ? text : '', doStatus: 'pending', misc: field === 'misc' ? text : '', miscStatus: 'pending', type: 'lesson', reSynced: false });
          }
          setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
          const [ty, tm, td] = targetDateStr.split('-');
          showToast(`Compito spostato al ${td}/${tm}/${ty}`, 'success');
      } else {
        showToast("Nessuna lezione futura valida trovata.", 'warning');
      }
  };

  const handlePropagateContent = (sourceLessonId: string, sourceDateStr: string, field: 'toCheck' | 'toDo' | 'misc', content: string) => {
      const sourceLesson = schedule.find(l => l.id === sourceLessonId);
      const sourceNoteIdx = findTargetNoteIndex(lessonNotes, sourceLessonId, sourceDateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
      const sourceNote = sourceNoteIdx >= 0 ? lessonNotes[sourceNoteIdx] : undefined;
      const className = sourceLesson?.className || sourceNote?.className;
      const subject = sourceLesson?.subject || sourceNote?.subject || '';
      if (!className) return;

      const next = findNextValidLesson(sourceDateStr, className, subject, schedule, specialDays, lessonNotes, visibleDays, true);
      if (next) {
          const { lesson: targetLesson, dateStr: targetDateStr } = next;
          const existingNoteIndex = findTargetNoteIndex(lessonNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
          let newNotes = [...lessonNotes];
          if (existingNoteIndex >= 0) {
              const updatedNote = { ...newNotes[existingNoteIndex] };
              updatedNote.lessonId = targetLesson.id;
              updatedNote.date = targetDateStr;
              updatedNote.hour = targetLesson.hour;
              updatedNote.className = targetLesson.className;
              updatedNote.subject = targetLesson.subject;
              updatedNote[field] = addLinesWithoutDuplicates(updatedNote[field], content);
              updatedNote.reSynced = false; newNotes[existingNoteIndex] = updatedNote;
          } else {
              newNotes.push({ lessonId: targetLesson.id, date: targetDateStr, hour: targetLesson.hour, className: targetLesson.className, subject: targetLesson.subject, toCheck: field === 'toCheck' ? content : '', checkStatus: 'pending', toDo: field === 'toDo' ? content : '', doStatus: 'pending', misc: field === 'misc' ? content : '', miscStatus: 'pending', type: 'lesson', reSynced: false });
          }
          setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
      }
  };
  
  const handleMoveAllLessonContent = (sourceLessonId: string, sourceDateStr: string, content: { toCheck: string, toDo: string, misc: string }): boolean => {
      const sourceLesson = schedule.find(l => l.id === sourceLessonId);
      const sourceNoteIdx = findTargetNoteIndex(lessonNotes, sourceLessonId, sourceDateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
      const sourceNote = sourceNoteIdx >= 0 ? lessonNotes[sourceNoteIdx] : undefined;
      const className = sourceLesson?.className || sourceNote?.className;
      const subject = sourceLesson?.subject || sourceNote?.subject || '';
      if (!className) return false;

      const next = findNextValidLesson(sourceDateStr, className, subject, schedule, specialDays, lessonNotes, visibleDays, true);
      if (next) {
          const { lesson: targetLesson, dateStr: targetDateStr } = next;
          const existingNoteIndex = findTargetNoteIndex(lessonNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
          let newNotes = [...lessonNotes];
          if (existingNoteIndex >= 0) {
              const note = { ...newNotes[existingNoteIndex] };
              note.lessonId = targetLesson.id;
              note.date = targetDateStr;
              note.hour = targetLesson.hour;
              note.className = targetLesson.className;
              note.subject = targetLesson.subject;
              if (content.toCheck) note.toCheck = addLinesWithoutDuplicates(note.toCheck, content.toCheck);
              if (content.toDo) note.toDo = addLinesWithoutDuplicates(note.toDo, content.toDo);
              if (content.misc) note.misc = addLinesWithoutDuplicates(note.misc, content.misc);
              note.reSynced = false; newNotes[existingNoteIndex] = note;
          } else {
              newNotes.push({ lessonId: targetLesson.id, date: targetDateStr, hour: targetLesson.hour, className: targetLesson.className, subject: targetLesson.subject, toCheck: content.toCheck, checkStatus: 'pending', toDo: content.toDo, doStatus: 'pending', misc: content.misc, miscStatus: 'pending', type: 'lesson', reSynced: false });
          }
          setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
          return true;
      }
      return false;
  };

  const handleRestoreContentFromNext = (sourceLessonId: string, sourceDateStr: string, content: { toCheck: string, toDo: string, misc: string }): void => {
      const sourceLesson = schedule.find(l => l.id === sourceLessonId);
      const sourceNoteIdx = findTargetNoteIndex(lessonNotes, sourceLessonId, sourceDateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
      const sourceNote = sourceNoteIdx >= 0 ? lessonNotes[sourceNoteIdx] : undefined;
      const className = sourceLesson?.className || sourceNote?.className;
      const subject = sourceLesson?.subject || sourceNote?.subject || '';
      if (!className) return;

      const next = findNextValidLesson(sourceDateStr, className, subject, schedule, specialDays, lessonNotes, visibleDays, true);
      if (next) {
          const { lesson: targetLesson, dateStr: targetDateStr } = next;
          const existingNoteIndex = findTargetNoteIndex(lessonNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
          if (existingNoteIndex >= 0) {
              let newNotes = [...lessonNotes];
              const note = { ...newNotes[existingNoteIndex] };
              if (content.toCheck) note.toCheck = removeText(note.toCheck, content.toCheck);
              if (content.toDo) note.toDo = removeText(note.toDo, content.toDo);
              if (content.misc) note.misc = removeText(note.misc, content.misc);
              newNotes[existingNoteIndex] = note;
              setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
          }
      }
  };

  const handleMoveToNextDay = (sourceLessonId: string, sourceDateStr: string, field: 'toCheck' | 'toDo' | 'misc', content: string) => {
      const sourceLesson = schedule.find(l => l.id === sourceLessonId);
      const sourceNoteIdx = findTargetNoteIndex(lessonNotes, sourceLessonId, sourceDateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
      const sourceNote = sourceNoteIdx >= 0 ? lessonNotes[sourceNoteIdx] : undefined;
      const className = sourceLesson?.className || sourceNote?.className;
      const subject = sourceLesson?.subject || sourceNote?.subject || '';
      if (!className) return false;

      const next = findNextValidLesson(sourceDateStr, className, subject, schedule, specialDays, lessonNotes, visibleDays, true);
      if (next) {
          const { lesson: targetLesson, dateStr: targetDateStr } = next;
          const existingNoteIndex = findTargetNoteIndex(lessonNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
          let newNotes = [...lessonNotes];
          if (existingNoteIndex >= 0) {
              const note = { ...newNotes[existingNoteIndex] };
              note.lessonId = targetLesson.id;
              note.date = targetDateStr;
              note.hour = targetLesson.hour;
              note.className = targetLesson.className;
              note.subject = targetLesson.subject;
              note.toCheck = removeText(note.toCheck, content);
              note.toDo = removeText(note.toDo, content);
              note.misc = removeText(note.misc, content);
              note[field] = addLinesWithoutDuplicates(note[field], content);
              note.reSynced = false; newNotes[existingNoteIndex] = note;
          } else {
              newNotes.push({ lessonId: targetLesson.id, date: targetDateStr, hour: targetLesson.hour, className: targetLesson.className, subject: targetLesson.subject, toCheck: field === 'toCheck' ? content : '', checkStatus: 'pending', toDo: field === 'toDo' ? content : '', doStatus: 'pending', misc: field === 'misc' ? content : '', miscStatus: 'pending', type: 'lesson', reSynced: false });
          }
          setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
          return true; 
      }
      return false;
  };

  const handleRemovePropagated = (sourceLessonId: string, sourceDateStr: string, content: string) => {
    const sourceLesson = schedule.find(l => l.id === sourceLessonId);
    const sourceNoteIdx = findTargetNoteIndex(lessonNotes, sourceLessonId, sourceDateStr, sourceLesson?.className, sourceLesson?.subject, sourceLesson?.hour, schedule, subjects, linkedSubjectGroups);
    const sourceNote = sourceNoteIdx >= 0 ? lessonNotes[sourceNoteIdx] : undefined;
    const className = sourceLesson?.className || sourceNote?.className;
    const subject = sourceLesson?.subject || sourceNote?.subject || '';
    if (!className) return;

    const next = findNextValidLesson(sourceDateStr, className, subject, schedule, specialDays, lessonNotes, visibleDays, true);
    if (next) {
        const { lesson: targetLesson, dateStr: targetDateStr } = next;
        const existingNoteIndex = findTargetNoteIndex(lessonNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
        if (existingNoteIndex === -1) return;
        let newNotes = [...lessonNotes];
        const note = { ...newNotes[existingNoteIndex] };
        note.toCheck = removeText(note.toCheck, content);
        note.toDo = removeText(note.toDo, content);
        note.misc = removeText(note.misc, content);
        newNotes[existingNoteIndex] = note;
        setLessonNotes(newNotes); persistLocalChanges({ lessonNotes: newNotes });
    }
  };

  const handleCopyPreviousWeek = () => { 
    if (confirm("Vuoi ripristinare l'orario predefinito per questo anno scolastico?")) { 
        if (!activeSchoolYear) return;
        const resetScheduleForYear = INITIAL_SCHEDULE.map(l => ({ 
            ...l, 
            id: crypto.randomUUID(), 
            schoolYearId: activeSchoolYear.id 
        }));
        const otherYearsSchedule = schedule.filter(l => l.schoolYearId !== activeSchoolYear.id);
        const newSchedule = [...otherYearsSchedule, ...resetScheduleForYear];
        setSchedule(newSchedule); 
        persistLocalChanges({ schedule: newSchedule }); 
    } 
  };
  
  const handleSaveStartDate = (newYears: SchoolYear[]) => {
    setSchoolYears(newYears);
    
    // Update active settings for current date
    const dateStr = getLocalDateStr(currentDate);
    const activeYear = newYears.find(y => dateStr >= y.startDate && dateStr <= y.endDate) || newYears[0];
    
    if (activeYear) {
        setSchoolStartDate(new Date(activeYear.startDate));
        setSchoolEndDate(new Date(activeYear.endDate));
        setSemesterSplitDate(new Date(activeYear.splitDate));
        setIsSixDayWeek(activeYear.isSixDayWeek);
        setSchoolClosures(activeYear.closures);
    }

    // Rigenera specialDays di tipo SCHOOL_CLOSED basandosi su TUTTE le chiusure di TUTTI gli anni
    let updatedSpecialDays = specialDays.filter(sd => sd.type !== 'SCHOOL_CLOSED');
    newYears.forEach(year => {
        year.closures.forEach((closure: SchoolClosure) => {
            let current = new Date(closure.startDate);
            const end = new Date(closure.endDate);
            while (current <= end) {
                const ds = getLocalDateStr(current);
                if (!updatedSpecialDays.find(sd => sd.date === ds)) {
                    updatedSpecialDays.push({ date: ds, type: 'SCHOOL_CLOSED' });
                }
                current.setDate(current.getDate() + 1);
            }
        });
    });

    setSpecialDays(updatedSpecialDays);
    setIsStartDateModalOpen(false);
    persistLocalChanges({ 
        schoolYears: newYears,
        specialDays: updatedSpecialDays
    });
  };

  const activeProvisionalPeriodForCurrentDate = useMemo(() => {
    const currDateStr = getLocalDateStr(currentDate);
    return getProvisionalPeriodForDate(currDateStr, provisionalPeriods);
  }, [currentDate, provisionalPeriods]);

  const handleSaveTimeSlot = (hour: number, newLabel: string) => {
      const nowIso = new Date().toISOString();
      if (activeProvisionalPeriodForCurrentDate) {
        const updatedPeriods = provisionalPeriods.map(p => {
          if (p.id === activeProvisionalPeriodForCurrentDate.id) {
            const currentSlots = p.timeSlots ? { ...p.timeSlots } : { ...timeSlots };
            return {
              ...p,
              updatedAt: nowIso,
              timeSlots: {
                ...currentSlots,
                [hour]: newLabel,
              },
            };
          }
          return p;
        });
        safeSetLocalStorage('magiclass_time_settings_updated_at', nowIso);
        setProvisionalPeriods(updatedPeriods);
        setIsEditTimeModalOpen(false);
        persistLocalChanges({ provisionalPeriods: updatedPeriods });
        return;
      }

      const [startStr, endStr] = newLabel.split('-').map(s => s.trim());
      const newDuration = timeToMinutes(endStr) - timeToMinutes(startStr);
      const updatedDurations = { ...durations, [hour]: newDuration };
      setDurations(updatedDurations);
      const firstHourStartMin = timeToMinutes((timeSlots[1] || DEFAULT_TIME_SLOTS[1] || '08:00 - 09:00').split('-')[0].trim());
      const newTimeSlots = recalculateScheduleChain(updatedDurations, recesses, hour === 1 ? timeToMinutes(startStr) : firstHourStartMin);
      safeSetLocalStorage('magiclass_time_settings_updated_at', nowIso);
      setTimeSlots(newTimeSlots);
      setIsEditTimeModalOpen(false);
      persistLocalChanges({ timeSlots: newTimeSlots, durations: updatedDurations });
  };

  const handleSaveRecesses = (newRecesses: Recess[]) => {
      const nowIso = new Date().toISOString();
      setRecesses(newRecesses); setIsRecessModalOpen(false);
      const firstHourStartMin = timeToMinutes((timeSlots[1] || DEFAULT_TIME_SLOTS[1] || '08:00 - 09:00').split('-')[0].trim());
      const newTimeSlots = recalculateScheduleChain(durations, newRecesses, firstHourStartMin);
      safeSetLocalStorage('magiclass_time_settings_updated_at', nowIso);
      setTimeSlots(newTimeSlots); persistLocalChanges({ recesses: newRecesses, timeSlots: newTimeSlots });
  };

  const handleSaveSubjects = (newSubjects: Subject[]) => {
    if (!activeSchoolYear) {
      setSubjects(newSubjects);
      persistLocalChanges({ subjects: newSubjects });
      return;
    }
    const tagged = newSubjects.map(s => ({
      ...s,
      schoolYearId: activeSchoolYear.id
    }));
    const otherYearsSubjects = subjects.filter(s => s.schoolYearId && s.schoolYearId !== activeSchoolYear.id);
    const combined = [...otherYearsSubjects, ...tagged];
    setSubjects(combined);
    persistLocalChanges({ subjects: combined });
  };

  const handleSaveClasses = (newClasses: ClassEntity[]) => {
    if (!activeSchoolYear) {
      setClasses(newClasses);
      persistLocalChanges({ classes: newClasses });
      return;
    }
    const tagged = newClasses.map(c => ({
      ...c,
      schoolYearId: activeSchoolYear.id
    }));
    const otherYearsClasses = classes.filter(c => c.schoolYearId && c.schoolYearId !== activeSchoolYear.id);
    const combined = [...otherYearsClasses, ...tagged];
    setClasses(combined);
    persistLocalChanges({ classes: combined });
  };

  const handleSaveLinkedSubjectGroups = (newGroups: LinkedSubjectGroup[]) => { 
    setLinkedSubjectGroups(newGroups); 
    localStorage.setItem('techdraw_linked_subject_groups', JSON.stringify(newGroups));
    persistLocalChanges({ linkedSubjectGroups: newGroups }); 
  };

  const handleSaveMaxHours = (newMax: number) => {
      const nowIso = new Date().toISOString();
      safeSetLocalStorage('magiclass_time_settings_updated_at', nowIso);
      setMaxHours(newMax);
      const updatedTimeSlots = { ...timeSlots };
      const updatedDurations = { ...durations };
      let changed = false;
      for(let i=1; i<=newMax; i++) {
          if (!updatedTimeSlots[i]) { updatedTimeSlots[i] = DEFAULT_TIME_SLOTS[i] || "00:00 - 00:00"; changed = true; }
          if (!updatedDurations[i]) { updatedDurations[i] = DEFAULT_DURATIONS[i] || 60; changed = true; }
      }
      if (changed) { setTimeSlots(updatedTimeSlots); setDurations(updatedDurations); }
      persistLocalChanges({ maxHours: newMax, timeSlots: changed ? updatedTimeSlots : timeSlots, durations: changed ? updatedDurations : durations });
  };

  const handleSaveTaskTemplates = (newTemplates: TaskTemplate[]) => {
      if (JSON.stringify(newTemplates) === JSON.stringify(taskTemplates)) return;
      setTaskTemplates(newTemplates);
      persistLocalChanges({ taskTemplates: newTemplates });
  };

  const handleSaveProvisionalPeriods = (newPeriods: ProvisionalSchedulePeriod[]) => {
      const nowIso = new Date().toISOString();
      const stampedPeriods = newPeriods.map(np => {
        const prev = provisionalPeriods.find(op => op.id === np.id);
        const isModified = !prev || JSON.stringify(prev) !== JSON.stringify(np);
        return isModified ? { ...np, updatedAt: nowIso } : np;
      });
      safeSetLocalStorage('magiclass_time_settings_updated_at', nowIso);
      setProvisionalPeriods(stampedPeriods);
      const updatedSchedule = syncProvisionalPeriodsWithSchedule(schedule, stampedPeriods, schoolYears);
      const reallocatedNotes = reallocateLessonNotesForPeriods(
        lessonNotes,
        schedule,
        updatedSchedule,
        provisionalPeriods,
        stampedPeriods,
        schoolYears,
        visibleDays,
        maxHours
      );
      setSchedule(updatedSchedule);
      setLessonNotes(reallocatedNotes);
      try {
        localStorage.setItem('techdraw_provisional_periods', JSON.stringify(stampedPeriods));
        localStorage.setItem('techdraw_schedule', JSON.stringify(updatedSchedule));
        localStorage.setItem('techdraw_notes', JSON.stringify(reallocatedNotes));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      persistLocalChanges({
        provisionalPeriods: stampedPeriods,
        schedule: updatedSchedule,
        lessonNotes: reallocatedNotes
      });
  };

  const getFullBackupPayload = useCallback(() => {
    const effectiveYears: SchoolYear[] = schoolYears.length > 0 ? schoolYears : [{
      id: crypto.randomUUID(),
      label: `${schoolStartDate.getFullYear()}/${schoolStartDate.getFullYear() + 1}`,
      startDate: getLocalDateStr(schoolStartDate),
      endDate: getLocalDateStr(schoolEndDate),
      splitDate: getLocalDateStr(semesterSplitDate),
      isSixDayWeek: isSixDayWeek,
      closures: schoolClosures
    }];

    // Individuazione automatica dell'anno scolastico in corso secondo le regole dell'app
    const currentDateStr = getLocalDateStr(currentDate);
    const selectedYear = effectiveYears.find(y => currentDateStr >= y.startDate && currentDateStr <= y.endDate)
      || activeSchoolYear 
      || effectiveYears[0];

    // Filtra esclusivamente i dati operativi appartenenti all'anno scolastico in corso
    const filteredSchedule = schedule.filter(l => {
      if (l.schoolYearId) return l.schoolYearId === selectedYear.id;
      return selectedYear.id === effectiveYears[0]?.id;
    });

    const filteredLessonNotes = lessonNotes.filter(note => {
      if (!note.date) return false;
      return note.date >= selectedYear.startDate && note.date <= selectedYear.endDate;
    });

    const filteredSpecialDays = specialDays.filter(sd => {
      return sd.date >= selectedYear.startDate && sd.date <= selectedYear.endDate;
    });

    const filteredClosures = selectedYear.closures || [];

    const filteredProvisionalPeriods = (provisionalPeriods || []).filter(p => {
      return p.startDate <= selectedYear.endDate && p.endDate >= selectedYear.startDate;
    });

    const yearStartDate = new Date(selectedYear.startDate);
    yearStartDate.setHours(12, 0, 0, 0);
    const yearEndDate = new Date(selectedYear.endDate);
    yearEndDate.setHours(12, 0, 0, 0);
    const yearSplitDate = new Date(selectedYear.splitDate);
    yearSplitDate.setHours(12, 0, 0, 0);

    // Recupero dell'intero database compiti da Impostazioni -> Database compiti (inclusi i non assegnati)
    let allTaskTemplates = taskTemplates;
    if (!allTaskTemplates || allTaskTemplates.length === 0) {
      try {
        const rawSaved = localStorage.getItem('techdraw_task_templates');
        if (rawSaved) allTaskTemplates = JSON.parse(rawSaved);
      } catch (e) {
        console.warn('Errore lettura techdraw_task_templates:', e);
      }
    }

    const exportedTimeSlots: Record<number, string> = JSON.parse(JSON.stringify(timeSlots || {}));
    const exportedDurations: Record<number, number> = JSON.parse(JSON.stringify(durations || {}));
    const exportedRecesses: Recess[] = JSON.parse(JSON.stringify(recesses || []));
    const exportedProvisionalPeriods: ProvisionalSchedulePeriod[] = JSON.parse(JSON.stringify(filteredProvisionalPeriods || []));
    const exportedSelectedYear: SchoolYear = {
      ...selectedYear,
      timeSlots: exportedTimeSlots,
      durations: exportedDurations,
      recesses: exportedRecesses,
      maxHours
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return {
      exportedAt: localIso,
      createdAt: localIso,
      appVersion: APP_VERSION,
      schedule: filteredSchedule,
      lessonNotes: filteredLessonNotes,
      specialDays: filteredSpecialDays,
      schoolClosures: filteredClosures,
      timeSlots: exportedTimeSlots,
      recesses: exportedRecesses,
      subjects: activeSubjects,
      classes: activeClasses,
      schoolStartDate: yearStartDate.toISOString(),
      schoolEndDate: yearEndDate.toISOString(),
      semesterSplitDate: yearSplitDate.toISOString(),
      isSixDayWeek: selectedYear.isSixDayWeek,
      durations: exportedDurations,
      maxHours,
      timeSettingsUpdatedAt: localStorage.getItem('magiclass_time_settings_updated_at') || undefined,
      // Database compiti completo (fonte ufficiale da Impostazioni -> Database compiti)
      taskTemplates: allTaskTemplates || [],
      schoolYears: [exportedSelectedYear],
      provisionalPeriods: exportedProvisionalPeriods,
      linkedSubjectGroups: linkedSubjectGroups || []
    };
  }, [schoolYears, schoolStartDate, schoolEndDate, semesterSplitDate, isSixDayWeek, schoolClosures, activeSchoolYear, schedule, lessonNotes, specialDays, provisionalPeriods, timeSlots, recesses, activeSubjects, activeClasses, durations, maxHours, taskTemplates, linkedSubjectGroups, currentDate]);

  const handleSelectiveRestore = async (
    backupJson: any, 
    targetYearSummary: DetectedYearSummary, 
    navigateToRestoredYear?: boolean,
    fileName?: string
  ) => {
    // 1. Crea snapshot automatico di sicurezza dello stato corrente prima di qualsiasi modifica
    const previousState = buildCurrentLocalAppStateRef.current();
    const safetySnapshot = await createLocalSnapshot(
      previousState,
      'pre_restore',
      `Stato pre-ripristino A.S. ${targetYearSummary.label}`
    );

    try {
      const result = performSelectiveRestore({
        backupJson,
        targetYearSummary,
        currentState: {
          schoolYears,
          schedule,
          lessonNotes,
          specialDays,
          schoolClosures,
          provisionalPeriods,
          classes,
          subjects,
          taskTemplates,
          linkedSubjectGroups,
          timeSlots,
          durations,
          recesses,
          maxHours,
          currentDate
        }
      });

      const nextTimeSettingsUpdatedAt = new Date().toISOString();
      const fullRestoredState: LocalAppState = {
        ...previousState,
        schoolYears: result.newState.schoolYears,
        schedule: result.newState.schedule,
        lessonNotes: result.newState.lessonNotes,
        specialDays: result.newState.specialDays,
        schoolClosures: result.newState.schoolClosures,
        provisionalPeriods: result.newState.provisionalPeriods,
        classes: result.newState.classes,
        subjects: result.newState.subjects,
        taskTemplates: result.newState.taskTemplates,
        linkedSubjectGroups: result.newState.linkedSubjectGroups,
        timeSlots: result.newState.timeSlots && Object.keys(result.newState.timeSlots).length > 0 ? result.newState.timeSlots : previousState.timeSlots,
        durations: result.newState.durations && Object.keys(result.newState.durations).length > 0 ? result.newState.durations : previousState.durations,
        recesses: result.newState.recesses !== undefined ? result.newState.recesses : previousState.recesses,
        maxHours: result.newState.maxHours || previousState.maxHours,
        timeSettingsUpdatedAt: nextTimeSettingsUpdatedAt
      };

      // 2. Scrittura atomica su IndexedDB prima di confermare
      const writeResult = await saveAppStateToLocalDb(fullRestoredState);
      if (!writeResult.ok) {
        throw new Error(writeResult.errorMessage || 'Scrittura database locale fallita durante il ripristino.');
      }

      applyLocalAppStateToReact(fullRestoredState);

      if (navigateToRestoredYear) {
        const [y, m, d] = targetYearSummary.startDate.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d, 12, 0, 0);
        setCurrentDate(targetDate);
      }

      const extractedTimestamp = extractBackupTimestamp(backupJson, fileName);
      const finalBackupTimestamp = extractedTimestamp || new Date().toISOString();
      safeSetLocalStorage(LAST_BACKUP_STORAGE_KEY, finalBackupTimestamp);
      safeSetLocalStorage('magiclass_last_backup_source', 'restore');
      safeSetLocalStorage('magiclass_last_restored_backup_time', finalBackupTimestamp);
      setLastBackupTime(finalBackupTimestamp);

      return result;
    } catch (err) {
      // Rollback automatico allo snapshot pre-ripristino in caso di errore
      if (safetySnapshot && safetySnapshot.data) {
        await saveAppStateToLocalDb(safetySnapshot.data);
        applyLocalAppStateToReact(safetySnapshot.data);
      }
      throw err;
    }
  };

  const handleRollbackToSnapshot = async (snapshotId: string): Promise<boolean> => {
    const snap = await getSnapshotById(snapshotId);
    if (!snap || !snap.data) {
      throw new Error('Snapshot di sicurezza non trovato.');
    }
    const writeResult = await saveAppStateToLocalDb(snap.data);
    if (!writeResult.ok) {
      throw new Error(writeResult.errorMessage || 'Impossibile ripristinare lo snapshot precedente.');
    }
    applyLocalAppStateToReact(snap.data);
    showToast('Stato precedente al ripristino recuperato correttamente.', 'success');
    return true;
  };

  const handleExportTasks = (format: 'txt' | 'doc', targetYearId?: string) => {
      const effectiveYears: SchoolYear[] = schoolYears.length > 0 ? schoolYears : [{
        id: crypto.randomUUID(),
        label: `${schoolStartDate.getFullYear()}/${schoolStartDate.getFullYear() + 1}`,
        startDate: getLocalDateStr(schoolStartDate),
        endDate: getLocalDateStr(schoolEndDate),
        splitDate: getLocalDateStr(semesterSplitDate),
        isSixDayWeek: isSixDayWeek,
        closures: schoolClosures
      }];

      const selectedYear = effectiveYears.find(y => y.id === targetYearId) || activeSchoolYear || effectiveYears[0];
      const cleanLine = (txt: string) => txt.replace(/\{[VXO]\}/g, '').trim();
      const exportDate = new Date().toLocaleDateString('it-IT');

      interface ExportNoteItem {
        note: LessonNote;
        lesson: Lesson;
        subjectName: string;
      }
      const classMap: Record<string, ExportNoteItem[]> = {};

      const resolveSubjectName = (lesson: Lesson): string => {
        if (lesson.subject && lesson.subject.trim()) {
          const subById = subjects.find(s => s.id === lesson.subject);
          if (subById && subById.name) return subById.name;
          return lesson.subject.trim();
        }
        if (classes && classes.length > 0) {
          const cls = classes.find(c => c.name === lesson.className);
          if (cls && cls.subjectIds && cls.subjectIds.length > 0) {
            const sub = subjects.find(s => s.id === cls.subjectIds![0]);
            if (sub && sub.name) return sub.name;
          }
        }
        return '';
      };

      // Filtra ESCLUSIVAMENTE le note appartenenti all'intervallo dell'anno scolastico selezionato
      const yearNotes = lessonNotes.filter(note => {
        if (!note.date) return false;
        return note.date >= selectedYear.startDate && note.date <= selectedYear.endDate;
      });

      yearNotes.forEach(note => {
          let lesson = schedule.find(l => l.id === note.lessonId && (l.schoolYearId === selectedYear.id || (!l.schoolYearId && selectedYear.id === effectiveYears[0]?.id)));
          if (!lesson) {
            const candidate = schedule.find(l => l.id === note.lessonId);
            if (candidate && (!candidate.schoolYearId || candidate.schoolYearId === selectedYear.id)) {
              lesson = candidate;
            }
          }
          if (!lesson) {
            lesson = schedule.find(l => l.id === note.lessonId);
          }
          if (lesson) {
              if (!classMap[lesson.className]) classMap[lesson.className] = [];
              const subjectName = resolveSubjectName(lesson);
              classMap[lesson.className].push({
                note,
                lesson,
                subjectName
              });
          }
      });

      const safeYearLabel = selectedYear.label.replace(/[^a-zA-Z0-9_-]/g, '-');
      if (format === 'txt') {
          let content = `MAGIDARIO - RIEPILOGO COMPITI (A.S. ${selectedYear.label})\nEsportato il: ${exportDate}\n\n`;
          const classNames = Object.keys(classMap).sort();
          if (classNames.length === 0) {
              content += `Nessuna lezione o nota presente per l'A.S. ${selectedYear.label}.\n`;
          } else {
              classNames.forEach(cls => {
                  content += `CLASSE: ${cls}\n==========================================\n`;
                  classMap[cls].sort((a,b) => {
                      const timeDiff = new Date(a.note.date).getTime() - new Date(b.note.date).getTime();
                      if (timeDiff !== 0) return timeDiff;
                      return (a.lesson.hour || 0) - (b.lesson.hour || 0);
                  }).forEach(({ note, subjectName }) => {
                      const dateFormatted = note.date.includes('-')
                          ? note.date.split('-').reverse().join('/')
                          : new Date(note.date).toLocaleDateString('it-IT');
                      const headerText = subjectName ? `${dateFormatted} – ${subjectName}` : dateFormatted;
                      content += `\nData: ${headerText}\n`;
                      if (note.toCheck && note.toCheck.split('\n').some(l => cleanLine(l).length > 0)) {
                          content += `  [CONTROLLARE]:\n    ${note.toCheck.split('\n').map(cleanLine).filter(Boolean).join('\n    ')}\n`;
                      }
                      if (note.toDo && note.toDo.split('\n').some(l => cleanLine(l).length > 0)) {
                          content += `  [DA FARE]:\n    ${note.toDo.split('\n').map(cleanLine).filter(Boolean).join('\n    ')}\n`;
                      }
                      if (note.misc && note.misc.split('\n').some(l => cleanLine(l).length > 0)) {
                          content += `  [VARIE]:\n    ${note.misc.split('\n').map(cleanLine).filter(Boolean).join('\n    ')}\n`;
                      }
                  });
                  content += `\n\n`;
              });
          }
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); 
          a.href = url; 
          a.download = `compiti_magiclass_AS_${safeYearLabel}_${getLocalDateStr(new Date())}.txt`; 
          a.click(); 
          URL.revokeObjectURL(url);
      } else {
          let html = `<html><head><meta charset='utf-8'><title>Riepilogo Compiti MagiClass - A.S. ${escapeHtml(selectedYear.label)}</title><style>body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333; } h1 { color: #810027; text-align: center; border-bottom: 2px solid #810027; padding-bottom: 10px; } .class-section { margin-top: 30px; } .class-title { background: #f8fafc; padding: 10px; border-left: 5px solid #810027; font-size: 18pt; font-weight: bold; } .note-date { font-weight: bold; color: #475569; margin-top: 15px; font-size: 13pt; text-decoration: underline; } .task-block { margin-left: 20px; margin-top: 5px; } .label { font-weight: bold; text-transform: uppercase; font-size: 9pt; } .label-check { color: #b45309; } .label-do { color: #1d4ed8; } .label-misc { color: #6d28d9; } ul { margin-top: 2px; margin-bottom: 5px; }</style></head><body><h1>RIEPILOGO COMPITI E ATTIVITÀ</h1><p style='text-align:center'><b>Anno Scolastico ${escapeHtml(selectedYear.label)}</b><br><i>Generato il ${escapeHtml(exportDate)} da MagiClass</i></p>`;
          const classNames = Object.keys(classMap).sort();
          if (classNames.length === 0) {
              html += `<p style='text-align:center;color:#64748b;margin-top:40px;'><i>Nessuna lezione o nota presente per l'A.S. ${escapeHtml(selectedYear.label)}.</i></p>`;
          } else {
              classNames.forEach(cls => {
                  html += `<div class="class-section"><div class="class-title">CLASSE: ${escapeHtml(cls)}</div>`;
                  classMap[cls].sort((a,b) => {
                      const timeDiff = new Date(a.note.date).getTime() - new Date(b.note.date).getTime();
                      if (timeDiff !== 0) return timeDiff;
                      return (a.lesson.hour || 0) - (b.lesson.hour || 0);
                  }).forEach(({ note, subjectName }) => {
                      const dateFormatted = note.date.includes('-')
                          ? note.date.split('-').reverse().join('/')
                          : new Date(note.date).toLocaleDateString('it-IT');
                      const headerText = subjectName ? `${dateFormatted} – ${subjectName}` : dateFormatted;
                      html += `<div class="note-date">${escapeHtml(headerText)}</div>`;
                      
                      const hasToCheck = note.toCheck && note.toCheck.split('\n').some(l => cleanLine(l).length > 0);
                      if (hasToCheck) { 
                          html += `<div class="task-block"><span class="label label-check">[Controllare]</span><ul>`; 
                          note.toCheck.split('\n').forEach(l => { 
                              const c = cleanLine(l);
                              if (c) html += `<li>${escapeHtml(c)}</li>`; 
                          }); 
                          html += `</ul></div>`; 
                      }
                      
                      const hasToDo = note.toDo && note.toDo.split('\n').some(l => cleanLine(l).length > 0);
                      if (hasToDo) { 
                          html += `<div class="task-block"><span class="label label-do">[Da Fare]</span><ul>`; 
                          note.toDo.split('\n').forEach(l => { 
                              const c = cleanLine(l);
                              if (c) html += `<li>${escapeHtml(c)}</li>`; 
                          }); 
                          html += `</ul></div>`; 
                      }
                      
                      const hasMisc = note.misc && note.misc.split('\n').some(l => cleanLine(l).length > 0);
                      if (hasMisc) { 
                          html += `<div class="task-block"><span class="label label-misc">[Varie]</span><ul>`; 
                          note.misc.split('\n').forEach(l => { 
                              const c = cleanLine(l);
                              if (c) html += `<li>${escapeHtml(c)}</li>`; 
                          }); 
                          html += `</ul></div>`; 
                      }
                  });
                  html += `</div>`;
              });
          }
          html += `</body></html>`;
          const blob = new Blob([html], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); 
          a.href = url; 
          a.download = `compiti_magiclass_AS_${safeYearLabel}_${getLocalDateStr(new Date())}.doc`; 
          a.click(); 
          URL.revokeObjectURL(url);
      }
  };

  const handleGoToNote = (dateStr: string, lessonId: string) => {
      const targetDate = new Date(dateStr); targetDate.setHours(12, 0, 0, 0); setCurrentDate(targetDate); setHighlightedLessonId(lessonId); setIsSearchModalOpen(false); setTimeout(() => setHighlightedLessonId(null), 5000);
  };

  return (
    <div className="h-[100dvh] w-screen bg-slate-50 flex flex-col text-slate-900">
      <ScheduleView 
        schedule={filteredSchedule} provisionalPeriods={provisionalPeriods} lessonNotes={lessonNotes} currentDate={currentDate} schoolStartDate={schoolStartDate} schoolEndDate={schoolEndDate} schoolYears={schoolYears} semesterSplitDate={semesterSplitDate} specialDays={specialDays} timeSlots={timeSlots} recesses={recesses} subjects={activeSubjects} classes={activeClasses} activeDays={visibleDays} maxHours={maxHours} highlightedLessonId={highlightedLessonId}
        focusClass={focusClass}
        weekCount={getWeekNumberFormatted()}
        lastBackupTime={lastBackupTime}
        onLessonClick={handleLessonClick} onEmptySlotClick={handleEmptySlotClick} onNavigate={handleNavigate} onOpenStartDateModal={() => setIsStartDateModalOpen(true)} onCopyPreviousWeek={handleCopyPreviousWeek} onDayHeaderClick={handleDayHeaderClick} onUndo={handleUndo} canUndo={historyIndex > 0} onRedo={handleRedo} canRedo={historyIndex < history.length - 1} onOpenBackup={() => setIsBackupModalOpen(true)} onOpenGuide={() => setIsGuideModalOpen(true)} onTimeSlotClick={(hour) => { setEditingTimeHour(hour); setIsEditTimeModalOpen(true); }} onOpenRecessModal={() => setIsRecessModalOpen(true)} onOpenMonthPicker={() => setIsMonthPickerOpen(true)} onOpenSettings={() => setIsSettingsMenuOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenRemainingHours={() => setIsRemainingHoursModalOpen(true)}
        onOpenClassFilter={() => setIsClassFilterModalOpen(true)}
        onSwapLessons={handleSwapLessons} onUpdateNoteStatus={handleUpdateNoteStatus} onMoveNoteItem={handleMoveNoteItem}
        onToggleREStatus={handleToggleREStatus}
        onToggleVotoStatus={handleToggleVotoStatus}
      />
      {isAssignmentModalOpen && selectedLesson && (
        <AssignmentModal
          lesson={selectedLesson.lesson} 
          dateStr={selectedLesson.dateStr} 
          isOpen={isAssignmentModalOpen} 
          onClose={() => { if (selectedLesson) { setHighlightedLessonId(selectedLesson.lesson.id); setTimeout(() => setHighlightedLessonId(null), 5000); } setIsAssignmentModalOpen(false); }}
          note={(() => {
            const idx = findTargetNoteIndex(lessonNotes, selectedLesson.lesson.id, selectedLesson.dateStr, selectedLesson.lesson.className, selectedLesson.lesson.subject, selectedLesson.lesson.hour, schedule, subjects, linkedSubjectGroups);
            return idx >= 0 ? lessonNotes[idx] : undefined;
          })()} 
          allNotes={lessonNotes} 
          taskTemplates={taskTemplates} 
          onSaveNote={handleSaveNote} 
          onDeleteLesson={handleDeleteLesson} 
          onPropagate={handlePropagateContent} 
          onMoveToNextDay={handleMoveToNextDay} 
          onMoveAllToNext={handleMoveAllLessonContent} 
          onMoveNoteItem={handleMoveNoteItem} 
          onRemovePropagated={handleRemovePropagated} 
          onRestoreFromNext={handleRestoreContentFromNext} 
          onEdit={() => { setIsAssignmentModalOpen(false); setTimeout(() => setIsAddLessonModalOpen(true), 100); }}
          students={activeClasses.find(c => c.name.replace(/\s+/g, '').toUpperCase() === selectedLesson.lesson.className.replace(/\s+/g, '').toUpperCase())?.students || []}
          onAddRecoveryNote={(absentNames, examType) => {
            const next = findNextValidLesson(selectedLesson.dateStr, selectedLesson.lesson.className, selectedLesson.lesson.subject, schedule, specialDays, lessonNotes, visibleDays, true);
            if (next) {
              const { lesson: targetLesson, dateStr: targetDateStr } = next;
              
              let recoveryText = "";
              if (examType === 'submission_submission') {
                  recoveryText = `ASSENTI CONSEGNA: ${absentNames.join(', ')}`;
              } else {
                  const typeLabel = examType === 'practical_exam' ? 'PRATICO' : examType === 'oral_exam' ? 'TEORIA' : 'SCRITTO';
                  recoveryText = `RECUPERO ${typeLabel}: ${absentNames.join(', ')}`;
              }
              
              let newNotes = [...lessonNotes];
              const targetNoteIndex = findTargetNoteIndex(newNotes, targetLesson.id, targetDateStr, targetLesson.className, targetLesson.subject, targetLesson.hour, schedule, subjects, linkedSubjectGroups);
              
              let targetNote: LessonNote;
              if (targetNoteIndex >= 0) {
                targetNote = { ...newNotes[targetNoteIndex] };
                targetNote.lessonId = targetLesson.id;
                targetNote.date = targetDateStr;
                targetNote.hour = targetLesson.hour;
                targetNote.className = targetLesson.className;
                targetNote.subject = targetLesson.subject;
                targetNote.misc = (targetNote.misc ? targetNote.misc + '\n' : '') + recoveryText;
              } else {
                targetNote = {
                  lessonId: targetLesson.id,
                  date: targetDateStr,
                  hour: targetLesson.hour,
                  className: targetLesson.className,
                  subject: targetLesson.subject,
                  toCheck: '', checkStatus: 'pending',
                  toDo: '', doStatus: 'pending',
                  misc: recoveryText, miscStatus: 'pending',
                  type: 'lesson'
                };
              }
              
              if (targetNoteIndex >= 0) newNotes[targetNoteIndex] = targetNote;
              else newNotes.push(targetNote);
              
              setLessonNotes(newNotes);
              persistLocalChanges({ lessonNotes: newNotes });
              showToast(`Recupero registrato per la prossima lezione del ${new Date(targetDateStr).toLocaleDateString('it-IT')}`, 'success');
            } else {
              showToast("Nessuna lezione futura trovata per programmare il recupero.", 'warning');
            }
          }}
          onUpdateRepeatMode={handleUpdateLessonRepeatMode}
        />
      )}
      {isAddLessonModalOpen && (selectedLesson && !addLessonSlot ? (
               <EditLessonModal isOpen={isAddLessonModalOpen} onClose={() => { setIsAddLessonModalOpen(false); setSelectedLesson(null); }} lesson={selectedLesson.lesson} dateStr={selectedLesson.dateStr} subjects={activeSubjects} classes={activeClasses} onSave={handleEditLesson} />
          ) : (
              <AddLessonModal isOpen={isAddLessonModalOpen} onClose={() => { setIsAddLessonModalOpen(false); setAddLessonSlot(null); }} day={addLessonSlot?.day || null} hour={addLessonSlot?.hour || null} subjects={activeSubjects} classes={activeClasses} onSave={handleAddLesson} />
          )
      )}
      <StartDateModal isOpen={isStartDateModalOpen} onClose={() => setIsStartDateModalOpen(false)} onBack={() => { setIsStartDateModalOpen(false); setIsSettingsMenuOpen(true); }} schoolYears={schoolYears} currentDate={currentDate} onSave={handleSaveStartDate} />
      <DayStatusModal isOpen={isDayStatusModalOpen} onClose={() => setIsDayStatusModalOpen(false)} date={selectedDayStatusDate || new Date()} currentStatus={specialDays.find(sd => sd.date === getLocalDateStr(selectedDayStatusDate || new Date()))?.type || null} onSave={handleSaveDayStatus} />
      <BackupModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
        onExportTasks={handleExportTasks}
        onSelectiveRestore={handleSelectiveRestore}
        onRollbackToSnapshot={handleRollbackToSnapshot}
        getBackupPayload={getFullBackupPayload}
        schoolYears={schoolYears}
        currentDate={currentDate}
        onNavigateToDate={(targetDate) => setCurrentDate(targetDate)}
        onBackupSuccess={setLastBackupTime}
      />
      <GuideModal isOpen={isGuideModalOpen} onClose={() => setIsGuideModalOpen(false)} onBack={() => { setIsGuideModalOpen(false); setIsSettingsMenuOpen(true); }} installPrompt={installPrompt} />
      {isEditTimeModalOpen && editingTimeHour !== null && (
        <EditTimeModal
          isOpen={isEditTimeModalOpen}
          onClose={() => setIsEditTimeModalOpen(false)}
          hour={editingTimeHour}
          currentLabel={
            (activeProvisionalPeriodForCurrentDate?.timeSlots && activeProvisionalPeriodForCurrentDate.timeSlots[editingTimeHour]) ||
            timeSlots[editingTimeHour]
          }
          onSave={handleSaveTimeSlot}
          periodInfo={
            activeProvisionalPeriodForCurrentDate
              ? {
                  id: activeProvisionalPeriodForCurrentDate.id,
                  label: activeProvisionalPeriodForCurrentDate.label,
                  startDate: activeProvisionalPeriodForCurrentDate.startDate,
                  endDate: activeProvisionalPeriodForCurrentDate.endDate,
                }
              : undefined
          }
          associatedRecess={recesses.find(r => r.associatedHour === editingTimeHour) || null}
        />
      )}
      <RecessModal 
        isOpen={isRecessModalOpen} 
        onClose={() => setIsRecessModalOpen(false)} 
        onBack={() => { setIsRecessModalOpen(false); setIsSettingsMenuOpen(true); }} 
        recesses={recesses} 
        maxHours={maxHours} 
        durations={durations}
        timeSlots={timeSlots}
        onSave={handleSaveRecesses} 
      />
      <SubjectManagerModal 
        isOpen={isSubjectManagerOpen} 
        onClose={() => setIsSubjectManagerOpen(false)} 
        onBack={() => { setIsSubjectManagerOpen(false); setIsSettingsMenuOpen(true); }} 
        subjects={activeSubjects} 
        onSave={handleSaveSubjects} 
        classes={activeClasses} 
        onSaveClasses={handleSaveClasses}
        linkedSubjectGroups={linkedSubjectGroups}
        onSaveLinkedSubjectGroups={handleSaveLinkedSubjectGroups}
      />
      <MonthPickerModal isOpen={isMonthPickerOpen} onClose={() => setIsMonthPickerOpen(false)} currentDate={currentDate} onSelectDate={handleSelectMonth} schoolYears={schoolYears} />
      <HoursSettingsModal isOpen={isHoursSettingsModalOpen} onClose={() => setIsHoursSettingsModalOpen(false)} onBack={() => { setIsHoursSettingsModalOpen(false); setIsSettingsMenuOpen(true); }} currentMaxHours={maxHours} onSave={handleSaveMaxHours} />
      <TaskDatabaseModal isOpen={isTaskDatabaseModalOpen} onClose={() => setIsTaskDatabaseModalOpen(false)} onBack={() => { setIsTaskDatabaseModalOpen(false); setIsSettingsMenuOpen(true); }} templates={taskTemplates} classes={activeClasses} onSave={handleSaveTaskTemplates} />
      <SettingsMenuModal 
        isOpen={isSettingsMenuOpen} 
        onClose={() => setIsSettingsMenuOpen(false)} 
        onOpenSubjects={() => setIsSubjectManagerOpen(true)} 
        onOpenHours={() => setIsHoursSettingsModalOpen(true)} 
        onOpenCalendar={() => setIsStartDateModalOpen(true)} 
        onOpenRecess={() => setIsRecessModalOpen(true)} 
        onOpenGuide={() => setIsGuideModalOpen(true)} 
        onOpenTaskDatabase={() => setIsTaskDatabaseModalOpen(true)} 
        onOpenProvisionalSchedule={() => setIsProvisionalScheduleModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        installPrompt={installPrompt}
        onInstalled={() => setInstallPrompt(null)}
      />
      <ProvisionalScheduleModal 
        isOpen={isProvisionalScheduleModalOpen} 
        onClose={() => setIsProvisionalScheduleModalOpen(false)} 
        onBack={() => { setIsProvisionalScheduleModalOpen(false); setIsSettingsMenuOpen(true); }} 
        provisionalPeriods={provisionalPeriods} 
        currentDate={currentDate} 
        onSave={handleSaveProvisionalPeriods} 
        defaultTimeSlots={timeSlots}
        maxHours={maxHours}
      />
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} notes={lessonNotes} schedule={schedule} classes={activeClasses} onGoToNote={handleGoToNote} />
      <RemainingHoursModal 
        isOpen={isRemainingHoursModalOpen} 
        onClose={() => setIsRemainingHoursModalOpen(false)} 
        schoolYears={schoolYears.length > 0 ? schoolYears : [{
          id: 'default-year',
          label: `${schoolStartDate.getFullYear()}/${schoolStartDate.getFullYear() + 1}`,
          startDate: getLocalDateStr(schoolStartDate),
          endDate: getLocalDateStr(schoolEndDate),
          splitDate: getLocalDateStr(semesterSplitDate),
          isSixDayWeek: isSixDayWeek,
          closures: schoolClosures
        }]}
        schedule={schedule}
        lessonNotes={lessonNotes}
        specialDays={specialDays}
        schoolClosures={schoolClosures}
        timeSlots={timeSlots}
        provisionalPeriods={provisionalPeriods}
        maxHours={maxHours}
        initialSchoolYearId={activeSchoolYear?.id}
        classes={activeClasses}
        schoolEndDate={schoolEndDate}
      />
      <ClassFilterModal
        isOpen={isClassFilterModalOpen}
        onClose={() => setIsClassFilterModalOpen(false)}
        classes={activeClasses}
        selectedClass={focusClass}
        onSelect={setFocusClass}
      />
      {toast && (
        <div 
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-sm backdrop-blur-md animate-magi-slide-down transition-all max-w-[90vw] ${
            toast.type === 'success' ? 'bg-emerald-800 text-white border border-emerald-700' :
            toast.type === 'warning' ? 'bg-amber-800 text-white border border-amber-700' :
            toast.type === 'error' ? 'bg-rose-800 text-white border border-rose-700' :
            'bg-slate-900 text-white border border-slate-700'
          }`}
          onClick={() => setToast(null)}
          role="alert"
        >
          <span>{toast.message}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); setToast(null); }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors ml-1 text-white/80 hover:text-white"
            aria-label="Chiudi notifica"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
