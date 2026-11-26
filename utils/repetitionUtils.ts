import { DayOfWeek, Lesson, RepeatMode, SchoolClosure, SchoolYear, SpecialDay } from '../types';
import { getLocalDateString } from './provisionalSchedule';

export const isDisposizioneLesson = (lesson?: Lesson | null): boolean => {
  if (!lesson) return false;
  const cn = (lesson.className || '').trim().toUpperCase();
  const sub = (lesson.subject || '').trim().toUpperCase();
  return cn === 'A DISPOSIZIONE' || cn === 'DISP' || sub === 'A DISPOSIZIONE';
};

export const DAY_OF_WEEK_OFFSET: Record<DayOfWeek, number> = {
  [DayOfWeek.LUN]: 0,
  [DayOfWeek.MAR]: 1,
  [DayOfWeek.MER]: 2,
  [DayOfWeek.GIO]: 3,
  [DayOfWeek.VEN]: 4,
  [DayOfWeek.SAB]: 5,
};

/**
 * Given a Monday YYYY-MM-DD string and a day of the week,
 * returns the exact YYYY-MM-DD date string.
 */
export const getDateForDayInWeek = (mondayStr: string, day: DayOfWeek): string => {
  if (!mondayStr) return '';
  const [y, m, d] = mondayStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const offset = DAY_OF_WEEK_OFFSET[day] ?? 0;
  date.setDate(date.getDate() + offset);
  return getLocalDateString(date);
};

/**
 * Calculates the exact integer difference in weeks between two Mondays (YYYY-MM-DD).
 */
export const getWeekDifference = (fromMondayStr: string, toMondayStr: string): number => {
  if (!fromMondayStr || !toMondayStr) return 0;
  const [y1, m1, d1] = fromMondayStr.split('-').map(Number);
  const [y2, m2, d2] = toMondayStr.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const date2 = new Date(y2, m2 - 1, d2, 12, 0, 0);
  const diffMs = date2.getTime() - date1.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
};

/**
 * Applies repetition settings for an 'A DISPOSIZIONE' lesson:
 * - 'weekly': repeats every week until schoolEndDate.
 * - 'biweekly': repeats every 2 weeks (starting from origin week) until schoolEndDate.
 * - 'none': restricts the lesson to the current week, removing subsequent generated repetitions while keeping the origin/current lesson.
 * 
 * Automatically respects school closures and special days (SCHOOL_CLOSED),
 * prevents duplicate slot occurrences, and stays within activeSchoolYear bounds.
 */
export function applyLessonRepetition(
  lesson: Lesson,
  dateStr: string,
  newMode: RepeatMode,
  schedule: Lesson[],
  activeSchoolYear: SchoolYear,
  specialDays: SpecialDay[],
  schoolClosures: SchoolClosure[]
): { updatedSchedule: Lesson[]; updatedLesson: Lesson } {
  // Determine current Monday
  let currentMonday = lesson.weekStart;
  if (!currentMonday && dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    dt.setDate(diff);
    currentMonday = getLocalDateString(dt);
  }
  if (!currentMonday) {
    currentMonday = getLocalDateString(new Date());
  }

  // Identify root origin
  const originId = lesson.repeatOriginId || lesson.id;
  const existingOrigin = schedule.find(l => l.id === originId);
  const originMonday = (existingOrigin && existingOrigin.weekStart) ? existingOrigin.weekStart : currentMonday;

  // Prune any existing generated occurrences from this repetition series that are in FUTURE weeks (> currentMonday)
  let cleanSchedule = schedule.filter(l => {
    // If it belongs to this repetition series and is in a week strictly after currentMonday, remove it
    if (l.repeatOriginId === originId && l.weekStart && l.weekStart > currentMonday) {
      return false;
    }
    return true;
  });

  // If user selected 'none' at the origin itself, also remove all other generated instances belonging to originId
  if (newMode === 'none' && lesson.id === originId) {
    cleanSchedule = cleanSchedule.filter(l => {
      if (l.repeatOriginId === originId && l.id !== originId) {
        return false;
      }
      return true;
    });
  }

  // Generate new future occurrences if 'weekly' or 'biweekly'
  if (newMode === 'weekly' || newMode === 'biweekly') {
    const [endY, endM, endD] = activeSchoolYear.endDate.split('-').map(Number);
    const endDate = new Date(endY, endM - 1, endD, 23, 59, 59);

    const [curY, curM, curD] = currentMonday.split('-').map(Number);
    const cursorMonday = new Date(curY, curM - 1, curD, 12, 0, 0);
    cursorMonday.setDate(cursorMonday.getDate() + 7); // Start from next week

    const closures = activeSchoolYear.closures || schoolClosures || [];

    while (cursorMonday <= endDate) {
      const cursorMondayStr = getLocalDateString(cursorMonday);
      const targetDayStr = getDateForDayInWeek(cursorMondayStr, lesson.day);

      // Do not exceed school year end date
      if (targetDayStr > activeSchoolYear.endDate) {
        break;
      }

      // If biweekly, check alternate week condition against originMonday
      if (newMode === 'biweekly') {
        const diffWeeks = getWeekDifference(originMonday, cursorMondayStr);
        if (diffWeeks % 2 !== 0) {
          cursorMonday.setDate(cursorMonday.getDate() + 7);
          continue;
        }
      }

      // Check if school is closed on this day
      const isClosed =
        specialDays.some(sd => sd.date === targetDayStr && sd.type === 'SCHOOL_CLOSED') ||
        closures.some(sc => targetDayStr >= sc.startDate && targetDayStr <= sc.endDate);

      if (isClosed) {
        cursorMonday.setDate(cursorMonday.getDate() + 7);
        continue;
      }

      // Prevent duplicate: check if an active lesson already exists in this slot for this week
      const slotOccupied = cleanSchedule.some(l =>
        !l.isDeleted &&
        l.day === lesson.day &&
        l.hour === lesson.hour &&
        (l.weekStart === cursorMondayStr || (!l.weekStart && l.schoolYearId === activeSchoolYear.id))
      );

      if (!slotOccupied) {
        const newLesson: Lesson = {
          id: crypto.randomUUID(),
          day: lesson.day,
          hour: lesson.hour,
          className: lesson.className || 'A DISPOSIZIONE',
          subject: lesson.subject || '',
          room: lesson.room || '',
          weekStart: cursorMondayStr,
          schoolYearId: lesson.schoolYearId || activeSchoolYear.id,
          isProvisional: false,
          repeatMode: newMode,
          repeatOriginId: originId,
        };
        cleanSchedule.push(newLesson);
      }

      cursorMonday.setDate(cursorMonday.getDate() + 7);
    }
  }

  // Update current lesson
  const updatedCurrentLesson: Lesson = {
    ...lesson,
    weekStart: currentMonday,
    repeatMode: newMode,
    repeatOriginId: originId,
  };

  // Update in cleanSchedule
  const finalSchedule = cleanSchedule.map(l => {
    if (l.id === lesson.id) {
      return updatedCurrentLesson;
    }
    if (l.id === originId && originId !== lesson.id) {
      return {
        ...l,
        repeatMode: newMode,
      };
    }
    return l;
  });

  // Ensure current lesson is in finalSchedule if it wasn't there
  if (!finalSchedule.some(l => l.id === updatedCurrentLesson.id)) {
    finalSchedule.push(updatedCurrentLesson);
  }

  return {
    updatedSchedule: finalSchedule,
    updatedLesson: updatedCurrentLesson,
  };
}
