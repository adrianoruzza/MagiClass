import { Lesson, LessonNote, LinkedSubjectGroup, Subject } from '../types';
import { getMatchingSubjectNames } from './subjectLinks';

export interface NoteLessonHint {
  className?: string;
  subject?: string;
  hour?: number;
}

/**
 * Normalizza una data nota a formato YYYY-MM-DD (tollerando eventuali suffissi ISO T...).
 */
export const normalizeNoteDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : trimmed;
};

export const normalizeNoteClassName = (className?: string | null): string =>
  (className || '').replace(/\s+/g, '').toUpperCase();

export const normalizeNoteSubjectName = (subject?: string | null): string =>
  (subject || '').trim().toLowerCase();

/**
 * Verifica se una nota contiene compiti, eventi particolari o promemoria significativi.
 */
export const hasMeaningfulNoteContent = (note?: LessonNote | null): boolean => {
  if (!note) return false;
  return Boolean(
    (note.toCheck && note.toCheck.trim().length > 0) ||
    (note.toDo && note.toDo.trim().length > 0) ||
    (note.misc && note.misc.trim().length > 0) ||
    (note.type && note.type !== 'lesson') ||
    note.reSynced ||
    note.votoSynced
  );
};

/**
 * Ricerca unificata della nota associata a una specifica lezione e data.
 * Usata in modo identico dalla schermata principale (ScheduleView), dalla schermata della classe
 * (AssignmentModal) e da tutte le procedure di salvataggio/propagazione in App.tsx.
 *
 * Garantisce:
 * 1. Corrispondenza esatta per (lessonId, date), preferendo record non vuoti in caso di duplicati.
 * 2. Fallback difensivo per note orfane alla stessa identica ora e classe (senza mai mescolare
 *    ore diverse della stessa classe nella stessa giornata).
 * 3. Tolleranza per materie vuote o collegate e date/nomi con formattazione lievemente diversa.
 */
export const findNoteIndexForLesson = (
  notes: LessonNote[],
  lessonId: string,
  dateStr: string,
  lessonHint?: NoteLessonHint | Lesson | null,
  scheduleList?: Lesson[],
  subjects?: Subject[],
  linkedSubjectGroups?: LinkedSubjectGroup[]
): number => {
  if (!notes || notes.length === 0 || !dateStr) return -1;

  const targetDate = normalizeNoteDate(dateStr);

  // 1. Ricerca esatta per (lessonId, date)
  const exactMatches: number[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n && n.lessonId === lessonId && normalizeNoteDate(n.date) === targetDate) {
      exactMatches.push(i);
    }
  }

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    const nonEmptyIdx = exactMatches.find(idx => hasMeaningfulNoteContent(notes[idx]));
    return nonEmptyIdx !== undefined ? nonEmptyIdx : exactMatches[0];
  }

  // 2. Fallback difensivo per note orfane (es. cambio ID lezione dopo modifica/orario provvisorio/sync):
  // richiede rigorosamente stessa data e stessa ora, oltre alla corrispondenza della classe.
  const resolvedLesson =
    lessonHint && (lessonHint.className || typeof lessonHint.hour === 'number')
      ? lessonHint
      : scheduleList?.find(l => l.id === lessonId);

  const targetClassNorm = normalizeNoteClassName(resolvedLesson?.className);
  const targetHour = resolvedLesson?.hour;

  if (!targetClassNorm || typeof targetHour !== 'number') {
    return -1;
  }

  const targetSubjectRaw = (resolvedLesson?.subject || '').trim();
  const targetSubjectNorm = normalizeNoteSubjectName(targetSubjectRaw);
  const allowedSubjectSet =
    targetSubjectRaw && subjects && subjects.length > 0
      ? new Set(
          getMatchingSubjectNames(targetSubjectRaw, subjects, linkedSubjectGroups || []).map(s =>
            normalizeNoteSubjectName(s)
          )
        )
      : null;

  const fallbackMatches: number[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (!n || normalizeNoteDate(n.date) !== targetDate) continue;

    const noteLesson = scheduleList?.find(l => l.id === n.lessonId);
    const noteClassNorm = normalizeNoteClassName(n.className || noteLesson?.className);
    if (noteClassNorm !== targetClassNorm) continue;

    // Isolamento rigoroso per singola ora: non associare mai la nota di un'altra ora della stessa classe
    const noteHour = typeof n.hour === 'number' ? n.hour : noteLesson?.hour;
    if (noteHour !== targetHour) continue;

    // Controllo materia tollerante: se entrambe valorizzate devono coincidere (o appartenere allo stesso gruppo collegato)
    const noteSubjectNorm = normalizeNoteSubjectName(n.subject || noteLesson?.subject);
    if (targetSubjectNorm && noteSubjectNorm) {
      if (allowedSubjectSet) {
        if (!allowedSubjectSet.has(noteSubjectNorm) && noteSubjectNorm !== targetSubjectNorm) {
          continue;
        }
      } else if (noteSubjectNorm !== targetSubjectNorm) {
        continue;
      }
    }

    fallbackMatches.push(i);
  }

  if (fallbackMatches.length === 0) return -1;
  if (fallbackMatches.length === 1) return fallbackMatches[0];

  const nonEmptyFallback = fallbackMatches.find(idx => hasMeaningfulNoteContent(notes[idx]));
  return nonEmptyFallback !== undefined ? nonEmptyFallback : fallbackMatches[0];
};

export const findNoteForLessonUnified = (
  notes: LessonNote[],
  lessonId: string,
  dateStr: string,
  lessonHint?: NoteLessonHint | Lesson | null,
  scheduleList?: Lesson[],
  subjects?: Subject[],
  linkedSubjectGroups?: LinkedSubjectGroup[]
): LessonNote | undefined => {
  const idx = findNoteIndexForLesson(
    notes,
    lessonId,
    dateStr,
    lessonHint,
    scheduleList,
    subjects,
    linkedSubjectGroups
  );
  return idx >= 0 ? notes[idx] : undefined;
};
