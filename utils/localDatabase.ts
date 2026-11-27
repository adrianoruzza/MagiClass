import {
  Lesson,
  LessonNote,
  SpecialDay,
  SchoolClosure,
  SchoolYear,
  Recess,
  Subject,
  ClassEntity,
  TaskTemplate,
  ProvisionalSchedulePeriod,
  LinkedSubjectGroup
} from '../types';

export const LOCAL_DB_NAME = 'magiclass_local_db';
export const LOCAL_DB_VERSION = 2;
export const LOCAL_DB_SCHEMA_VERSION = 2;

const STORE_APP_STATE = 'app_state';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_UI_SESSION = 'ui_session';
const PRIMARY_STATE_KEY = 'current_state';
const UI_SESSION_KEY = 'last_ui_session';
const MAX_SNAPSHOTS = 5;

export const LOCAL_MIRROR_META_KEY = 'magiclass_local_mirror_meta_v1';

const LEGACY_CLOUD_DB_NAME = 'magiclass_secure_vault';

const LEGACY_CLOUD_LS_PREFIXES = [
  'magiclass_google_',
  'magiclass_drive_',
  'magiclass_auth_diag'
];

export interface LocalAppState {
  schedule: Lesson[];
  lessonNotes: LessonNote[];
  specialDays: SpecialDay[];
  schoolClosures: SchoolClosure[];
  schoolYears: SchoolYear[];
  timeSlots: Record<number, string>;
  durations: Record<number, number>;
  recesses: Recess[];
  subjects: Subject[];
  classes: ClassEntity[];
  taskTemplates: TaskTemplate[];
  provisionalPeriods: ProvisionalSchedulePeriod[];
  linkedSubjectGroups: LinkedSubjectGroup[];
  schoolStartDate: string; // ISO string
  schoolEndDate: string; // ISO string
  semesterSplitDate: string; // ISO string
  isSixDayWeek: boolean;
  maxHours: number;
  timeSettingsUpdatedAt?: string;
}

export interface StoredStateRecord {
  id: string;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  updatedAtMs?: number;
  contentHash?: string;
  data: LocalAppState;
}

export interface LocalMirrorMeta {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  updatedAtMs: number;
  contentHash: string;
}

export interface LocalSnapshotRecord {
  id: string;
  createdAt: string;
  reason: 'pre_migration' | 'pre_restore' | 'manual_safety';
  label: string;
  schemaVersion: number;
  data: LocalAppState;
}

export interface LocalDbInitResult {
  record: StoredStateRecord | null;
  migratedFromLocalStorage: boolean;
  recoveredNewerMirror?: boolean;
  storageEngine: 'indexeddb' | 'localstorage_fallback';
  warningMessage?: string;
}

export interface LocalDbWriteResult {
  ok: boolean;
  revision?: number;
  updatedAt?: string;
  updatedAtMs?: number;
  contentHash?: string;
  verified?: boolean;
  superseded?: boolean;
  persistedInIndexedDb?: boolean;
  persistedInLocalStorage?: boolean;
  storageEngine: 'indexeddb' | 'localstorage_fallback';
  errorCode?: 'QUOTA_EXCEEDED' | 'IDB_UNAVAILABLE' | 'WRITE_FAILED' | 'VERIFY_FAILED';
  errorMessage?: string;
}

export type PersistencePhase = 'loading' | 'saving' | 'saved' | 'unsaved' | 'error';

export interface PersistenceStatusInfo {
  phase: PersistencePhase;
  revision: number;
  lastSavedAt: string | null;
  storageEngine: 'indexeddb' | 'localstorage_fallback';
  pendingWrites: number;
  errorMessage?: string;
}

const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
};

const safeParseJson = <T>(raw: string | null): T | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

/**
 * Hash deterministico rapido (FNV-1a 32-bit doppio) indipendente dall'ordine delle chiavi
 * per verificare l'integrità delle scritture tra memoria, mirror localStorage e IndexedDB.
 */
const canonicalSerializeState = (state: LocalAppState): string => {
  const ordered: Record<string, unknown> = {
    classes: state.classes ?? [],
    durations: state.durations ?? {},
    isSixDayWeek: Boolean(state.isSixDayWeek),
    lessonNotes: state.lessonNotes ?? [],
    linkedSubjectGroups: state.linkedSubjectGroups ?? [],
    maxHours: Number(state.maxHours) || 7,
    provisionalPeriods: state.provisionalPeriods ?? [],
    recesses: state.recesses ?? [],
    schedule: state.schedule ?? [],
    schoolClosures: state.schoolClosures ?? [],
    schoolEndDate: state.schoolEndDate ?? '',
    schoolStartDate: state.schoolStartDate ?? '',
    schoolYears: state.schoolYears ?? [],
    semesterSplitDate: state.semesterSplitDate ?? '',
    specialDays: state.specialDays ?? [],
    subjects: state.subjects ?? [],
    taskTemplates: state.taskTemplates ?? [],
    timeSettingsUpdatedAt: state.timeSettingsUpdatedAt ?? null,
    timeSlots: state.timeSlots ?? {}
  };
  return JSON.stringify(ordered);
};

export const computeStateContentHash = (state: LocalAppState): string => {
  const str = canonicalSerializeState(state);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}:${str.length}`;
};

export const safeSetLocalStorageItem = (key: string, value: string): { ok: boolean; quotaExceeded?: boolean } => {
  try {
    if (typeof localStorage === 'undefined') return { ok: false };
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (err: any) {
    const quotaExceeded =
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.code === 1014;
    return { ok: false, quotaExceeded };
  }
};

export const readMirrorMetaFromLocalStorage = (): LocalMirrorMeta | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = safeParseJson<LocalMirrorMeta>(localStorage.getItem(LOCAL_MIRROR_META_KEY));
    if (
      raw &&
      typeof raw.updatedAtMs === 'number' &&
      Number.isFinite(raw.updatedAtMs) &&
      typeof raw.revision === 'number' &&
      typeof raw.contentHash === 'string'
    ) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
};

const writeMirrorMetaToLocalStorage = (meta: LocalMirrorMeta): { ok: boolean; quotaExceeded?: boolean } => {
  return safeSetLocalStorageItem(LOCAL_MIRROR_META_KEY, JSON.stringify(meta));
};

/**
 * Rimuove in modo sicuro chiavi legacy esclusivamente legate ai vecchi servizi cloud/OAuth
 * e cancella il vecchio database dei token OAuth (`magiclass_secure_vault`),
 * senza mai toccare i dati didattici dell'utente.
 */
export const cleanupLegacyCloudArtifacts = (): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (LEGACY_CLOUD_LS_PREFIXES.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      const sKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (LEGACY_CLOUD_LS_PREFIXES.some(prefix => key.startsWith(prefix))) {
          sKeys.push(key);
        }
      }
      sKeys.forEach(k => {
        try {
          sessionStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    if (isIndexedDBAvailable()) {
      indexedDB.deleteDatabase(LEGACY_CLOUD_DB_NAME);
    }
  } catch {
    // ignore
  }
};

/**
 * Legge eventuali dati esistenti dalle chiavi storiche `techdraw_*` in localStorage
 * per garantire una migrazione preventiva o il recupero di scritture sincrone interrotte.
 */
export const readLegacyLocalStorageState = (): Partial<LocalAppState> | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const rawSchedule = safeParseJson<Lesson[]>(localStorage.getItem('techdraw_schedule'));
    const rawNotes = safeParseJson<LessonNote[]>(localStorage.getItem('techdraw_notes'));
    const rawSpecialDays = safeParseJson<SpecialDay[]>(localStorage.getItem('techdraw_special_days'));
    const rawClosures = safeParseJson<SchoolClosure[]>(localStorage.getItem('techdraw_closures'));
    const rawSchoolYears = safeParseJson<SchoolYear[]>(localStorage.getItem('techdraw_school_years'));
    const rawTimeSlots = safeParseJson<Record<number, string>>(localStorage.getItem('techdraw_time_slots'));
    const rawDurations = safeParseJson<Record<number, number>>(localStorage.getItem('techdraw_durations'));
    const rawRecesses = safeParseJson<Recess[]>(localStorage.getItem('techdraw_recesses'));
    const rawSubjects = safeParseJson<Subject[]>(localStorage.getItem('techdraw_subjects'));
    const rawClasses = safeParseJson<ClassEntity[]>(localStorage.getItem('techdraw_classes'));
    const rawTaskTemplates = safeParseJson<TaskTemplate[]>(localStorage.getItem('techdraw_task_templates'));
    const rawProvisional = safeParseJson<ProvisionalSchedulePeriod[]>(localStorage.getItem('techdraw_provisional_periods'));
    const rawLinkedGroups = safeParseJson<LinkedSubjectGroup[]>(localStorage.getItem('techdraw_linked_subject_groups'));
    const rawStartDate = localStorage.getItem('techdraw_start_date') || undefined;
    const rawEndDate = localStorage.getItem('techdraw_end_date') || undefined;
    const rawSemesterSplit = localStorage.getItem('techdraw_semester_split') || undefined;
    const rawIsSixDay = localStorage.getItem('techdraw_is_six_day');
    const rawMaxHours = localStorage.getItem('techdraw_max_hours');
    const rawTimeSettingsUpdatedAt = localStorage.getItem('magiclass_time_settings_updated_at') || undefined;

    const hasAnyLegacyData = Boolean(
      rawSchedule !== undefined ||
      rawNotes !== undefined ||
      rawSpecialDays !== undefined ||
      rawClosures !== undefined ||
      rawSchoolYears !== undefined ||
      rawTimeSlots !== undefined ||
      rawDurations !== undefined ||
      rawRecesses !== undefined ||
      rawSubjects !== undefined ||
      rawClasses !== undefined ||
      rawTaskTemplates !== undefined ||
      rawProvisional !== undefined ||
      rawLinkedGroups !== undefined ||
      rawStartDate !== undefined ||
      rawEndDate !== undefined
    );

    if (!hasAnyLegacyData) return null;

    return {
      ...(rawSchedule !== undefined ? { schedule: rawSchedule } : {}),
      ...(rawNotes !== undefined ? { lessonNotes: rawNotes } : {}),
      ...(rawSpecialDays !== undefined ? { specialDays: rawSpecialDays } : {}),
      ...(rawClosures !== undefined ? { schoolClosures: rawClosures } : {}),
      ...(rawSchoolYears !== undefined ? { schoolYears: rawSchoolYears } : {}),
      ...(rawTimeSlots !== undefined ? { timeSlots: rawTimeSlots } : {}),
      ...(rawDurations !== undefined ? { durations: rawDurations } : {}),
      ...(rawRecesses !== undefined ? { recesses: rawRecesses } : {}),
      ...(rawSubjects !== undefined ? { subjects: rawSubjects } : {}),
      ...(rawClasses !== undefined ? { classes: rawClasses } : {}),
      ...(rawTaskTemplates !== undefined ? { taskTemplates: rawTaskTemplates } : {}),
      ...(rawProvisional !== undefined ? { provisionalPeriods: rawProvisional } : {}),
      ...(rawLinkedGroups !== undefined ? { linkedSubjectGroups: rawLinkedGroups } : {}),
      ...(rawStartDate !== undefined ? { schoolStartDate: rawStartDate } : {}),
      ...(rawEndDate !== undefined ? { schoolEndDate: rawEndDate } : {}),
      ...(rawSemesterSplit !== undefined ? { semesterSplitDate: rawSemesterSplit } : {}),
      ...(rawIsSixDay !== null ? { isSixDayWeek: rawIsSixDay === 'true' } : {}),
      ...(rawMaxHours !== null && !isNaN(parseInt(rawMaxHours, 10)) ? { maxHours: parseInt(rawMaxHours, 10) } : {}),
      ...(rawTimeSettingsUpdatedAt !== undefined ? { timeSettingsUpdatedAt: rawTimeSettingsUpdatedAt } : {})
    };
  } catch {
    return null;
  }
};

/**
 * Specchia in modo sincrono i dati essenziali in localStorage come copia secondaria immediata
 * per proteggere da chiusure improvvise del browser prima del completamento della transazione IndexedDB.
 */
export const mirrorStateToLocalStorage = (
  state: Partial<LocalAppState>,
  meta?: LocalMirrorMeta
): { ok: boolean; quotaExceeded?: boolean } => {
  let allOk = true;
  let quotaHit = false;

  const writeKey = (key: string, val: string) => {
    const res = safeSetLocalStorageItem(key, val);
    if (!res.ok) {
      allOk = false;
      if (res.quotaExceeded) quotaHit = true;
    }
  };

  if (state.schedule !== undefined) writeKey('techdraw_schedule', JSON.stringify(state.schedule));
  if (state.lessonNotes !== undefined) writeKey('techdraw_notes', JSON.stringify(state.lessonNotes));
  if (state.specialDays !== undefined) writeKey('techdraw_special_days', JSON.stringify(state.specialDays));
  if (state.schoolClosures !== undefined) writeKey('techdraw_closures', JSON.stringify(state.schoolClosures));
  if (state.schoolYears !== undefined) writeKey('techdraw_school_years', JSON.stringify(state.schoolYears));
  if (state.timeSlots !== undefined) writeKey('techdraw_time_slots', JSON.stringify(state.timeSlots));
  if (state.durations !== undefined) writeKey('techdraw_durations', JSON.stringify(state.durations));
  if (state.recesses !== undefined) writeKey('techdraw_recesses', JSON.stringify(state.recesses));
  if (state.subjects !== undefined) writeKey('techdraw_subjects', JSON.stringify(state.subjects));
  if (state.classes !== undefined) writeKey('techdraw_classes', JSON.stringify(state.classes));
  if (state.taskTemplates !== undefined) writeKey('techdraw_task_templates', JSON.stringify(state.taskTemplates));
  if (state.provisionalPeriods !== undefined) writeKey('techdraw_provisional_periods', JSON.stringify(state.provisionalPeriods));
  if (state.linkedSubjectGroups !== undefined) writeKey('techdraw_linked_subject_groups', JSON.stringify(state.linkedSubjectGroups));
  if (state.schoolStartDate !== undefined) writeKey('techdraw_start_date', state.schoolStartDate);
  if (state.schoolEndDate !== undefined) writeKey('techdraw_end_date', state.schoolEndDate);
  if (state.semesterSplitDate !== undefined) writeKey('techdraw_semester_split', state.semesterSplitDate);
  if (state.isSixDayWeek !== undefined) writeKey('techdraw_is_six_day', String(state.isSixDayWeek));
  if (state.maxHours !== undefined) writeKey('techdraw_max_hours', String(state.maxHours));
  if (state.timeSettingsUpdatedAt !== undefined) writeKey('magiclass_time_settings_updated_at', state.timeSettingsUpdatedAt);

  // Scrive i metadati di versione SOLO se tutte le chiavi sono state salvate senza errori
  if (meta && allOk) {
    const metaRes = writeMirrorMetaToLocalStorage(meta);
    if (!metaRes.ok) {
      allOk = false;
      if (metaRes.quotaExceeded) quotaHit = true;
    }
  }

  return { ok: allOk, quotaExceeded: quotaHit };
};

let dbPromise: Promise<IDBDatabase> | null = null;
let lastMonotonicTimestampMs = 0;
let lastKnownRevision = 0;

const nextMonotonicTimestampMs = (minFloorMs: number = 0): number => {
  const now = Date.now();
  const next = Math.max(now, lastMonotonicTimestampMs + 1, minFloorMs + 1);
  lastMonotonicTimestampMs = next;
  return next;
};

export const resetLocalDbConnectionForTests = (): void => {
  dbPromise = null;
  lastMonotonicTimestampMs = 0;
  lastKnownRevision = 0;
  pendingWriteChain = Promise.resolve({
    ok: true,
    storageEngine: 'indexeddb'
  });
  latestQueuedWriteId = 0;
};

const openLocalDatabase = (): Promise<IDBDatabase> => {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB non disponibile in questo browser.'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        dbPromise = null;
        reject(new Error('Timeout apertura database locale IndexedDB.'));
      }
    }, 6000);

    try {
      const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_APP_STATE)) {
          db.createObjectStore(STORE_APP_STATE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const snapshotStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
          snapshotStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_UI_SESSION)) {
          db.createObjectStore(STORE_UI_SESSION, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        dbPromise = null;
        reject(request.error || new Error('Errore apertura database locale.'));
      };

      request.onblocked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        dbPromise = null;
        reject(new Error('Database locale bloccato da un\'altra scheda aperta.'));
      };
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        dbPromise = null;
        reject(err);
      }
    }
  });

  return dbPromise;
};

const readPrimaryStateFromDb = async (db: IDBDatabase): Promise<StoredStateRecord | null> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP_STATE, 'readonly');
    const store = tx.objectStore(STORE_APP_STATE);
    const req = store.get(PRIMARY_STATE_KEY);
    req.onsuccess = () => resolve((req.result as StoredStateRecord) || null);
    req.onerror = () => reject(req.error);
  });
};

const writePrimaryStateToDb = async (
  db: IDBDatabase,
  record: StoredStateRecord
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP_STATE, 'readwrite');
    const store = tx.objectStore(STORE_APP_STATE);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Errore transazione di scrittura database locale.'));
    tx.onabort = () => reject(tx.error || new Error('Transazione di scrittura annullata.'));
  });
};

const pruneOldSnapshots = async (db: IDBDatabase): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as LocalSnapshotRecord[]) || [];
        if (all.length > MAX_SNAPSHOTS) {
          all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const toDelete = all.slice(MAX_SNAPSHOTS);
          toDelete.forEach(item => store.delete(item.id));
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

/**
 * Richiede in modo non bloccante l'archiviazione persistente al browser
 * per ridurre il rischio di rimozione automatica dei dati in caso di spazio limitato.
 */
export const requestPersistentStorageBestEffort = async (): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      const already = typeof navigator.storage.persisted === 'function'
        ? await navigator.storage.persisted()
        : false;
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
};

/**
 * Crea uno snapshot di sicurezza atomico prima di operazioni critiche (migrazione o ripristino backup).
 */
export const createLocalSnapshot = async (
  state: LocalAppState,
  reason: LocalSnapshotRecord['reason'],
  label: string
): Promise<LocalSnapshotRecord | null> => {
  const snapshot: LocalSnapshotRecord = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reason,
    label,
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    data: JSON.parse(JSON.stringify(state))
  };

  if (!isIndexedDBAvailable()) {
    safeSetLocalStorageItem('magiclass_last_safety_snapshot', JSON.stringify(snapshot));
    return snapshot;
  }

  try {
    const db = await openLocalDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    await pruneOldSnapshots(db);
    return snapshot;
  } catch (err) {
    console.warn('Impossibile salvare lo snapshot in IndexedDB, uso fallback locale:', err);
    safeSetLocalStorageItem('magiclass_last_safety_snapshot', JSON.stringify(snapshot));
    return snapshot;
  }
};

export const getLatestPreRestoreSnapshot = async (): Promise<LocalSnapshotRecord | null> => {
  if (!isIndexedDBAvailable()) {
    const raw = safeParseJson<LocalSnapshotRecord>(
      typeof localStorage !== 'undefined' ? localStorage.getItem('magiclass_last_safety_snapshot') : null
    );
    return raw && raw.reason === 'pre_restore' ? raw : null;
  }

  try {
    const db = await openLocalDatabase();
    const all = await new Promise<LocalSnapshotRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as LocalSnapshotRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
    const preRestore = all
      .filter(s => s.reason === 'pre_restore')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return preRestore[0] || null;
  } catch {
    return null;
  }
};

export const getSnapshotById = async (snapshotId: string): Promise<LocalSnapshotRecord | null> => {
  if (!isIndexedDBAvailable()) {
    const raw = safeParseJson<LocalSnapshotRecord>(
      typeof localStorage !== 'undefined' ? localStorage.getItem('magiclass_last_safety_snapshot') : null
    );
    return raw && raw.id === snapshotId ? raw : null;
  }

  try {
    const db = await openLocalDatabase();
    return await new Promise<LocalSnapshotRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.get(snapshotId);
      req.onsuccess = () => resolve((req.result as LocalSnapshotRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

const getRecordTimestampMs = (record: StoredStateRecord | null): number => {
  if (!record) return 0;
  if (typeof record.updatedAtMs === 'number' && Number.isFinite(record.updatedAtMs) && record.updatedAtMs > 0) {
    return record.updatedAtMs;
  }
  const parsed = Date.parse(record.updatedAt || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Inizializza il database locale IndexedDB, pulisce i residui cloud obsoleti,
 * confronta in modo sicuro IndexedDB con l'eventuale copia sincrona più recente
 * (es. dopo chiusura improvvisa del browser) e migra eventuali dati legacy senza perdita.
 */
export const initAndLoadLocalDatabase = async (
  currentHydratedDefaults: LocalAppState
): Promise<LocalDbInitResult> => {
  cleanupLegacyCloudArtifacts();
  void requestPersistentStorageBestEffort();

  if (!isIndexedDBAvailable()) {
    const legacy = readLegacyLocalStorageState();
    const fallbackData: LocalAppState = {
      ...currentHydratedDefaults,
      ...(legacy || {})
    };
    const mirrorMeta = readMirrorMetaFromLocalStorage();
    return {
      record: {
        id: PRIMARY_STATE_KEY,
        schemaVersion: LOCAL_DB_SCHEMA_VERSION,
        revision: mirrorMeta?.revision || 1,
        updatedAt: mirrorMeta?.updatedAt || new Date().toISOString(),
        updatedAtMs: mirrorMeta?.updatedAtMs || Date.now(),
        contentHash: mirrorMeta?.contentHash || computeStateContentHash(fallbackData),
        data: fallbackData
      },
      migratedFromLocalStorage: false,
      storageEngine: 'localstorage_fallback',
      warningMessage: 'IndexedDB non disponibile: utilizzo archiviazione locale compatibile (localStorage).'
    };
  }

  try {
    const db = await openLocalDatabase();
    const existingRecord = await readPrimaryStateFromDb(db);
    const mirrorMeta = readMirrorMetaFromLocalStorage();
    const legacyPartial = readLegacyLocalStorageState();

    if (existingRecord && existingRecord.data) {
      const idbTs = getRecordTimestampMs(existingRecord);
      const idbHash = existingRecord.contentHash || computeStateContentHash(existingRecord.data);
      lastKnownRevision = Math.max(lastKnownRevision, existingRecord.revision || 0);
      lastMonotonicTimestampMs = Math.max(lastMonotonicTimestampMs, idbTs);

      // Controllo integrità anti-perdita: se lo specchio sincrono in localStorage contiene
      // una scrittura verificata PIÙ RECENTE di IndexedDB (es. chiusura improvvisa durante transazione IDB),
      // recupera quei dati e li consolida subito in IndexedDB invece di sovrascriverli con il vecchio record!
      if (mirrorMeta && legacyPartial && mirrorMeta.updatedAtMs > idbTs) {
        const candidateMirrorState: LocalAppState = {
          ...existingRecord.data,
          ...legacyPartial
        };
        const computedMirrorHash = computeStateContentHash(candidateMirrorState);

        if (computedMirrorHash === mirrorMeta.contentHash && computedMirrorHash !== idbHash) {
          const recoveredRev = Math.max(existingRecord.revision || 0, mirrorMeta.revision || 0) + 1;
          const recoveredTs = nextMonotonicTimestampMs(mirrorMeta.updatedAtMs);
          const recoveredIso = new Date(recoveredTs).toISOString();
          const recoveredRecord: StoredStateRecord = {
            id: PRIMARY_STATE_KEY,
            schemaVersion: LOCAL_DB_SCHEMA_VERSION,
            revision: recoveredRev,
            updatedAt: recoveredIso,
            updatedAtMs: recoveredTs,
            contentHash: computedMirrorHash,
            data: candidateMirrorState
          };

          await writePrimaryStateToDb(db, recoveredRecord);
          const verifiedRecovered = await readPrimaryStateFromDb(db);
          if (verifiedRecovered && verifiedRecovered.data) {
            lastKnownRevision = recoveredRev;
            mirrorStateToLocalStorage(verifiedRecovered.data, {
              schemaVersion: LOCAL_DB_SCHEMA_VERSION,
              revision: recoveredRev,
              updatedAt: recoveredIso,
              updatedAtMs: recoveredTs,
              contentHash: computedMirrorHash
            });
            return {
              record: verifiedRecovered,
              migratedFromLocalStorage: false,
              recoveredNewerMirror: true,
              storageEngine: 'indexeddb'
            };
          }
        }
      }

      // Allinea silenziosamente lo specchio localStorage con il record autorevole di IndexedDB
      const syncedTs = idbTs || nextMonotonicTimestampMs();
      mirrorStateToLocalStorage(existingRecord.data, {
        schemaVersion: LOCAL_DB_SCHEMA_VERSION,
        revision: existingRecord.revision || 1,
        updatedAt: existingRecord.updatedAt || new Date(syncedTs).toISOString(),
        updatedAtMs: syncedTs,
        contentHash: idbHash
      });

      return {
        record: existingRecord,
        migratedFromLocalStorage: false,
        storageEngine: 'indexeddb'
      };
    }

    // IndexedDB vuoto: verifica presenza dati legacy in localStorage e migra in modo verificato
    const mergedInitialState: LocalAppState = {
      ...currentHydratedDefaults,
      ...(legacyPartial || {})
    };

    if (legacyPartial) {
      await createLocalSnapshot(
        mergedInitialState,
        'pre_migration',
        'Snapshot automatico pre-migrazione da localStorage'
      );
    }

    const nowMs = nextMonotonicTimestampMs(mirrorMeta?.updatedAtMs || 0);
    const nowIso = new Date(nowMs).toISOString();
    const contentHash = computeStateContentHash(mergedInitialState);
    const initialRev = Math.max(1, mirrorMeta?.revision || 1);
    const initialRecord: StoredStateRecord = {
      id: PRIMARY_STATE_KEY,
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      revision: initialRev,
      updatedAt: nowIso,
      updatedAtMs: nowMs,
      contentHash,
      data: mergedInitialState
    };

    await writePrimaryStateToDb(db, initialRecord);

    // Verifica attiva post-scrittura prima di confermare la migrazione
    const verified = await readPrimaryStateFromDb(db);
    if (!verified || !verified.data) {
      throw new Error('Verifica lettura post-migrazione fallita.');
    }

    lastKnownRevision = verified.revision;
    mirrorStateToLocalStorage(verified.data, {
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      revision: verified.revision,
      updatedAt: nowIso,
      updatedAtMs: nowMs,
      contentHash
    });

    return {
      record: verified,
      migratedFromLocalStorage: Boolean(legacyPartial),
      storageEngine: 'indexeddb'
    };
  } catch (err: any) {
    console.warn('Fallback a localStorage per errore inizializzazione IndexedDB:', err);
    const legacy = readLegacyLocalStorageState();
    const fallbackData: LocalAppState = {
      ...currentHydratedDefaults,
      ...(legacy || {})
    };
    const mirrorMeta = readMirrorMetaFromLocalStorage();
    return {
      record: legacy
        ? {
            id: PRIMARY_STATE_KEY,
            schemaVersion: LOCAL_DB_SCHEMA_VERSION,
            revision: mirrorMeta?.revision || 1,
            updatedAt: mirrorMeta?.updatedAt || new Date().toISOString(),
            updatedAtMs: mirrorMeta?.updatedAtMs || Date.now(),
            contentHash: mirrorMeta?.contentHash || computeStateContentHash(fallbackData),
            data: fallbackData
          }
        : null,
      migratedFromLocalStorage: false,
      storageEngine: 'localstorage_fallback',
      warningMessage: err?.message || 'Database IndexedDB temporaneamente non accessibile: attivo salvataggio locale compatibile.'
    };
  }
};

// Coda sequenziale rigorosa per evitare race condition tra salvataggi ravvicinati
let pendingWriteChain: Promise<LocalDbWriteResult> = Promise.resolve({
  ok: true,
  storageEngine: 'indexeddb'
});
let latestQueuedWriteId = 0;

/**
 * Flush sincrono d'emergenza dello specchio localStorage (chiamabile su pagehide/beforeunload/visibilitychange)
 * con timestamp monotonico verificato, seguito da scrittura asincrona best-effort su IndexedDB.
 */
export const flushAppStateMirrorSync = (state: LocalAppState): LocalMirrorMeta => {
  const clonedState: LocalAppState = JSON.parse(JSON.stringify(state));
  const nowMs = nextMonotonicTimestampMs();
  const nowIso = new Date(nowMs).toISOString();
  const nextRevision = lastKnownRevision + 1;
  lastKnownRevision = nextRevision;
  const contentHash = computeStateContentHash(clonedState);

  const meta: LocalMirrorMeta = {
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    revision: nextRevision,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
    contentHash
  };

  mirrorStateToLocalStorage(clonedState, meta);
  return meta;
};

/**
 * Salva in modo atomico e verificato lo stato completo dell'applicazione:
 * 1. Scrive IMMEDIATAMENTE e SINCRONAMENTE lo specchio localStorage con timestamp e hash di integrità
 *    (protezione istantanea contro chiusure improvvise della scheda/browser).
 * 2. Accoda in modo sequenziale la transazione readwrite su IndexedDB (`magiclass_local_db`)
 *    con retry automatico su riconnessione e verifica attiva post-scrittura.
 * 3. Non maschera mai un fallimento di IndexedDB come successo silenzioso.
 */
export const saveAppStateToLocalDb = (state: LocalAppState): Promise<LocalDbWriteResult> => {
  const clonedState: LocalAppState = JSON.parse(JSON.stringify(state));
  const writeId = ++latestQueuedWriteId;

  const nowMs = nextMonotonicTimestampMs();
  const nowIso = new Date(nowMs).toISOString();
  const plannedRevision = lastKnownRevision + 1;
  lastKnownRevision = plannedRevision;
  const contentHash = computeStateContentHash(clonedState);

  const mirrorMeta: LocalMirrorMeta = {
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    revision: plannedRevision,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
    contentHash
  };

  // Passo 1: Scrittura sincrona immediata dello specchio di sicurezza (zero attesa microtask!)
  const lsResult = mirrorStateToLocalStorage(clonedState, mirrorMeta);

  const runWrite = async (): Promise<LocalDbWriteResult> => {
    // Se nel frattempo è stata accodata una scrittura ancora più recente, lascia che sia quella
    // a consolidare in IndexedDB per evitare scritture obsolete concorrenti.
    if (writeId < latestQueuedWriteId) {
      return {
        ok: true,
        revision: plannedRevision,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
        contentHash,
        verified: false,
        superseded: true,
        persistedInIndexedDb: false,
        persistedInLocalStorage: lsResult.ok,
        storageEngine: isIndexedDBAvailable() ? 'indexeddb' : 'localstorage_fallback'
      };
    }

    if (!isIndexedDBAvailable()) {
      if (!lsResult.ok) {
        return {
          ok: false,
          persistedInIndexedDb: false,
          persistedInLocalStorage: false,
          storageEngine: 'localstorage_fallback',
          errorCode: lsResult.quotaExceeded ? 'QUOTA_EXCEEDED' : 'WRITE_FAILED',
          errorMessage: lsResult.quotaExceeded
            ? 'Spazio di archiviazione del browser esaurito. Esporta un backup locale per mettere al sicuro i dati.'
            : 'Impossibile salvare i dati nell\'archiviazione locale del browser.'
        };
      }
      return {
        ok: true,
        revision: plannedRevision,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
        contentHash,
        verified: true,
        persistedInIndexedDb: false,
        persistedInLocalStorage: true,
        storageEngine: 'localstorage_fallback'
      };
    }

    const attemptIndexedDbWrite = async (): Promise<LocalDbWriteResult> => {
      const db = await openLocalDatabase();
      const existing = await readPrimaryStateFromDb(db);
      const nextRevision = Math.max((existing?.revision || 0) + 1, plannedRevision);
      lastKnownRevision = Math.max(lastKnownRevision, nextRevision);

      const record: StoredStateRecord = {
        id: PRIMARY_STATE_KEY,
        schemaVersion: LOCAL_DB_SCHEMA_VERSION,
        revision: nextRevision,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
        contentHash,
        data: clonedState
      };

      await writePrimaryStateToDb(db, record);

      // Verifica reale post-commit su IndexedDB
      const verified = await readPrimaryStateFromDb(db);
      const isVerified = Boolean(
        verified &&
        verified.data &&
        verified.revision >= nextRevision &&
        (verified.contentHash === contentHash || verified.revision > nextRevision)
      );

      if (!isVerified) {
        return {
          ok: false,
          revision: nextRevision,
          updatedAt: nowIso,
          updatedAtMs: nowMs,
          contentHash,
          verified: false,
          persistedInIndexedDb: false,
          persistedInLocalStorage: lsResult.ok,
          storageEngine: 'indexeddb',
          errorCode: 'VERIFY_FAILED',
          errorMessage: 'Verifica post-salvataggio nel database locale non confermata. Effettua un backup di sicurezza.'
        };
      }

      // Allinea la revisione finale nello specchio se incrementata rispetto a plannedRevision
      if (nextRevision !== plannedRevision && lsResult.ok) {
        writeMirrorMetaToLocalStorage({
          ...mirrorMeta,
          revision: nextRevision
        });
      }

      return {
        ok: true,
        revision: nextRevision,
        updatedAt: nowIso,
        updatedAtMs: nowMs,
        contentHash,
        verified: true,
        persistedInIndexedDb: true,
        persistedInLocalStorage: lsResult.ok,
        storageEngine: 'indexeddb'
      };
    };

    try {
      return await attemptIndexedDbWrite();
    } catch (firstErr: any) {
      // Retry automatico una volta su riconnessione (es. dopo chiusura connessione su sospensione scheda/mobile)
      const isQuotaFirst =
        firstErr?.name === 'QuotaExceededError' ||
        firstErr?.code === 22 ||
        String(firstErr?.message || '').toLowerCase().includes('quota');

      if (!isQuotaFirst) {
        dbPromise = null;
        try {
          return await attemptIndexedDbWrite();
        } catch (retryErr: any) {
          return buildWriteErrorResult(retryErr, lsResult.ok);
        }
      }

      return buildWriteErrorResult(firstErr, lsResult.ok);
    }
  };

  pendingWriteChain = pendingWriteChain.then(runWrite, runWrite);
  return pendingWriteChain;
};

const buildWriteErrorResult = (err: any, persistedInLocalStorage: boolean): LocalDbWriteResult => {
  const isQuota =
    err?.name === 'QuotaExceededError' ||
    err?.code === 22 ||
    String(err?.message || '').toLowerCase().includes('quota');

  if (isQuota) {
    return {
      ok: false,
      persistedInIndexedDb: false,
      persistedInLocalStorage,
      storageEngine: 'indexeddb',
      errorCode: 'QUOTA_EXCEEDED',
      errorMessage: 'Spazio di archiviazione locale esaurito sul dispositivo. Esporta subito un backup su disco.'
    };
  }

  return {
    ok: false,
    persistedInIndexedDb: false,
    persistedInLocalStorage,
    storageEngine: 'indexeddb',
    errorCode: 'WRITE_FAILED',
    errorMessage: persistedInLocalStorage
      ? `Database IndexedDB non raggiungibile (${err?.message || 'errore transazione'}). Copia temporanea salvata nel browser: verifica o esporta un backup.`
      : `Errore nel salvataggio locale: ${err?.message || 'operazione non riuscita'}.`
  };
};

/**
 * Attende il completamento di tutte le scritture pendenti in coda (utile per test e verifiche).
 */
export const waitForPendingLocalDbWrites = (): Promise<LocalDbWriteResult> => {
  return pendingWriteChain;
};

/**
 * Restituisce una stima dello spazio di archiviazione locale usato/disponibile, se supportato dal browser.
 */
export const getLocalStorageEstimate = async (): Promise<{ usageBytes: number; quotaBytes: number } | null> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number' && typeof est.quota === 'number') {
        return { usageBytes: est.usage, quotaBytes: est.quota };
      }
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Legge lo stato temporaneo della sessione UI dallo store separato `ui_session`
 * all'interno del database locale esistente (`magiclass_local_db`).
 * Non interferisce in alcun modo con i dati didattici permanenti (`app_state` e `snapshots`).
 */
export const loadUiSessionRecordFromLocalDb = async <T = unknown>(): Promise<T | null> => {
  if (!isIndexedDBAvailable()) return null;
  try {
    const db = await openLocalDatabase();
    if (!db.objectStoreNames.contains(STORE_UI_SESSION)) return null;
    return await new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_UI_SESSION, 'readonly');
        const store = tx.objectStore(STORE_UI_SESSION);
        const req = store.get(UI_SESSION_KEY);
        req.onsuccess = () => {
          const record = req.result as { id: string; payload?: T } | undefined;
          resolve(record && record.payload !== undefined ? record.payload : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
};

/**
 * Salva lo stato temporaneo della sessione UI nello store separato `ui_session`.
 */
export const saveUiSessionRecordToLocalDb = async <T>(payload: T): Promise<boolean> => {
  if (!isIndexedDBAvailable()) return false;
  try {
    const db = await openLocalDatabase();
    if (!db.objectStoreNames.contains(STORE_UI_SESSION)) return false;
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_UI_SESSION, 'readwrite');
        const store = tx.objectStore(STORE_UI_SESSION);
        store.put({
          id: UI_SESSION_KEY,
          payload
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
};

/**
 * Rimuove lo stato temporaneo della sessione UI dallo store `ui_session`.
 */
export const clearUiSessionRecordFromLocalDb = async (): Promise<boolean> => {
  if (!isIndexedDBAvailable()) return false;
  try {
    const db = await openLocalDatabase();
    if (!db.objectStoreNames.contains(STORE_UI_SESSION)) return false;
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_UI_SESSION, 'readwrite');
        const store = tx.objectStore(STORE_UI_SESSION);
        store.delete(UI_SESSION_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
};
