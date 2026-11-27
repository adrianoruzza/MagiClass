import {
  ClassEntity,
  DayOfWeek,
  Lesson,
  SchoolYear,
  TaskTemplate
} from '../types';
import {
  clearUiSessionRecordFromLocalDb,
  loadUiSessionRecordFromLocalDb,
  safeSetLocalStorageItem,
  saveUiSessionRecordToLocalDb
} from './localDatabase';

export const UI_SESSION_SCHEMA_VERSION = 1;
export const UI_SESSION_LS_KEY = 'magiclass_ui_session_v1';

export type ActiveModalScreen =
  | 'schedule'
  | 'assignment'
  | 'settings'
  | 'search'
  | 'remaining_hours'
  | 'class_filter'
  | 'task_database'
  | 'guide'
  | 'backup'
  | 'subjects'
  | 'start_date'
  | 'recess'
  | 'hours_settings'
  | 'provisional_schedule'
  | 'month_picker'
  | 'day_status';

export const VALID_ACTIVE_SCREENS = new Set<ActiveModalScreen>([
  'schedule',
  'assignment',
  'settings',
  'search',
  'remaining_hours',
  'class_filter',
  'task_database',
  'guide',
  'backup',
  'subjects',
  'start_date',
  'recess',
  'hours_settings',
  'provisional_schedule',
  'month_picker',
  'day_status'
]);

export type ScrollContainerKey =
  | 'scheduleMobileDay'
  | 'scheduleDesktopGrid'
  | 'searchModal'
  | 'remainingHoursModal'
  | 'guideModal'
  | 'taskDatabaseModal'
  | 'taskDatabaseExpanded';

export const VALID_SCROLL_KEYS = new Set<ScrollContainerKey>([
  'scheduleMobileDay',
  'scheduleDesktopGrid',
  'searchModal',
  'remainingHoursModal',
  'guideModal',
  'taskDatabaseModal',
  'taskDatabaseExpanded'
]);

export type ScrollPositionsMap = Partial<Record<ScrollContainerKey, number>>;

export interface SelectedLessonRef {
  lessonId: string;
  dateStr: string;
  className?: string;
  subject?: string;
  day?: DayOfWeek;
  hour?: number;
}

export interface UiSessionState {
  schemaVersion: 1;
  updatedAt: number;
  activeScreen: ActiveModalScreen;
  currentDateStr: string;
  focusClass: string | null;
  selectedLessonRef: SelectedLessonRef | null;
  highlightedLessonId: string | null;
  selectedDayStatusDateStr: string | null;
  isMobileWeekView: boolean;
  activeMobileTab: number;
  searchQuery: string;
  searchSelectedClass: string;
  remainingHoursYearId: string | null;
  expandedTaskTemplateId: string | null;
  guideOpenSections: Record<string, boolean>;
  guideSearchQuery: string;
  scrollPositions: ScrollPositionsMap;
}

export interface UiSessionReconcileContext {
  schedule: Lesson[];
  classes: ClassEntity[];
  schoolYears: SchoolYear[];
  taskTemplates: TaskTemplate[];
  visibleDays: DayOfWeek[];
}

export interface ReconciledUiSessionResult {
  session: UiSessionState;
  resolvedLesson: { lesson: Lesson; dateStr: string } | null;
  resolvedCurrentDate: Date | null;
  resolvedDayStatusDate: Date | null;
  hadFallbackAdjustments: boolean;
}

const VALID_DAYS = new Set<string>(Object.values(DayOfWeek));
const DATE_YYYY_MM_DD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SAFE_SECTION_ID_RE = /^[a-z0-9_-]{1,64}$/i;

export const isValidLocalDateString = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = DATE_YYYY_MM_DD_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
};

export const parseLocalDateStringSafe = (value: string | null | undefined): Date | null => {
  if (!isValidLocalDateString(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const clampSafeString = (value: unknown, maxLen: number): string => {
  if (typeof value !== 'string') return '';
  return value.length > maxLen ? value.slice(0, maxLen) : value;
};

const sanitizeOptionalString = (value: unknown, maxLen: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
};

const sanitizeSelectedLessonRef = (raw: unknown): SelectedLessonRef | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const lessonId = sanitizeOptionalString(obj.lessonId, 128);
  if (!lessonId || !isValidLocalDateString(obj.dateStr)) return null;

  const ref: SelectedLessonRef = {
    lessonId,
    dateStr: obj.dateStr
  };

  const className = sanitizeOptionalString(obj.className, 64);
  if (className) ref.className = className;

  const subject = sanitizeOptionalString(obj.subject, 128);
  if (subject) ref.subject = subject;

  if (typeof obj.day === 'string' && VALID_DAYS.has(obj.day)) {
    ref.day = obj.day as DayOfWeek;
  }

  if (typeof obj.hour === 'number' && Number.isInteger(obj.hour) && obj.hour >= 1 && obj.hour <= 20) {
    ref.hour = obj.hour;
  }

  return ref;
};

const sanitizeGuideOpenSections = (raw: unknown): Record<string, boolean> => {
  const clean: Record<string, boolean> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  const entries = Object.entries(raw as Record<string, unknown>);
  for (let i = 0; i < entries.length && i < 40; i++) {
    const [key, val] = entries[i];
    if (SAFE_SECTION_ID_RE.test(key) && typeof val === 'boolean') {
      clean[key] = val;
    }
  }
  return clean;
};

const sanitizeScrollPositions = (raw: unknown): ScrollPositionsMap => {
  const clean: ScrollPositionsMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_SCROLL_KEYS.has(key as ScrollContainerKey)) continue;
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      clean[key as ScrollContainerKey] = Math.min(Math.round(val), 100000);
    }
  }
  return clean;
};

/**
 * Valida e sanifica rigorosamente uno stato di sessione UI grezzo.
 * Accetta esclusivamente i campi UI whitelisted e scarta qualsiasi dato non valido,
 * corrotto o potenzialmente sensibile (token, password, credenziali, campi sconosciuti).
 */
export const sanitizeUiSessionState = (raw: unknown): UiSessionState | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== UI_SESSION_SCHEMA_VERSION) return null;

  const updatedAt =
    typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) && obj.updatedAt > 0
      ? Math.floor(obj.updatedAt)
      : Date.now();

  const activeScreen: ActiveModalScreen =
    typeof obj.activeScreen === 'string' && VALID_ACTIVE_SCREENS.has(obj.activeScreen as ActiveModalScreen)
      ? (obj.activeScreen as ActiveModalScreen)
      : 'schedule';

  const currentDateStr = isValidLocalDateString(obj.currentDateStr)
    ? obj.currentDateStr
    : formatLocalDateString(new Date());

  const focusClass = sanitizeOptionalString(obj.focusClass, 64);
  const selectedLessonRef = sanitizeSelectedLessonRef(obj.selectedLessonRef);
  const highlightedLessonId = sanitizeOptionalString(obj.highlightedLessonId, 128);
  const selectedDayStatusDateStr = isValidLocalDateString(obj.selectedDayStatusDateStr)
    ? obj.selectedDayStatusDateStr
    : null;

  const isMobileWeekView = typeof obj.isMobileWeekView === 'boolean' ? obj.isMobileWeekView : false;
  const rawTab = typeof obj.activeMobileTab === 'number' && Number.isFinite(obj.activeMobileTab)
    ? Math.floor(obj.activeMobileTab)
    : 0;
  const activeMobileTab = Math.max(0, Math.min(rawTab, 6));

  const searchQuery = clampSafeString(obj.searchQuery, 200);
  const searchSelectedClass = sanitizeOptionalString(obj.searchSelectedClass, 64) || 'all';
  const remainingHoursYearId = sanitizeOptionalString(obj.remainingHoursYearId, 128);
  const expandedTaskTemplateId = sanitizeOptionalString(obj.expandedTaskTemplateId, 128);
  const guideOpenSections = sanitizeGuideOpenSections(obj.guideOpenSections);
  const guideSearchQuery = clampSafeString(obj.guideSearchQuery, 200);
  const scrollPositions = sanitizeScrollPositions(obj.scrollPositions);

  return {
    schemaVersion: UI_SESSION_SCHEMA_VERSION,
    updatedAt,
    activeScreen,
    currentDateStr,
    focusClass,
    selectedLessonRef,
    highlightedLessonId,
    selectedDayStatusDateStr,
    isMobileWeekView,
    activeMobileTab,
    searchQuery,
    searchSelectedClass,
    remainingHoursYearId,
    expandedTaskTemplateId,
    guideOpenSections,
    guideSearchQuery,
    scrollPositions
  };
};

/**
 * Riconcilia lo stato UI ripristinato con i dati didattici effettivamente presenti nel DB locale.
 * Gestisce in modo pulito classi eliminate, lezioni rimosse, anni scolastici eliminati,
 * template compiti rimossi e indici fuori intervallo, applicando fallback sicuri senza errori.
 */
export const reconcileSessionWithAppData = (
  session: UiSessionState,
  ctx: UiSessionReconcileContext
): ReconciledUiSessionResult => {
  let hadFallbackAdjustments = false;

  const validClassNames = new Set<string>();
  for (const cls of ctx.classes || []) {
    if (cls?.name && cls.name.trim()) validClassNames.add(cls.name.trim());
  }
  for (const lesson of ctx.schedule || []) {
    if (lesson?.className && lesson.className.trim() && lesson.className !== 'BUCO' && !lesson.isDeleted) {
      validClassNames.add(lesson.className.trim());
    }
  }

  let focusClass = session.focusClass;
  if (focusClass && !validClassNames.has(focusClass)) {
    focusClass = null;
    hadFallbackAdjustments = true;
  }

  let searchSelectedClass = session.searchSelectedClass || 'all';
  if (searchSelectedClass !== 'all' && !validClassNames.has(searchSelectedClass)) {
    searchSelectedClass = 'all';
    hadFallbackAdjustments = true;
  }

  const activeLessons = (ctx.schedule || []).filter((l) => !l.isDeleted);
  let resolvedLesson: { lesson: Lesson; dateStr: string } | null = null;
  let selectedLessonRef: SelectedLessonRef | null = null;

  if (session.selectedLessonRef) {
    const ref = session.selectedLessonRef;
    let found = activeLessons.find((l) => l.id === ref.lessonId);
    if (!found && ref.day && ref.hour && ref.className) {
      found = activeLessons.find(
        (l) => l.day === ref.day && l.hour === ref.hour && l.className === ref.className
      );
    }
    if (found) {
      resolvedLesson = { lesson: found, dateStr: ref.dateStr };
      selectedLessonRef = {
        lessonId: found.id,
        dateStr: ref.dateStr,
        className: found.className,
        subject: found.subject,
        day: found.day,
        hour: found.hour
      };
    } else {
      hadFallbackAdjustments = true;
    }
  }

  let highlightedLessonId = session.highlightedLessonId;
  if (highlightedLessonId && !activeLessons.some((l) => l.id === highlightedLessonId)) {
    highlightedLessonId = null;
    hadFallbackAdjustments = true;
  }

  const resolvedCurrentDate = parseLocalDateStringSafe(session.currentDateStr);
  const resolvedDayStatusDate = parseLocalDateStringSafe(session.selectedDayStatusDateStr);

  let activeScreen: ActiveModalScreen = session.activeScreen;
  if (activeScreen === 'assignment' && !resolvedLesson) {
    activeScreen = 'schedule';
    hadFallbackAdjustments = true;
  }
  if (activeScreen === 'day_status' && !resolvedDayStatusDate) {
    activeScreen = 'schedule';
    hadFallbackAdjustments = true;
  }

  let remainingHoursYearId = session.remainingHoursYearId;
  if (remainingHoursYearId) {
    const yearExists =
      (ctx.schoolYears || []).some((y) => y.id === remainingHoursYearId) ||
      ((ctx.schoolYears || []).length === 0 && remainingHoursYearId === 'default-year');
    if (!yearExists) {
      const todayStr = formatLocalDateString(new Date());
      const fallbackYear =
        (ctx.schoolYears || []).find((y) => todayStr >= y.startDate && todayStr <= y.endDate) ||
        (ctx.schoolYears || [])[0];
      remainingHoursYearId = fallbackYear?.id || null;
      hadFallbackAdjustments = true;
    }
  }

  let expandedTaskTemplateId = session.expandedTaskTemplateId;
  if (expandedTaskTemplateId && !(ctx.taskTemplates || []).some((t) => t.id === expandedTaskTemplateId)) {
    expandedTaskTemplateId = null;
    hadFallbackAdjustments = true;
  }

  const maxTabIdx = Math.max(0, (ctx.visibleDays?.length || 5) - 1);
  let activeMobileTab = session.activeMobileTab;
  if (activeMobileTab < 0 || activeMobileTab > maxTabIdx) {
    activeMobileTab = Math.max(0, Math.min(activeMobileTab, maxTabIdx));
    hadFallbackAdjustments = true;
  }

  return {
    session: {
      ...session,
      activeScreen,
      focusClass,
      selectedLessonRef,
      highlightedLessonId,
      selectedDayStatusDateStr: resolvedDayStatusDate ? session.selectedDayStatusDateStr : null,
      activeMobileTab,
      searchSelectedClass,
      remainingHoursYearId,
      expandedTaskTemplateId
    },
    resolvedLesson,
    resolvedCurrentDate,
    resolvedDayStatusDate,
    hadFallbackAdjustments
  };
};

const readUiSessionMirrorFromLocalStorage = (): UiSessionState | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(UI_SESSION_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeUiSessionState(parsed);
  } catch {
    return null;
  }
};

const writeUiSessionMirrorToLocalStorage = (state: UiSessionState): boolean => {
  try {
    const res = safeSetLocalStorageItem(UI_SESSION_LS_KEY, JSON.stringify(state));
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Carica l'ultima sessione UI valida confrontando IndexedDB (`ui_session`)
 * e lo specchio sincrono in `localStorage` (che cattura anche chiusure improvvise del browser).
 * Restituisce lo stato valido più recente, oppure `null` se assente o corrotto.
 */
export const loadLastUiSession = async (): Promise<UiSessionState | null> => {
  const lsState = readUiSessionMirrorFromLocalStorage();
  let idbState: UiSessionState | null = null;

  try {
    const rawIdb = await loadUiSessionRecordFromLocalDb<unknown>();
    idbState = sanitizeUiSessionState(rawIdb);
  } catch {
    idbState = null;
  }

  if (idbState && lsState) {
    return lsState.updatedAt >= idbState.updatedAt ? lsState : idbState;
  }
  return idbState || lsState || null;
};

/**
 * Salva in modo sincrono immediato sullo specchio localStorage e avvia la scrittura su IndexedDB.
 * Pensato per gli eventi di chiusura improvvisa / refresh / cambio visibilità (`pagehide`, `beforeunload`, `visibilitychange`).
 */
export const flushUiSessionSync = (rawState: UiSessionState): UiSessionState | null => {
  const sanitized = sanitizeUiSessionState({
    ...rawState,
    updatedAt: Date.now()
  });
  if (!sanitized) return null;

  writeUiSessionMirrorToLocalStorage(sanitized);
  void saveUiSessionRecordToLocalDb(sanitized);
  return sanitized;
};

/**
 * Cancella lo stato di sessione UI temporaneo (senza toccare i dati didattici permanenti).
 */
export const clearLastUiSession = async (): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(UI_SESSION_LS_KEY);
    }
  } catch {
    // ignore
  }
  await clearUiSessionRecordFromLocalDb();
};

const computeSessionFingerprint = (state: UiSessionState): string => {
  const { updatedAt: _ignoreUpdatedAt, ...comparable } = state;
  return JSON.stringify(comparable);
};

export interface UiSessionPersister {
  scheduleSave: (state: UiSessionState) => void;
  flushNow: (state?: UiSessionState | null) => void;
  cancel: () => void;
  getLastWrittenFingerprint: () => string;
}

/**
 * Gestore efficiente di salvataggio sessione con debounce e deduplicazione:
 * evita scritture inutili su IndexedDB durante scroll/digitazione continui,
 * ma garantisce flush immediato su richiesta (chiusura scheda / refresh / background).
 */
export const createUiSessionPersister = (options?: {
  debounceMs?: number;
  writeIdb?: (state: UiSessionState) => Promise<boolean>;
  writeLs?: (state: UiSessionState) => boolean;
}): UiSessionPersister => {
  const debounceMs = options?.debounceMs ?? 350;
  const writeIdb = options?.writeIdb ?? saveUiSessionRecordToLocalDb;
  const writeLs = options?.writeLs ?? writeUiSessionMirrorToLocalStorage;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingState: UiSessionState | null = null;
  let lastWrittenFingerprint = '';

  const commit = (candidate: UiSessionState, forceSyncLs: boolean) => {
    const sanitized = sanitizeUiSessionState({
      ...candidate,
      updatedAt: Date.now()
    });
    if (!sanitized) return;

    const fingerprint = computeSessionFingerprint(sanitized);
    if (!forceSyncLs && fingerprint === lastWrittenFingerprint) {
      return;
    }

    lastWrittenFingerprint = fingerprint;
    writeLs(sanitized);
    void writeIdb(sanitized);
  };

  return {
    scheduleSave: (state: UiSessionState) => {
      const sanitized = sanitizeUiSessionState(state);
      if (!sanitized) return;
      const fingerprint = computeSessionFingerprint(sanitized);
      if (fingerprint === lastWrittenFingerprint && !timer) {
        return;
      }
      pendingState = sanitized;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (pendingState) {
          const toCommit = pendingState;
          pendingState = null;
          commit(toCommit, false);
        }
      }, debounceMs);
    },
    flushNow: (explicitState?: UiSessionState | null) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const target = explicitState || pendingState;
      pendingState = null;
      if (!target) return;
      commit(target, true);
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pendingState = null;
    },
    getLastWrittenFingerprint: () => lastWrittenFingerprint
  };
};
