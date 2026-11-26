
export enum DayOfWeek {
  LUN = 'Lunedì',
  MAR = 'Martedì',
  MER = 'Mercoledì',
  GIO = 'Giovedì',
  VEN = 'Venerdì',
  SAB = 'Sabato'
}

export type RepeatMode = 'weekly' | 'biweekly' | 'none';

export interface Lesson {
  id: string;
  day: DayOfWeek;
  hour: number; // 1 to 7
  className: string;
  subject: string;
  room: string;
  weekStart?: string; // YYYY-MM-DD string representing the Monday of the week this lesson belongs to
  schoolYearId?: string;
  isProvisional?: boolean;
  isDeleted?: boolean;
  periodId?: string; // ID of the associated provisional period
  repeatMode?: RepeatMode; // Repetition mode for ore a disposizione
  repeatOriginId?: string; // Origin lesson ID for repetition chain
}

export interface Subject {
  id: string;
  name: string;
  colorStyles: string; // Tailwind classes string (bg, text, border)
  linkedGroupId?: string; // Optional ID of the linked subjects group
  schoolYearId?: string; // Optional ID of the associated school year
}

export interface LinkedSubjectGroup {
  id: string;
  name?: string; // e.g. "Gruppo 1" or custom name
  subjectIds: string[]; // List of subject IDs that are linked together
}

export interface Student {
  id: string;
  name: string;
  isDSA: boolean;
  isH: boolean;
}

export interface ClassEntity {
  id: string;
  name: string;
  colorStyles: string;
  subjectIds?: string[]; // IDs of subjects enabled for this class
  students?: Student[];
  schoolYearId?: string; // Optional ID of the associated school year
}

export interface TaskTemplate {
  id: string;
  title: string;
  tasks: string; // Newline separated
  associatedClassNames: string[];
  schoolYearId?: string; // Optional ID of the associated school year
  updatedAt?: string; // ISO timestamp of last modification for sync conflict resolution
}

export type NoteStatus = 'done' | 'pending' | 'not_done';

export interface LessonNote {
  lessonId: string;
  date: string; // YYYY-MM-DD per storicizzazione
  hour?: number; // Ora specifica della lezione (1..N) per garantire indipendenza tra ore della stessa classe
  
  toCheck: string; // CONTROLLARE
  checkStatus: NoteStatus;
  
  toDo: string;    // FARE
  doStatus: NoteStatus;
  
  misc: string;    // VARIE
  miscStatus: NoteStatus;

  type: 'lesson' | 'assembly' | 'practical_exam' | 'oral_exam' | 'written_exam' | 'skipped_lesson' | 'trip' | 'submission';
  reSynced?: boolean; // Reminder: Compito segnato su Registro Elettronico
  votoSynced?: boolean; // Reminder: Voto segnato su Registro Elettronico
  className?: string; // Classe associata (per preservare identità compito e riallocazione)
  subject?: string;   // Materia associata (per preservare identità compito e riallocazione)
}

export type SpecialDayType = 'ASSEMBLY' | 'PERMISSION' | 'SICK' | 'SCHOOL_CLOSED' | 'TRIP';

export interface SpecialDay {
  date: string; // YYYY-MM-DD
  type: SpecialDayType;
}

export interface SchoolClosure {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

export interface Recess {
  id: string;
  afterHour: number; // The break occurs AFTER this hour (e.g., 2 means betwen 2nd and 3rd)
  duration: 10 | 20 | 30; // Duration in minutes
  associatedHour?: number | null; // Optional: Hour to which this recess is associated (e.g. 3 for 3ª ora)
}

export interface SchoolYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  splitDate: string;
  isSixDayWeek: boolean;
  closures: SchoolClosure[];
  timeSlots?: Record<number, string>;
  durations?: Record<number, number>;
  recesses?: Recess[];
  maxHours?: number;
}

export interface ProvisionalSchedulePeriod {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label?: string;
  timeSlots?: Record<number, string>; // Intervalli orari specifici per questo periodo (es. { 1: "08:10 - 09:00", 2: "09:00 - 09:50" })
  schoolYearId?: string; // Optional ID of associated school year
  updatedAt?: string; // ISO timestamp of last modification for sync conflict resolution
}
