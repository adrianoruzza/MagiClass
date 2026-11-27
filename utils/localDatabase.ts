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
  data: LocalAppState;
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
  storageEngine: 'indexeddb' | 'localstorage_fallback';
  warningMessage?: string;
}

export interface LocalDbWriteResult {
  ok: boolean;
  revision?: number;
  updatedAt?: string;
  storageEngine: 'indexeddb' | 'localstorage_fallback';
  errorCode?: 'QUOTA_EXCEEDED' | 'IDB_UNAVAILABLE' | 'WRITE_FAILED';
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
 * per garantire una migrazione preventiva senza alcuna perdita di dati.
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
 * Specchia i dati essenziali in localStorage come copia secondaria di sicurezza
 * per avvio sincrono rapido e compatibilità con browser con limitazioni IndexedDB.
 */
export const mirrorStateToLocalStorage = (state: Partial<LocalAppState>): { ok: boolean; quotaExceeded?: boolean } => {
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

  return { ok: allOk, quotaExceeded: quotaHit };
};

let dbPromise: Promise<IDBDatabase> | null = null;

export const resetLocalDbConnectionForTests = (): void => {
  dbPromise = null;
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
    // Fallback in localStorage per rollback d'emergenza
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

/**
 * Inizializza il database locale IndexedDB, pulisce i residui cloud obsoleti
 * ed esegue una migrazione verificata e senza perdita dai dati `localStorage` preesistenti.
 */
export const initAndLoadLocalDatabase = async (
  currentHydratedDefaults: LocalAppState
): Promise<LocalDbInitResult> => {
  cleanupLegacyCloudArtifacts();

  if (!isIndexedDBAvailable()) {
    return {
      record: null,
      migratedFromLocalStorage: false,
      storageEngine: 'localstorage_fallback',
      warningMessage: 'IndexedDB non disponibile: utilizzo archiviazione locale compatibile (localStorage).'
    };
  }

  try {
    const db = await openLocalDatabase();
    const existingRecord = await readPrimaryStateFromDb(db);

    if (existingRecord && existingRecord.data) {
      return {
        record: existingRecord,
        migratedFromLocalStorage: false,
        storageEngine: 'indexeddb'
      };
    }

    // IndexedDB vuoto: verifica presenza dati legacy in localStorage e migra in modo verificato
    const legacyPartial = readLegacyLocalStorageState();
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

    const nowIso = new Date().toISOString();
    const initialRecord: StoredStateRecord = {
      id: PRIMARY_STATE_KEY,
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
      revision: 1,
      updatedAt: nowIso,
      data: mergedInitialState
    };

    await writePrimaryStateToDb(db, initialRecord);

    // Verifica attiva post-scrittura prima di confermare la migrazione
    const verified = await readPrimaryStateFromDb(db);
    if (!verified || !verified.data) {
      throw new Error('Verifica lettura post-migrazione fallita.');
    }

    return {
      record: verified,
      migratedFromLocalStorage: Boolean(legacyPartial),
      storageEngine: 'indexeddb'
    };
  } catch (err: any) {
    console.warn('Fallback a localStorage per errore inizializzazione IndexedDB:', err);
    return {
      record: null,
      migratedFromLocalStorage: false,
      storageEngine: 'localstorage_fallback',
      warningMessage: err?.message || 'Database IndexedDB temporaneamente non accessibile: attivo salvataggio locale compatibile.'
    };
  }
};

// Coda sequenziale per evitare race condition tra salvataggi ravvicinati
let pendingWriteChain: Promise<LocalDbWriteResult> = Promise.resolve({
  ok: true,
  storageEngine: 'indexeddb'
});

/**
 * Salva in modo atomico lo stato completo dell'applicazione in IndexedDB
 * e aggiorna la copia speculare di sicurezza in localStorage.
 */
export const saveAppStateToLocalDb = (state: LocalAppState): Promise<LocalDbWriteResult> => {
  const clonedState: LocalAppState = JSON.parse(JSON.stringify(state));

  const runWrite = async (): Promise<LocalDbWriteResult> => {
    const lsResult = mirrorStateToLocalStorage(clonedState);

    if (!isIndexedDBAvailable()) {
      if (!lsResult.ok) {
        return {
          ok: false,
          storageEngine: 'localstorage_fallback',
          errorCode: lsResult.quotaExceeded ? 'QUOTA_EXCEEDED' : 'WRITE_FAILED',
          errorMessage: lsResult.quotaExceeded
            ? 'Spazio di archiviazione del browser esaurito. Esporta un backup locale per mettere al sicuro i dati.'
            : 'Impossibile salvare i dati nell\'archiviazione locale del browser.'
        };
      }
      return {
        ok: true,
        updatedAt: new Date().toISOString(),
        storageEngine: 'localstorage_fallback'
      };
    }

    try {
      const db = await openLocalDatabase();
      const existing = await readPrimaryStateFromDb(db);
      const nextRevision = (existing?.revision || 0) + 1;
      const nowIso = new Date().toISOString();

      const record: StoredStateRecord = {
        id: PRIMARY_STATE_KEY,
        schemaVersion: LOCAL_DB_SCHEMA_VERSION,
        revision: nextRevision,
        updatedAt: nowIso,
        data: clonedState
      };

      await writePrimaryStateToDb(db, record);

      return {
        ok: true,
        revision: nextRevision,
        updatedAt: nowIso,
        storageEngine: 'indexeddb'
      };
    } catch (err: any) {
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.code === 22 ||
        String(err?.message || '').toLowerCase().includes('quota');

      if (isQuota) {
        return {
          ok: false,
          storageEngine: 'indexeddb',
          errorCode: 'QUOTA_EXCEEDED',
          errorMessage: 'Spazio di archiviazione locale esaurito sul dispositivo. Esporta subito un backup su disco.'
        };
      }

      if (lsResult.ok) {
        return {
          ok: true,
          updatedAt: new Date().toISOString(),
          storageEngine: 'localstorage_fallback',
          warningMessage: undefined
        } as LocalDbWriteResult;
      }

      return {
        ok: false,
        storageEngine: 'indexeddb',
        errorCode: 'WRITE_FAILED',
        errorMessage: `Errore nel salvataggio locale: ${err?.message || 'operazione non riuscita'}.`
      };
    }
  };

  pendingWriteChain = pendingWriteChain.then(runWrite, runWrite);
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

