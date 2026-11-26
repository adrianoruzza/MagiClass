import { 
  SchoolYear, 
  Lesson, 
  LessonNote, 
  SpecialDay, 
  SchoolClosure, 
  ProvisionalSchedulePeriod, 
  DayOfWeek 
} from '../types';
import { 
  getLocalDateString, 
  getProvisionalPeriodForDate, 
  isDateInProvisionalPeriod,
  isWeekInProvisionalPeriod,
  getMondayDateStrFromDate 
} from './provisionalSchedule';

export interface ClassHoursBreakdown {
  className: string;
  heldHours: number;      // Ore già svolte
  remainingHours: number; // Ore ancora da svolgere
  totalHours: number;     // Totale ore nell'anno
  q1TotalHours: number;   // Totale ore 1° quadrimestre
  q2TotalHours: number;   // Totale ore 2° quadrimestre
}

export interface ActivityHoursBreakdown {
  heldHours: number;      // Ore svolte
  remainingHours: number; // Ore residue
  totalHours: number;     // Totale
}

export interface SchoolYearHoursStats {
  // Singole classi (ore svolte, residue, Q1 e Q2)
  classes: Record<string, ClassHoursBreakdown>;
  
  // Attività NON associate a classi
  disposizione: ActivityHoursBreakdown;
  buco: ActivityHoursBreakdown;

  // Giorni di lezione
  daysHeld: number;       // Giorni svolti
  daysRemaining: number;  // Giorni residui
  totalDays: number;      // Totale giorni nell'anno scolastico

  // Totali complessivi per le classi
  totalClassHoursHeld: number;
  totalClassHoursRemaining: number;
  totalClassHours: number;
  totalClassHoursQ1: number;
  totalClassHoursQ2: number;

  // Totali comprensivi di ore a disposizione e buchi (per riepilogo generale)
  totalGeneralHoursHeld: number;
  totalGeneralHoursRemaining: number;
  totalGeneralHours: number;

  // Rilevazione orario provvisorio
  hasActiveProvisionalPeriod: boolean;

  // Metadata
  startDate: Date;
  endDate: Date;
  mode: 'current' | 'future' | 'past';

  // Proprietà retrocompatibili
  classCounts: Record<string, number>;
  disposizioneHours: number;
  bucoHours: number;
  remainingDays: number;
}

export interface CalculateSchoolYearStatsParams {
  selectedYear: SchoolYear;
  allSchoolYears: SchoolYear[];
  schedule: Lesson[];
  lessonNotes: LessonNote[];
  specialDays: SpecialDay[];
  schoolClosures: SchoolClosure[];
  defaultTimeSlots: Record<number, string>;
  provisionalPeriods: ProvisionalSchedulePeriod[];
  maxHours: number;
  now?: Date;
}

export const calculateSchoolYearStats = (params: CalculateSchoolYearStatsParams): SchoolYearHoursStats => {
  const {
    selectedYear,
    allSchoolYears,
    schedule = [],
    lessonNotes = [],
    specialDays = [],
    schoolClosures = [],
    defaultTimeSlots = {},
    provisionalPeriods = [],
    maxHours = 6,
    now: customNow
  } = params;

  const now = customNow || new Date();
  const todayStr = getLocalDateString(now);

  const isCurrent = todayStr >= selectedYear.startDate && todayStr <= selectedYear.endDate;
  const isFuture = todayStr < selectedYear.startDate;
  const mode: 'current' | 'future' | 'past' = isCurrent ? 'current' : isFuture ? 'future' : 'past';

  // Parsing date inizio e fine anno
  const [startY, startM, startD] = selectedYear.startDate.split('-').map(Number);
  const [endY, endM, endD] = selectedYear.endDate.split('-').map(Number);
  const yearStartDate = new Date(startY, startM - 1, startD, 12, 0, 0);
  const yearEndDate = new Date(endY, endM - 1, endD, 12, 0, 0);

  const effectiveClosures = (selectedYear.closures && selectedYear.closures.length > 0)
    ? selectedYear.closures
    : schoolClosures;

  const isSixDayWeek = selectedYear.isSixDayWeek ?? false;
  const activeDays: DayOfWeek[] = isSixDayWeek
    ? [DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN, DayOfWeek.SAB]
    : [DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN];

  const dayMap = [null, DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN, DayOfWeek.SAB];
  const firstSchoolYearId = allSchoolYears[0]?.id;

  // Strutture di accumulo
  const classes: Record<string, ClassHoursBreakdown> = {};
  const disposizione: ActivityHoursBreakdown = { heldHours: 0, remainingHours: 0, totalHours: 0 };
  const buco: ActivityHoursBreakdown = { heldHours: 0, remainingHours: 0, totalHours: 0 };

  let daysHeld = 0;
  let daysRemaining = 0;

  // Funzione per trovare la lezione definitiva associata all'anno selezionato
  const findDefinitiveLesson = (day: DayOfWeek, hour: number): Lesson | null => {
    // 1. Cerca lezione base con schoolYearId corrispondente all'anno selezionato (senza weekStart)
    const explicit = schedule.find(l => 
      !l.isProvisional && 
      !l.isDeleted && 
      !l.weekStart &&
      l.day === day && 
      l.hour === hour && 
      l.schoolYearId === selectedYear.id
    );
    if (explicit) return explicit;

    // 2. Se l'anno selezionato non ha lezioni esplicite con il proprio ID,
    // verifica se esistono lezioni base non taggate (es. orario iniziale di default)
    const hasAnyTaggedLessons = schedule.some(l => !l.isProvisional && Boolean(l.schoolYearId));
    if (!hasAnyTaggedLessons || selectedYear.id === firstSchoolYearId) {
      const untagged = schedule.find(l => 
        !l.isProvisional && 
        !l.isDeleted && 
        !l.weekStart &&
        l.day === day && 
        l.hour === hour && 
        !l.schoolYearId
      );
      if (untagged) return untagged;
    }

    return null;
  };

  // Iterazione giorno per giorno su tutto l'anno scolastico
  const cursor = new Date(yearStartDate);
  while (cursor <= yearEndDate) {
    const dateStr = getLocalDateString(cursor);
    const dayIndex = cursor.getDay();
    const dayName = dayMap[dayIndex];

    const specialDay = specialDays.find(sd => sd.date === dateStr);
    const isClosureRange = effectiveClosures.some(sc => dateStr >= sc.startDate && dateStr <= sc.endDate);

    if (dayIndex !== 0 && dayName && activeDays.includes(dayName)) {
      const isExcludedDay = isClosureRange || Boolean(specialDay && (
        specialDay.type === 'SICK' || 
        specialDay.type === 'PERMISSION' || 
        specialDay.type === 'SCHOOL_CLOSED' || 
        specialDay.type === 'TRIP'
      ));

      if (!isExcludedDay) {
        if (dateStr < todayStr) {
          daysHeld++;
        } else {
          daysRemaining++;
        }

        // Calcolo delle ore di lezione se la scuola è aperta
        const provPeriod = getProvisionalPeriodForDate(dateStr, provisionalPeriods);
        const mondayKey = getMondayDateStrFromDate(cursor);
        const inProvisional = Boolean(
          provPeriod || 
          isDateInProvisionalPeriod(dateStr, provisionalPeriods) || 
          isWeekInProvisionalPeriod(mondayKey, provisionalPeriods, isSixDayWeek)
        );

        let effectiveSlots: Record<number, string>;
        let hoursToCheck: number[];

        if (provPeriod && provPeriod.timeSlots && Object.keys(provPeriod.timeSlots).length > 0) {
          effectiveSlots = provPeriod.timeSlots;
          hoursToCheck = Object.keys(provPeriod.timeSlots).map(Number).sort((a, b) => a - b);
        } else {
          effectiveSlots = defaultTimeSlots;
          const definedSlotKeys = Object.keys(defaultTimeSlots).map(Number);
          const maxH = Math.max(maxHours, ...definedSlotKeys, 6);
          hoursToCheck = Array.from({ length: maxH }, (_, i) => i + 1);
        }

        for (const h of hoursToCheck) {
          // Determina se l'ora è trascorsa
          let isPastHour = false;
          if (dateStr < todayStr) {
            isPastHour = true;
          } else if (dateStr > todayStr) {
            isPastHour = false;
          } else {
            // Oggi: verifica orario d'inizio dello slot
            const slot = effectiveSlots[h];
            if (slot) {
              const startTimeStr = slot.split(' - ')[0]?.trim();
              const [slotH, slotM] = (startTimeStr || '').split(':').map(Number);
              if (!isNaN(slotH) && !isNaN(slotM)) {
                const lessonStart = new Date(now);
                lessonStart.setHours(slotH, slotM, 0, 0);
                isPastHour = now >= lessonStart;
              }
            }
          }

          // Risoluzione della lezione
          let lesson: Lesson | null = null;

          if (inProvisional) {
            // Cerca lezione provvisoria per questa specifica settimana
            const provLesson = schedule.find(l => 
              l.isProvisional &&
              l.weekStart === mondayKey &&
              l.day === dayName &&
              l.hour === h &&
              (
                l.schoolYearId === selectedYear.id ||
                !l.schoolYearId ||
                (mondayKey >= selectedYear.startDate && mondayKey <= selectedYear.endDate)
              )
            );

            if (provLesson) {
              if (!provLesson.isDeleted && provLesson.className && provLesson.className.trim()) {
                lesson = provLesson;
              } else {
                lesson = null;
              }
            } else {
              // Se non esiste un record provvisorio e non c'è tombstone, controlla se si applica la lezione base
              const hasTombstone = schedule.some(l => 
                l.isProvisional && 
                l.isDeleted && 
                l.weekStart === mondayKey && 
                l.day === dayName && 
                l.hour === h
              );
              if (!hasTombstone) {
                lesson = findDefinitiveLesson(dayName, h);
              }
            }
          } else {
            const weekSpecific = schedule.find(l => 
              !l.isProvisional && 
              !l.isDeleted && 
              l.weekStart === mondayKey && 
              l.day === dayName && 
              l.hour === h && 
              (l.schoolYearId === selectedYear.id || (!l.schoolYearId && selectedYear.id === firstSchoolYearId))
            );
            if (weekSpecific) {
              lesson = weekSpecific;
            } else {
              lesson = findDefinitiveLesson(dayName, h);
            }
          }

          if (!lesson || !lesson.className || !lesson.className.trim()) {
            continue;
          }

          // Controllo note che annullano la lezione
          const note = lessonNotes.find(n => n.lessonId === lesson!.id && n.date === dateStr);
          if (note && (note.type === 'skipped_lesson' || note.type === 'assembly' || note.type === 'trip')) {
            continue;
          }

          const rawClass = lesson.className.trim();
          const upperClass = rawClass.toUpperCase();

          if (upperClass === 'A DISPOSIZIONE') {
            if (isPastHour) {
              disposizione.heldHours++;
            } else {
              disposizione.remainingHours++;
            }
          } else if (upperClass === 'BUCO') {
            if (isPastHour) {
              buco.heldHours++;
            } else {
              buco.remainingHours++;
            }
          } else {
            if (!classes[rawClass]) {
              classes[rawClass] = {
                className: rawClass,
                heldHours: 0,
                remainingHours: 0,
                totalHours: 0,
                q1TotalHours: 0,
                q2TotalHours: 0
              };
            }

            if (isPastHour) {
              classes[rawClass].heldHours++;
            } else {
              classes[rawClass].remainingHours++;
            }

            if (selectedYear.splitDate && dateStr <= selectedYear.splitDate) {
              classes[rawClass].q1TotalHours++;
            } else {
              classes[rawClass].q2TotalHours++;
            }
          }
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Calcolo totali per ciascuna classe
  const classCounts: Record<string, number> = {};
  let totalClassHoursHeld = 0;
  let totalClassHoursRemaining = 0;
  let totalClassHoursQ1 = 0;
  let totalClassHoursQ2 = 0;

  Object.values(classes).forEach(c => {
    c.totalHours = c.heldHours + c.remainingHours;
    classCounts[c.className] = c.remainingHours; // per retrocompatibilità
    totalClassHoursHeld += c.heldHours;
    totalClassHoursRemaining += c.remainingHours;
    totalClassHoursQ1 += c.q1TotalHours;
    totalClassHoursQ2 += c.q2TotalHours;
  });

  const totalClassHours = totalClassHoursHeld + totalClassHoursRemaining;

  disposizione.totalHours = disposizione.heldHours + disposizione.remainingHours;
  buco.totalHours = buco.heldHours + buco.remainingHours;

  const totalGeneralHoursHeld = totalClassHoursHeld + disposizione.heldHours + buco.heldHours;
  const totalGeneralHoursRemaining = totalClassHoursRemaining + disposizione.remainingHours + buco.remainingHours;
  const totalGeneralHours = totalGeneralHoursHeld + totalGeneralHoursRemaining;

  // Verifica se è in vigore un orario provvisorio che influenza i calcoli
  const isCurrentProvisional = isCurrent && Boolean(
    getProvisionalPeriodForDate(todayStr, provisionalPeriods) ||
    isWeekInProvisionalPeriod(getMondayDateStrFromDate(now), provisionalPeriods, isSixDayWeek)
  );

  const hasFutureProvisional = isCurrent && provisionalPeriods.some(p => 
    p.endDate >= todayStr && p.startDate <= selectedYear.endDate
  );

  const hasActiveProvisionalPeriod = isCurrentProvisional || hasFutureProvisional;

  return {
    classes,
    disposizione,
    buco,
    daysHeld,
    daysRemaining,
    totalDays: daysHeld + daysRemaining,
    totalClassHoursHeld,
    totalClassHoursRemaining,
    totalClassHours,
    totalClassHoursQ1,
    totalClassHoursQ2,
    totalGeneralHoursHeld,
    totalGeneralHoursRemaining,
    totalGeneralHours,
    hasActiveProvisionalPeriod,
    startDate: yearStartDate,
    endDate: yearEndDate,
    mode,
    classCounts,
    disposizioneHours: disposizione.remainingHours,
    bucoHours: buco.remainingHours,
    remainingDays: daysRemaining
  };
};
