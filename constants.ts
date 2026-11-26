
import { DayOfWeek, Lesson, LessonNote, Subject, ClassEntity } from './types';

export const APP_VERSION = "2.0";
export const APP_RELEASE_DATE = "27/10/2026";
export const LAST_BACKUP_STORAGE_KEY = "magiclass_last_backup_time";

export const HOURS = [1, 2, 3, 4, 5, 6, 7]; 
export const DAYS = [DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN];
export const DAYS_SIX = [DayOfWeek.LUN, DayOfWeek.MAR, DayOfWeek.MER, DayOfWeek.GIO, DayOfWeek.VEN, DayOfWeek.SAB];

export const TIME_SLOTS: Record<number, string> = {
  1: "08:00 - 09:00",
  2: "09:00 - 10:00",
  3: "10:00 - 11:00",
  4: "11:00 - 12:00",
  5: "12:00 - 13:00",
  6: "13:00 - 13:50",
  7: "13:50 - 14:40",
  8: "14:40 - 15:30",
  9: "15:30 - 16:20",
  10: "16:20 - 17:10"
};

export const DEFAULT_DURATIONS: Record<number, number> = {
  1: 60,
  2: 60,
  3: 60,
  4: 60,
  5: 60,
  6: 50,
  7: 50,
  8: 50,
  9: 50,
  10: 50
};

// Color mapping for classes - HARMONIZED PALETTE WITH BURGUNDY (#810027)
// Tones: Warm Reds, Oranges, Ambers, Sophisticated Purples/Blues, Warm Greys
export const CLASS_COLORS: Record<string, string> = {
  '1AM': 'bg-rose-50 text-rose-900 border-l-4 border-rose-700 shadow-sm hover:shadow-md hover:bg-rose-100',        
  '1BM': 'bg-orange-50 text-orange-900 border-l-4 border-orange-600 shadow-sm hover:shadow-md hover:bg-orange-100',      
  '1CE': 'bg-slate-50 text-slate-900 border-l-4 border-slate-600 shadow-sm hover:shadow-md hover:bg-slate-100', 
  '2AM': 'bg-red-50 text-red-900 border-l-4 border-red-700 shadow-sm hover:shadow-md hover:bg-red-100',   
  '2BM': 'bg-amber-50 text-amber-900 border-l-4 border-amber-600 shadow-sm hover:shadow-md hover:bg-amber-100',      
  '2CE': 'bg-violet-50 text-violet-900 border-l-4 border-violet-700 shadow-sm hover:shadow-md hover:bg-violet-100', 
  
  // Special Types
  'A DISPOSIZIONE': 'bg-stone-50 text-stone-900 border-l-4 border-stone-500 shadow-sm hover:shadow-md hover:bg-stone-100',
  'BUCO': 'bg-white text-slate-400 border border-slate-200 border-dashed hover:bg-slate-50', 
};

export const INITIAL_CLASSES: ClassEntity[] = [
  { id: 'c1', name: '1AM', colorStyles: CLASS_COLORS['1AM'] },
  { id: 'c2', name: '1BM', colorStyles: CLASS_COLORS['1BM'] },
  { id: 'c3', name: '1CE', colorStyles: CLASS_COLORS['1CE'] },
  { id: 'c4', name: '2AM', colorStyles: CLASS_COLORS['2AM'] },
  { id: 'c5', name: '2BM', colorStyles: CLASS_COLORS['2BM'] },
  { id: 'c6', name: '2CE', colorStyles: CLASS_COLORS['2CE'] },
];

export const SUBJECT_COLOR_PRESETS = [
  { name: 'Bordeaux', value: 'bg-red-50 text-red-900 border-l-4 border-red-800 shadow-sm hover:shadow-md hover:bg-red-100' },
  { name: 'Rosa Antico', value: 'bg-rose-50 text-rose-900 border-l-4 border-rose-600 shadow-sm hover:shadow-md hover:bg-rose-100' },
  { name: 'Mattone', value: 'bg-orange-50 text-orange-900 border-l-4 border-orange-700 shadow-sm hover:shadow-md hover:bg-orange-100' },
  { name: 'Ambra', value: 'bg-amber-50 text-amber-900 border-l-4 border-amber-600 shadow-sm hover:shadow-md hover:bg-amber-100' },
  { name: 'Prugna', value: 'bg-fuchsia-50 text-fuchsia-900 border-l-4 border-fuchsia-800 shadow-sm hover:shadow-md hover:bg-fuchsia-100' },
  { name: 'Indaco', value: 'bg-indigo-50 text-indigo-900 border-l-4 border-indigo-700 shadow-sm hover:shadow-md hover:bg-indigo-100' },
  { name: 'Lavanda', value: 'bg-violet-50 text-violet-900 border-l-4 border-violet-600 shadow-sm hover:shadow-md hover:bg-violet-100' },
  { name: 'Sabbia', value: 'bg-stone-50 text-stone-900 border-l-4 border-stone-600 shadow-sm hover:shadow-md hover:bg-stone-100' },
  { name: 'Grigio Blu', value: 'bg-slate-50 text-slate-900 border-l-4 border-slate-600 shadow-sm hover:shadow-md hover:bg-slate-100' },
  { name: 'Petrolio', value: 'bg-teal-50 text-teal-900 border-l-4 border-teal-700 shadow-sm hover:shadow-md hover:bg-teal-100' },
  { name: 'Smeraldo Scuro', value: 'bg-emerald-50 text-emerald-900 border-l-4 border-emerald-700 shadow-sm hover:shadow-md hover:bg-emerald-100' },
  { name: 'Blu Notte', value: 'bg-blue-50 text-blue-900 border-l-4 border-blue-800 shadow-sm hover:shadow-md hover:bg-blue-100' },
];

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 's1', name: 'T.T.R.G.', colorStyles: SUBJECT_COLOR_PRESETS[0].value }
];

// Header Styles - Unified to Primary Red for Brand Consistency
// Matches the "ClasseViva" solid red header look
const PRIMARY_HEADER = { bg: 'bg-primary', text: 'text-white', border: 'border-primary-hover' };

export const MONTH_HEADER_STYLES: Record<number, { bg: string, text: string, border: string }> = {
  0: PRIMARY_HEADER,
  1: PRIMARY_HEADER,
  2: PRIMARY_HEADER,
  3: PRIMARY_HEADER,
  4: PRIMARY_HEADER,
  5: PRIMARY_HEADER,
  6: PRIMARY_HEADER,
  7: PRIMARY_HEADER,
  8: PRIMARY_HEADER,
  9: PRIMARY_HEADER,
  10: PRIMARY_HEADER,
  11: PRIMARY_HEADER
};

// Initial Schedule
export const INITIAL_SCHEDULE: Lesson[] = [
  { id: 'l1', day: DayOfWeek.LUN, hour: 1, className: '1AM', subject: 'T.T.R.G.', room: '' },
  { id: 'l2', day: DayOfWeek.LUN, hour: 2, className: '1AM', subject: 'T.T.R.G.', room: '' },
  { id: 'l3', day: DayOfWeek.MER, hour: 3, className: '1AM', subject: 'T.T.R.G.', room: '' },
  { id: 'l4', day: DayOfWeek.VEN, hour: 1, className: '2BM', subject: 'T.T.R.G.', room: '' },
  { id: 'l5', day: DayOfWeek.GIO, hour: 4, className: '1AM', subject: 'T.T.R.G.', room: '' },
];

// Initial Notes
export const INITIAL_NOTES: LessonNote[] = [
  // Esempio note vuote o legate a date passate
];
