import { ProvisionalSchedulePeriod, Lesson, SchoolYear, LessonNote, DayOfWeek } from '../types';

export const getMondayFromDate = (d: Date): Date => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(12, 0, 0, 0);
  return monday;
};

export const getLocalDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Safely computes the Monday date string (YYYY-MM-DD) for any date string (YYYY-MM-DD)
 * without suffering from UTC midnight parsing shifts across timezones.
 */
export const getMondayFromDateStr = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return getLocalDateString(date);
};

/**
 * Safely computes the Monday date string (YYYY-MM-DD) for any Date object
 * using noon time to avoid DST boundary issues.
 */
export const getMondayDateStrFromDate = (d: Date): string => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return getLocalDateString(date);
};

export const isDateInProvisionalPeriod = (
  dateStr: string,
  periods: ProvisionalSchedulePeriod[] | undefined
): boolean => {
  if (!periods || periods.length === 0 || !dateStr) return false;
  return periods.some(p => dateStr >= p.startDate && dateStr <= p.endDate);
};

export const isWeekInProvisionalPeriod = (
  mondayDateStr: string,
  periods: ProvisionalSchedulePeriod[] | undefined,
  isSixDayWeek: boolean = false
): boolean => {
  if (!periods || periods.length === 0 || !mondayDateStr) return false;
  const actualMondayStr = getMondayFromDateStr(mondayDateStr);
  const [y, m, d] = actualMondayStr.split('-').map(Number);
  const monday = new Date(y, m - 1, d, 12, 0, 0);
  const numDays = isSixDayWeek ? 6 : 5;
  for (let i = 0; i < numDays; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(day);
    if (isDateInProvisionalPeriod(dateStr, periods)) {
      return true;
    }
  }
  return false;
};

export const getProvisionalPeriodForDate = (
  dateStr: string,
  periods: ProvisionalSchedulePeriod[] | undefined
): ProvisionalSchedulePeriod | undefined => {
  if (!periods || periods.length === 0 || !dateStr) return undefined;
  return periods.find(p => dateStr >= p.startDate && dateStr <= p.endDate);
};

export const getEffectiveTimeSlotsForDate = (
  dateStr: string,
  periods: ProvisionalSchedulePeriod[] | undefined,
  defaultTimeSlots: Record<number, string>
): Record<number, string> => {
  if (!periods || periods.length === 0) return defaultTimeSlots;
  const period = getProvisionalPeriodForDate(dateStr, periods);
  if (period && period.timeSlots && Object.keys(period.timeSlots).length > 0) {
    return { ...defaultTimeSlots, ...period.timeSlots };
  }
  return defaultTimeSlots;
};

export const getEffectiveTimeSlotsForWeek = (
  weekDates: Date[],
  currentDate: Date,
  periods: ProvisionalSchedulePeriod[] | undefined,
  defaultTimeSlots: Record<number, string>
): Record<number, string> => {
  if (!periods || periods.length === 0) return defaultTimeSlots;
  
  // Controlla prima se la data corrente fa parte di un periodo provvisorio con orari dedicati
  const currDateStr = getLocalDateString(currentDate);
  const currPeriod = getProvisionalPeriodForDate(currDateStr, periods);
  if (currPeriod && currPeriod.timeSlots && Object.keys(currPeriod.timeSlots).length > 0) {
    return { ...defaultTimeSlots, ...currPeriod.timeSlots };
  }

  // Altrimenti controlla le altre date della settimana visualizzata
  for (const d of weekDates) {
    const dStr = getLocalDateString(d);
    const p = getProvisionalPeriodForDate(dStr, periods);
    if (p && p.timeSlots && Object.keys(p.timeSlots).length > 0) {
      return { ...defaultTimeSlots, ...p.timeSlots };
    }
  }

  return defaultTimeSlots;
};

export const getActiveProvisionalPeriodForWeek = (
  weekDates: Date[],
  currentDate: Date,
  periods: ProvisionalSchedulePeriod[] | undefined
): ProvisionalSchedulePeriod | undefined => {
  if (!periods || periods.length === 0) return undefined;
  const currDateStr = getLocalDateString(currentDate);
  const currPeriod = getProvisionalPeriodForDate(currDateStr, periods);
  if (currPeriod) return currPeriod;

  for (const d of weekDates) {
    const dStr = getLocalDateString(d);
    const p = getProvisionalPeriodForDate(dStr, periods);
    if (p) return p;
  }
  return undefined;
};

/**
 * Finds all distinct Monday date strings (YYYY-MM-DD) covering any day of a date range.
 */
export const getMondaysForPeriod = (
  startDate: string,
  endDate: string
): string[] => {
  if (!startDate || !endDate || startDate > endDate) return [];
  const mondays = new Set<string>();
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  if (isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) return [];
  const start = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0);

  const curr = new Date(start);
  while (curr <= end) {
    const mondayStr = getMondayDateStrFromDate(curr);
    if (mondayStr) {
      mondays.add(mondayStr);
    }
    curr.setDate(curr.getDate() + 1);
  }
  return Array.from(mondays).sort();
};

/**
 * Returns all active Monday strings (YYYY-MM-DD) for a list of provisional periods.
 */
export const getAllProvisionalMondays = (
  periods: ProvisionalSchedulePeriod[] | undefined
): string[] => {
  if (!periods || periods.length === 0) return [];
  const allMondays = new Set<string>();
  for (const p of periods) {
    const mondays = getMondaysForPeriod(p.startDate, p.endDate);
    mondays.forEach(m => allMondays.add(m));
  }
  return Array.from(allMondays).sort();
};

/**
 * Synchronizes the schedule with the active provisional periods while guaranteeing
 * 100% COMPLETE ISOLATION between the definitive schedule and provisional periods,
 * and between separate provisional periods/weeks.
 *
 * Rules:
 * 1. Provisional lessons whose weekStart does NOT belong to any active provisional period
 *    are cleaned up (reverting that week to the definitive timetable).
 * 2. If an active provisional week (Monday) has ALREADY been initialized with provisional lessons,
 *    it is NEVER touched or overwritten! It retains all its customized lessons, deletions (tombstones),
 *    and user edits. Modifications made to the definitive schedule or other periods will NEVER bleed into it.
 * 3. Only BRAND NEW, uninitialized provisional weeks (which have 0 provisional lessons in currentSchedule)
 *    are instantiated from the current definitive schedule of the corresponding school year.
 * 4. Each provisional lesson receives a unique UUID, periodId, weekStart, and isProvisional: true.
 */
export const syncProvisionalPeriodsWithSchedule = (
  currentSchedule: Lesson[],
  periods: ProvisionalSchedulePeriod[] | undefined,
  schoolYears?: SchoolYear[]
): Lesson[] => {
  if (!currentSchedule) return [];

  const activePeriods = periods || [];
  const activeMondays = new Set(getAllProvisionalMondays(activePeriods));

  const mondayToPeriodMap = new Map<string, ProvisionalSchedulePeriod>();
  for (const p of activePeriods) {
    const mondays = getMondaysForPeriod(p.startDate, p.endDate);
    for (const m of mondays) {
      mondayToPeriodMap.set(m, p);
    }
  }

  // 1. Remove orphaned provisional lessons whose week is no longer in any active period
  let workingSchedule = currentSchedule.filter(l => {
    if (l.isProvisional) {
      return l.weekStart && activeMondays.has(l.weekStart);
    }
    return true;
  });

  if (activeMondays.size === 0) {
    if (workingSchedule.length === currentSchedule.length) return currentSchedule;
    return workingSchedule;
  }

  const newLessonsToAdd: Lesson[] = [];

  // 2. For each active provisional Monday, check if it already has ANY provisional lessons
  for (const mondayKey of activeMondays) {
    const alreadyInitialized = workingSchedule.some(l => 
      l.isProvisional && l.weekStart === mondayKey
    );

    if (alreadyInitialized) {
      // This week is already independent and has its own life.
      // Do NOT modify, do NOT inject definitive changes!
      continue;
    }

    // Uninitialized week: instantiate from the definitive schedule for the appropriate school year
    let targetYearId: string | undefined;
    if (schoolYears && schoolYears.length > 0) {
      const matchingYear = schoolYears.find(y => mondayKey >= y.startDate && mondayKey <= y.endDate);
      targetYearId = matchingYear ? matchingYear.id : schoolYears[0].id;
    }

    const baseLessons = workingSchedule.filter(l => 
      !l.isProvisional && 
      !l.isDeleted && 
      (targetYearId ? (l.schoolYearId === targetYearId || (!l.schoolYearId && targetYearId === schoolYears?.[0]?.id)) : true)
    );

    const associatedPeriod = mondayToPeriodMap.get(mondayKey);

    for (const base of baseLessons) {
      newLessonsToAdd.push({
        id: crypto.randomUUID(),
        day: base.day,
        hour: base.hour,
        className: base.className,
        subject: base.subject,
        room: base.room,
        weekStart: mondayKey,
        periodId: associatedPeriod ? associatedPeriod.id : undefined,
        schoolYearId: targetYearId || base.schoolYearId,
        isProvisional: true,
        isDeleted: false
      });
    }
  }

  if (newLessonsToAdd.length === 0 && workingSchedule.length === currentSchedule.length) {
    return currentSchedule;
  }

  return [...workingSchedule, ...newLessonsToAdd];
};

export const ensureProvisionalSchedule = syncProvisionalPeriodsWithSchedule;

/**
 * Reallocates lesson notes (homework, tasks, checks) when provisional schedule periods
 * are activated, modified, or removed.
 *
 * Requirements:
 * 1. Synchronous and automatic reallocation to the correct active lessons (class, subject, day, hour).
 * 2. 100% data integrity: preserves all note contents, checkboxes, statuses, and reminders without loss or duplication.
 * 3. Scope restriction: only dates within active provisional periods (or transitioning between provisional and definitive)
 *    are affected; dates outside remain strictly untouched.
 * 4. When a provisional period is modified or deactivated, tasks return to the definitive timetable or new configuration.
 */
export const reallocateLessonNotesForPeriods = (
  currentNotes: LessonNote[],
  oldSchedule: Lesson[],
  newSchedule: Lesson[],
  oldPeriods: ProvisionalSchedulePeriod[] | undefined,
  newPeriods: ProvisionalSchedulePeriod[] | undefined,
  schoolYears: SchoolYear[] = [],
  activeDays: DayOfWeek[] = [DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN],
  maxHours: number = 7
): LessonNote[] => {
  if (!currentNotes || currentNotes.length === 0) return currentNotes || [];

  const safeOldPeriods = oldPeriods || [];
  const safeNewPeriods = newPeriods || [];

  // Lookup map for fast retrieval of lesson metadata (className, subject, hour, day)
  const lessonLookup = new Map<string, Lesson>();
  for (const l of oldSchedule) {
    if (l && l.id) lessonLookup.set(l.id, l);
  }
  for (const l of newSchedule) {
    if (l && l.id) lessonLookup.set(l.id, l);
  }

  // Identify all affected weeks (Mondays)
  const affectedMondays = new Set<string>();
  for (const p of [...safeOldPeriods, ...safeNewPeriods]) {
    const mondays = getMondaysForPeriod(p.startDate, p.endDate);
    for (const m of mondays) affectedMondays.add(m);
  }

  if (affectedMondays.size === 0) {
    return currentNotes;
  }

  const dayOfWeekMap: Record<number, DayOfWeek> = {
    1: DayOfWeek.LUN,
    2: DayOfWeek.MAR,
    3: DayOfWeek.MER,
    4: DayOfWeek.GIO,
    5: DayOfWeek.VEN,
    6: DayOfWeek.SAB
  };

  const resultNotes: LessonNote[] = currentNotes.map(n => ({ ...n }));

  for (const mondayKey of affectedMondays) {
    const [y, m, d] = mondayKey.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) continue;
    const weekMonday = new Date(y, m - 1, d, 12, 0, 0);

    const numDays = activeDays.includes(DayOfWeek.SAB) ? 6 : 5;
    const weekCalendarDays: {
      dateStr: string;
      dayOfWeek: DayOfWeek;
      inNewProv: boolean;
      inOldProv: boolean;
    }[] = [];

    for (let i = 0; i < numDays; i++) {
      const cur = new Date(weekMonday);
      cur.setDate(weekMonday.getDate() + i);
      const dateStr = getLocalDateString(cur);
      const dayOfWeek = dayOfWeekMap[cur.getDay()];
      if (!dayOfWeek) continue;
      const inNewProv = isDateInProvisionalPeriod(dateStr, safeNewPeriods);
      const inOldProv = isDateInProvisionalPeriod(dateStr, safeOldPeriods);
      weekCalendarDays.push({ dateStr, dayOfWeek, inNewProv, inOldProv });
    }

    const yearForWeek = schoolYears.find(sy => mondayKey >= sy.startDate && mondayKey <= sy.endDate) || schoolYears[0];
    const yearId = yearForWeek?.id;

    interface ActiveSlot {
      dateStr: string;
      day: DayOfWeek;
      hour: number;
      lesson: Lesson;
    }
    const activeLessonsInWeek: ActiveSlot[] = [];

    for (const calDay of weekCalendarDays) {
      for (let h = 1; h <= maxHours; h++) {
        let activeLesson: Lesson | undefined;
        if (calDay.inNewProv) {
          activeLesson = newSchedule.find(l => 
            l.isProvisional &&
            l.weekStart === mondayKey &&
            l.day === calDay.dayOfWeek &&
            l.hour === h &&
            !l.isDeleted &&
            Boolean(l.className) &&
            (!yearId || l.schoolYearId === yearId || (!l.schoolYearId && yearId === schoolYears[0]?.id))
          );
        } else {
          activeLesson = newSchedule.find(l => 
            !l.isProvisional &&
            l.day === calDay.dayOfWeek &&
            l.hour === h &&
            !l.isDeleted &&
            Boolean(l.className) &&
            (!yearId || l.schoolYearId === yearId || (!l.schoolYearId && yearId === schoolYears[0]?.id))
          );
        }

        if (activeLesson) {
          activeLessonsInWeek.push({
            dateStr: calDay.dateStr,
            day: calDay.dayOfWeek,
            hour: h,
            lesson: activeLesson
          });
        }
      }
    }

    const weekNoteIndices: number[] = [];
    for (let i = 0; i < resultNotes.length; i++) {
      const n = resultNotes[i];
      if (!n || !n.date) continue;
      if (getMondayFromDateStr(n.date) === mondayKey) {
        weekNoteIndices.push(i);
      }
    }

    if (weekNoteIndices.length === 0) continue;

    const classSubjectGroups = new Map<string, number[]>();
    for (const idx of weekNoteIndices) {
      const n = resultNotes[idx];
      const lesson = lessonLookup.get(n.lessonId);
      const c = (n.className || lesson?.className || '').trim();
      const s = (n.subject || lesson?.subject || '').trim();
      const key = `${c.toLowerCase()}____${s.toLowerCase()}`;
      if (!classSubjectGroups.has(key)) {
        classSubjectGroups.set(key, []);
      }
      classSubjectGroups.get(key)!.push(idx);
    }

    for (const [key, noteIndices] of classSubjectGroups.entries()) {
      const matchingActiveSlots = activeLessonsInWeek.filter(slot => {
        const c = (slot.lesson.className || '').trim().toLowerCase();
        const s = (slot.lesson.subject || '').trim().toLowerCase();
        return `${c}____${s}` === key;
      });

      if (matchingActiveSlots.length === 0) {
        continue;
      }

      matchingActiveSlots.sort((a, b) => {
        if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
        return a.hour - b.hour;
      });

      const usedSlotIndices = new Set<number>();

      // 1A. Exact same-date and same-hour match first (prevents cross-hour shifting on multi-hour days)
      const sameDateUnmatchedIndices: number[] = [];
      for (const idx of noteIndices) {
        const note = resultNotes[idx];
        const sourceLesson = lessonLookup.get(note.lessonId);
        const noteHour = typeof note.hour === 'number' ? note.hour : sourceLesson?.hour;

        const exactSlotIndex = noteHour !== undefined
          ? matchingActiveSlots.findIndex((slot, sIdx) =>
              !usedSlotIndices.has(sIdx) && slot.dateStr === note.date && slot.hour === noteHour
            )
          : -1;

        if (exactSlotIndex >= 0) {
          usedSlotIndices.add(exactSlotIndex);
          const targetSlot = matchingActiveSlots[exactSlotIndex];
          resultNotes[idx] = {
            ...note,
            lessonId: targetSlot.lesson.id,
            date: targetSlot.dateStr,
            hour: targetSlot.hour,
            className: targetSlot.lesson.className,
            subject: targetSlot.lesson.subject
          };
        } else {
          sameDateUnmatchedIndices.push(idx);
        }
      }

      // 1B. Same-date match fallback (if the specific hour moved to another hour on the same date)
      const unmatchedNoteIndices: number[] = [];
      for (const idx of sameDateUnmatchedIndices) {
        const note = resultNotes[idx];
        const sameDateSlotIndex = matchingActiveSlots.findIndex((slot, sIdx) => 
          !usedSlotIndices.has(sIdx) && slot.dateStr === note.date
        );

        if (sameDateSlotIndex >= 0) {
          usedSlotIndices.add(sameDateSlotIndex);
          const targetSlot = matchingActiveSlots[sameDateSlotIndex];
          resultNotes[idx] = {
            ...note,
            lessonId: targetSlot.lesson.id,
            date: targetSlot.dateStr,
            hour: targetSlot.hour,
            className: targetSlot.lesson.className,
            subject: targetSlot.lesson.subject
          };
        } else {
          unmatchedNoteIndices.push(idx);
        }
      }

      // 2. Reallocation for moved days/hours: map chronologically to remaining active slots in this week
      let nextAvailableSlotIndex = 0;
      for (const idx of unmatchedNoteIndices) {
        const note = resultNotes[idx];

        while (nextAvailableSlotIndex < matchingActiveSlots.length && usedSlotIndices.has(nextAvailableSlotIndex)) {
          nextAvailableSlotIndex++;
        }

        if (nextAvailableSlotIndex < matchingActiveSlots.length) {
          usedSlotIndices.add(nextAvailableSlotIndex);
          const targetSlot = matchingActiveSlots[nextAvailableSlotIndex];
          nextAvailableSlotIndex++;

          resultNotes[idx] = {
            ...note,
            lessonId: targetSlot.lesson.id,
            date: targetSlot.dateStr,
            hour: targetSlot.hour,
            className: targetSlot.lesson.className,
            subject: targetSlot.lesson.subject
          };
        } else {
          // Fallback to the closest/last active slot of this subject
          const fallbackSlot = matchingActiveSlots[matchingActiveSlots.length - 1];
          resultNotes[idx] = {
            ...note,
            lessonId: fallbackSlot.lesson.id,
            date: fallbackSlot.dateStr,
            hour: fallbackSlot.hour,
            className: fallbackSlot.lesson.className,
            subject: fallbackSlot.lesson.subject
          };
        }
      }
    }
  }

  return resultNotes;
};

