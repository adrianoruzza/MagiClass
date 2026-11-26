import { 
  SchoolYear, 
  Lesson, 
  LessonNote, 
  SpecialDay, 
  SchoolClosure, 
  ProvisionalSchedulePeriod, 
  ClassEntity, 
  Subject, 
  TaskTemplate, 
  LinkedSubjectGroup, 
  Recess 
} from '../types';

import {
  computeBackupChecksum,
  MAX_SUPPORTED_SCHEMA_MAJOR
} from './deviceBackup';

export type BackupIntegrityStatus = 'verified' | 'tampered' | 'legacy_unverified';

export interface BackupVerificationResult {
  isCompatible: boolean;
  integrityStatus: BackupIntegrityStatus;
  schemaVersion: string;
  errorMessage?: string;
}

export interface DetectedYearSummary {
  id: string; // ID original in backup
  label: string; // e.g. "2025/2026"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  splitDate: string; // YYYY-MM-DD
  isSixDayWeek: boolean;
  closures: SchoolClosure[];
  lessonsCount: number;
  notesCount: number;
  specialDaysCount: number;
  closuresCount: number;
  provisionalPeriodsCount: number;
  classesCount: number;
  subjectsCount: number;
  taskTemplatesCount: number;
  // Confronto con stato attuale dell'app
  matchesExistingYearId?: string;
  matchesExistingYearLabel?: string;
  isCurrentActiveYear: boolean;
  // Configurazione intervalli orari associata all'anno nel backup
  timeSlots?: Record<number, string>;
  durations?: Record<number, number>;
  recesses?: Recess[];
  maxHours?: number;
}

export interface BackupInspectionResult {
  isValid: boolean;
  errorMessage?: string;
  detectedYears: DetectedYearSummary[];
  currentActiveYear?: SchoolYear;
  backupTimestamp?: string | null;
  schemaVersion?: string;
  integrityStatus?: BackupIntegrityStatus;
}

/**
 * Verifica compatibilità di versione e integrità crittografica (SHA-256) di un file di backup
 * prima di consentirne il ripristino. Mantiene piena retrocompatibilità con i backup classici.
 */
export const verifyBackupIntegrity = async (backupJson: any): Promise<BackupVerificationResult> => {
  if (!backupJson || typeof backupJson !== 'object' || Array.isArray(backupJson)) {
    return {
      isCompatible: false,
      integrityStatus: 'tampered',
      schemaVersion: 'unknown',
      errorMessage: 'Il file di backup non è un oggetto JSON valido.'
    };
  }

  const rawSchema = typeof backupJson.schemaVersion === 'string' ? backupJson.schemaVersion.trim() : '1.0';
  const majorMatch = rawSchema.match(/^(\d+)/);
  const majorNum = majorMatch ? parseInt(majorMatch[1], 10) : 1;

  if (majorNum > MAX_SUPPORTED_SCHEMA_MAJOR) {
    return {
      isCompatible: false,
      integrityStatus: 'legacy_unverified',
      schemaVersion: rawSchema,
      errorMessage: `Questo backup richiede una versione più recente di MagiClass (schema v${rawSchema}, supportato fino a v${MAX_SUPPORTED_SCHEMA_MAJOR}.x).`
    };
  }

  if (typeof backupJson.integrityChecksum === 'string' && backupJson.integrityChecksum.trim().length > 0) {
    const expected = backupJson.integrityChecksum.trim().toLowerCase();
    const computed = (await computeBackupChecksum(backupJson)).toLowerCase();
    if (computed !== expected) {
      return {
        isCompatible: false,
        integrityStatus: 'tampered',
        schemaVersion: rawSchema,
        errorMessage: 'Verifica di integrità fallita: il file di backup risulta danneggiato o modificato manualmente. Ripristino bloccato per proteggere i dati.'
      };
    }
    return {
      isCompatible: true,
      integrityStatus: 'verified',
      schemaVersion: rawSchema
    };
  }

  return {
    isCompatible: true,
    integrityStatus: 'legacy_unverified',
    schemaVersion: rawSchema
  };
};

export interface RestoreParams {
  backupJson: any;
  targetYearSummary: DetectedYearSummary;
  currentState: {
    schoolYears: SchoolYear[];
    schedule: Lesson[];
    lessonNotes: LessonNote[];
    specialDays: SpecialDay[];
    schoolClosures: SchoolClosure[];
    provisionalPeriods: ProvisionalSchedulePeriod[];
    classes: ClassEntity[];
    subjects: Subject[];
    taskTemplates: TaskTemplate[];
    linkedSubjectGroups: LinkedSubjectGroup[];
    timeSlots: Record<number, string>;
    durations: Record<number, number>;
    recesses: Recess[];
    maxHours: number;
    currentDate: Date;
  };
}

export interface RestoreResult {
  newState: {
    schoolYears: SchoolYear[];
    schedule: Lesson[];
    lessonNotes: LessonNote[];
    specialDays: SpecialDay[];
    schoolClosures: SchoolClosure[];
    provisionalPeriods: ProvisionalSchedulePeriod[];
    classes: ClassEntity[];
    subjects: Subject[];
    taskTemplates: TaskTemplate[];
    linkedSubjectGroups: LinkedSubjectGroup[];
    timeSlots: Record<number, string>;
    durations: Record<number, number>;
    recesses: Recess[];
    maxHours: number;
  };
  restoredYearLabel: string;
  targetSchoolYearId: string;
  stats: {
    lessonsRestored: number;
    notesRestored: number;
    specialDaysRestored: number;
    closuresRestored: number;
    provisionalPeriodsRestored: number;
    classesRestored: number;
    subjectsRestored: number;
    taskTemplatesRestored: number;
  };
}

const getLocalDateStr = (d?: Date): string => {
  const safeDate = (d && d instanceof Date && !isNaN(d.getTime())) ? d : new Date();
  const y = safeDate.getFullYear();
  const m = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseMinutesFromTimeStr = (timeStr: string): number | null => {
  const match = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const normalizeTimeSlotsRecord = (raw: any): Record<number, string> | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<number, string> = {};
  let count = 0;
  for (const [key, val] of Object.entries(raw)) {
    const hourNum = Number(key);
    if (!Number.isInteger(hourNum) || hourNum < 1 || hourNum > 24) continue;
    if (typeof val === 'string' && val.trim().length > 0) {
      result[hourNum] = val.trim();
      count++;
    }
  }
  return count > 0 ? result : undefined;
};

const deriveDurationsFromTimeSlots = (slots: Record<number, string>): Record<number, number> | undefined => {
  const derived: Record<number, number> = {};
  let count = 0;
  for (const [key, val] of Object.entries(slots)) {
    const hourNum = Number(key);
    if (!Number.isInteger(hourNum) || hourNum < 1 || hourNum > 24) continue;
    const parts = val.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const startMin = parseMinutesFromTimeStr(parts[0]);
      const endMin = parseMinutesFromTimeStr(parts[1]);
      if (startMin !== null && endMin !== null && endMin > startMin) {
        derived[hourNum] = endMin - startMin;
        count++;
      }
    }
  }
  return count > 0 ? derived : undefined;
};

const normalizeDurationsRecord = (
  raw: any,
  fallbackSlots?: Record<number, string>
): Record<number, number> | undefined => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const result: Record<number, number> = {};
    let count = 0;
    for (const [key, val] of Object.entries(raw)) {
      const hourNum = Number(key);
      const durNum = Number(val);
      if (!Number.isInteger(hourNum) || hourNum < 1 || hourNum > 24) continue;
      if (!isNaN(durNum) && durNum > 0 && durNum <= 300) {
        result[hourNum] = durNum;
        count++;
      }
    }
    if (count > 0) return result;
  }
  if (fallbackSlots) {
    return deriveDurationsFromTimeSlots(fallbackSlots);
  }
  return undefined;
};

const normalizeRecessesList = (raw: any): Recess[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((r: any) => r && typeof r.afterHour === 'number' && typeof r.duration === 'number')
    .map((r: any) => ({
      id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
      afterHour: r.afterHour,
      duration: r.duration,
      associatedHour: r.associatedHour !== undefined ? r.associatedHour : null
    }));
};

const normalizeMaxHoursValue = (raw: any): number | undefined => {
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 1 && num <= 12) return num;
  return undefined;
};

export const normalizeYearLabel = (label: string): string => {
  if (!label) return '';
  const digits = label.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}/${digits.slice(4, 8)}`;
  }
  return label.replace('-', '/').trim();
};

export const doSchoolYearsMatch = (
  y1: { startDate?: string; endDate?: string; label?: string },
  y2: { startDate?: string; endDate?: string; label?: string }
): boolean => {
  if (!y1 || !y2) return false;

  // 1. Confronto anno iniziale da startDate (es. "2025")
  if (y1.startDate && y2.startDate) {
    const start1 = y1.startDate.slice(0, 4);
    const start2 = y2.startDate.slice(0, 4);
    if (start1 === start2) return true;
  }

  // 2. Confronto etichetta normalizzata (es. "2025/2026" vs "2025-2026")
  if (y1.label && y2.label) {
    const l1 = y1.label.replace(/[^0-9]/g, '');
    const l2 = y2.label.replace(/[^0-9]/g, '');
    if (l1 && l2 && l1 === l2) return true;
  }

  // 3. Sovrapposizione intervallo date
  if (y1.startDate && y1.endDate && y2.startDate && y2.endDate) {
    if (y1.startDate <= y2.endDate && y1.endDate >= y2.startDate) {
      return true;
    }
  }

  return false;
};

/**
 * Estrae la data e l'ora effettive del backup analizzando sia i metadati
 * interni al JSON (exportedAt, createdAt, timestamp, date, metadata) sia il nome del file.
 * Restituisce una stringa timestamp ISO / locale valida, oppure null se nessun metadato temporale è presente.
 */
export const extractBackupTimestamp = (backupJson: any, fileName?: string): string | null => {
  if (!backupJson || typeof backupJson !== 'object') {
    return null;
  }

  const tryParseDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return trimmed;
      }
    } else if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    } else if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString();
    }
    return null;
  };

  // 1. Campi radice del JSON
  const rootKeys = [
    'exportedAt',
    'createdAt',
    'exportTimestamp',
    'backupTimestamp',
    'backupDate',
    'timestamp',
    'exportDate',
    'date'
  ];

  for (const k of rootKeys) {
    const res = tryParseDate(backupJson[k]);
    if (res) return res;
  }

  // 2. Metadati annidati in metadata / info / header
  const nestedObjects = [backupJson.metadata, backupJson.info, backupJson.header];
  for (const obj of nestedObjects) {
    if (obj && typeof obj === 'object') {
      for (const k of rootKeys) {
        const res = tryParseDate(obj[k]);
        if (res) return res;
      }
    }
  }

  // 3. Estrazione dal nome del file se fornito (es. backup_magiclass_2026-10-26_131400.json)
  if (fileName && typeof fileName === 'string') {
    const pad = (n: number) => String(n).padStart(2, '0');
    // Pattern YYYY-MM-DD seguito da HHmm o HHmmss
    const fullMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})[_\sT](\d{2})[-.:]?(\d{2})[-.:]?(\d{2})?/);
    if (fullMatch) {
      const year = parseInt(fullMatch[1], 10);
      const month = parseInt(fullMatch[2], 10);
      const day = parseInt(fullMatch[3], 10);
      const hour = parseInt(fullMatch[4], 10);
      const min = parseInt(fullMatch[5], 10);
      const sec = fullMatch[6] ? parseInt(fullMatch[6], 10) : 0;

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
        return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}`;
      }
    }

    // Pattern solo data YYYY-MM-DD
    const dateOnlyMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const year = parseInt(dateOnlyMatch[1], 10);
      const month = parseInt(dateOnlyMatch[2], 10);
      const day = parseInt(dateOnlyMatch[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${pad(month)}-${pad(day)}T12:00:00`;
      }
    }
  }

  return null;
};

/**
 * Analizza il file JSON di backup ed estrae tutti gli anni scolastici presenti,
 * calcolando per ciascuno quante lezioni, note, giorni speciali e chiusure contiene,
 * ed evidenziando la corrispondenza con gli anni già presenti nell'applicazione.
 */
export const inspectBackupData = (
  json: any,
  currentSchoolYears: SchoolYear[] = [],
  currentDate: Date = new Date(),
  fileName?: string
): BackupInspectionResult => {
  const backupTimestamp = extractBackupTimestamp(json, fileName);

  if (!json || typeof json !== 'object') {
    return {
      isValid: false,
      errorMessage: 'Il file selezionato non è un oggetto JSON valido.',
      detectedYears: [],
      backupTimestamp
    };
  }

  const currentDateStr = getLocalDateStr(currentDate);
  const safeSchoolYears = Array.isArray(currentSchoolYears) ? currentSchoolYears : [];
  const currentActiveYear = safeSchoolYears.find(
    y => currentDateStr >= y.startDate && currentDateStr <= y.endDate
  ) || safeSchoolYears[0];

  const candidateYears: Array<{
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
  }> = [];

  // 1. Controllo se json.schoolYears esiste ed è popolato
  if (Array.isArray(json.schoolYears) && json.schoolYears.length > 0) {
    for (const sy of json.schoolYears) {
      if (sy && sy.startDate && sy.endDate) {
        const startStr = sy.startDate.slice(0, 10);
        const endStr = sy.endDate.slice(0, 10);
        const splitStr = sy.splitDate ? sy.splitDate.slice(0, 10) : `${startStr.slice(0, 4)}-01-31`;
        const startYearNum = parseInt(startStr.slice(0, 4), 10) || 2025;
        const defaultLabel = `${startYearNum}/${startYearNum + 1}`;
        const normSlots = normalizeTimeSlotsRecord(sy.timeSlots) || normalizeTimeSlotsRecord(json.timeSlots);
        const normDurations = normalizeDurationsRecord(sy.durations, normSlots) || normalizeDurationsRecord(json.durations, normSlots);
        const normRecesses = normalizeRecessesList(sy.recesses) ?? normalizeRecessesList(json.recesses);
        const normMaxHours = normalizeMaxHoursValue(sy.maxHours) ?? normalizeMaxHoursValue(json.maxHours);

        candidateYears.push({
          id: sy.id || crypto.randomUUID(),
          label: sy.label ? normalizeYearLabel(sy.label) : defaultLabel,
          startDate: startStr,
          endDate: endStr,
          splitDate: splitStr,
          isSixDayWeek: sy.isSixDayWeek ?? (json.isSixDayWeek ?? false),
          closures: Array.isArray(sy.closures) ? sy.closures : (Array.isArray(json.schoolClosures) ? json.schoolClosures : []),
          timeSlots: normSlots,
          durations: normDurations,
          recesses: normRecesses,
          maxHours: normMaxHours
        });
      }
    }
  }

  // 2. Se non presente in schoolYears, controlla le date a livello root
  if (candidateYears.length === 0 && (json.schoolStartDate || json.schoolEndDate)) {
    try {
      const sDate = new Date(json.schoolStartDate);
      const eDate = json.schoolEndDate ? new Date(json.schoolEndDate) : new Date(sDate.getFullYear() + 1, 5, 15);
      const startStr = getLocalDateStr(sDate);
      const endStr = getLocalDateStr(eDate);
      const startYearNum = sDate.getFullYear();
      const splitStr = json.semesterSplitDate ? getLocalDateStr(new Date(json.semesterSplitDate)) : `${startYearNum + 1}-01-31`;
      const label = `${startYearNum}/${startYearNum + 1}`;

      const rootSlots = normalizeTimeSlotsRecord(json.timeSlots);
      candidateYears.push({
        id: crypto.randomUUID(),
        label,
        startDate: startStr,
        endDate: endStr,
        splitDate: splitStr,
        isSixDayWeek: json.isSixDayWeek ?? false,
        closures: Array.isArray(json.schoolClosures) ? json.schoolClosures : [],
        timeSlots: rootSlots,
        durations: normalizeDurationsRecord(json.durations, rootSlots),
        recesses: normalizeRecessesList(json.recesses),
        maxHours: normalizeMaxHoursValue(json.maxHours)
      });
    } catch (e) {
      // ignore
    }
  }

  // 3. Se ancora non trovato, deduci dalle note o dalle lezioni
  if (candidateYears.length === 0) {
    const allDates: string[] = [];
    if (Array.isArray(json.lessonNotes)) {
      json.lessonNotes.forEach((n: any) => { if (n?.date && typeof n.date === 'string') allDates.push(n.date.slice(0, 10)); });
    }
    if (Array.isArray(json.specialDays)) {
      json.specialDays.forEach((sd: any) => { if (sd?.date && typeof sd.date === 'string') allDates.push(sd.date.slice(0, 10)); });
    }

    if (allDates.length > 0) {
      allDates.sort();
      const firstDate = allDates[0];
      const firstYear = parseInt(firstDate.slice(0, 4), 10);
      const firstMonth = parseInt(firstDate.slice(5, 7), 10);
      const startYear = firstMonth < 8 ? firstYear - 1 : firstYear;
      const endYear = startYear + 1;
      const label = `${startYear}/${endYear}`;
      const rootSlots = normalizeTimeSlotsRecord(json.timeSlots);
      candidateYears.push({
        id: crypto.randomUUID(),
        label,
        startDate: `${startYear}-09-11`,
        endDate: `${endYear}-06-15`,
        splitDate: `${endYear}-01-31`,
        isSixDayWeek: json.isSixDayWeek ?? false,
        closures: Array.isArray(json.schoolClosures) ? json.schoolClosures : [],
        timeSlots: rootSlots,
        durations: normalizeDurationsRecord(json.durations, rootSlots),
        recesses: normalizeRecessesList(json.recesses),
        maxHours: normalizeMaxHoursValue(json.maxHours)
      });
    }
  }

  if (candidateYears.length === 0) {
    return {
      isValid: false,
      errorMessage: "Impossibile identificare l'anno scolastico all'interno del backup fornito. Verifica che il file sia valido.",
      detectedYears: []
    };
  }

  const rawSchedule: Lesson[] = Array.isArray(json.schedule) ? json.schedule : [];
  const rawNotes: LessonNote[] = Array.isArray(json.lessonNotes) ? json.lessonNotes : [];
  const rawSpecialDays: SpecialDay[] = Array.isArray(json.specialDays) ? json.specialDays : [];
  const rawProvisional: ProvisionalSchedulePeriod[] = Array.isArray(json.provisionalPeriods) ? json.provisionalPeriods : [];
  const rawClasses: ClassEntity[] = Array.isArray(json.classes) ? json.classes : [];
  const rawSubjects: Subject[] = Array.isArray(json.subjects) ? json.subjects : [];
  const rawTemplates: TaskTemplate[] = Array.isArray(json.taskTemplates) ? json.taskTemplates : [];

  const detectedYears: DetectedYearSummary[] = candidateYears.map(cand => {
    // Conta le note che cadono nell'intervallo dell'anno
    const yearNotes = rawNotes.filter(n => {
      if (!n || !n.date) return false;
      const d = n.date.slice(0, 10);
      return d >= cand.startDate && d <= cand.endDate;
    });

    // Conta lezioni
    const yearLessons = rawSchedule.filter(l => {
      if (!l) return false;
      if (candidateYears.length === 1) return true;
      if (l.schoolYearId && l.schoolYearId === cand.id) return true;
      if (l.weekStart) {
        return l.weekStart >= cand.startDate && l.weekStart <= cand.endDate;
      }
      return true;
    });

    // Conta giorni speciali
    const yearSpecialDays = rawSpecialDays.filter(sd => {
      if (!sd || !sd.date) return false;
      const d = sd.date.slice(0, 10);
      return d >= cand.startDate && d <= cand.endDate;
    });

    // Conta provvisorio
    const yearProvisional = rawProvisional.filter(p => {
      if (!p || !p.startDate || !p.endDate) return false;
      return p.startDate <= cand.endDate && p.endDate >= cand.startDate;
    });

    // Corrispondenza con anni esistenti nell'app
    const matchedExisting = currentSchoolYears.find(ey => doSchoolYearsMatch(ey, cand));
    const isCurrentActive = matchedExisting && currentActiveYear
      ? matchedExisting.id === currentActiveYear.id
      : false;

    return {
      id: cand.id,
      label: cand.label,
      startDate: cand.startDate,
      endDate: cand.endDate,
      splitDate: cand.splitDate,
      isSixDayWeek: cand.isSixDayWeek,
      closures: cand.closures,
      lessonsCount: yearLessons.length,
      notesCount: yearNotes.length,
      specialDaysCount: yearSpecialDays.length,
      closuresCount: cand.closures.length,
      provisionalPeriodsCount: yearProvisional.length,
      classesCount: rawClasses.length,
      subjectsCount: rawSubjects.length,
      taskTemplatesCount: rawTemplates.length,
      matchesExistingYearId: matchedExisting?.id,
      matchesExistingYearLabel: matchedExisting?.label,
      isCurrentActiveYear: isCurrentActive,
      timeSlots: cand.timeSlots,
      durations: cand.durations,
      recesses: cand.recesses,
      maxHours: cand.maxHours
    };
  });

  return {
    isValid: true,
    detectedYears,
    currentActiveYear,
    backupTimestamp
  };
};

/**
 * Esegue il ripristino SELETTIVO dei dati per il solo anno scolastico indicato da targetYearSummary.
 * 
 * GARANZIE DI PROTEZIONE:
 * 1. Tutti i dati degli altri anni (es. 2026-2027) sono isolati e rimangono IDENTICI a prima del ripristino.
 * 2. Gli ID delle lezioni/classi/materie del backup vengono rimappati se entrano in collisione con gli ID dell'anno protetto.
 * 3. Le note, i giorni speciali e i periodi provvisori vengono filtrati rigorosamente per data.
 * 4. La configurazione globale dell'anno attualmente in uso non viene sovrascritta.
 */
export const performSelectiveRestore = (params: RestoreParams): RestoreResult => {
  const { backupJson, targetYearSummary, currentState } = params;

  // 1. RISOLUZIONE TARGET SCHOOL YEAR
  // Identifica se l'anno da ripristinare corrisponde a un anno già esistente nell'app
  const existingYears = [...currentState.schoolYears];
  const matchedExistingYear = existingYears.find(y => doSchoolYearsMatch(y, targetYearSummary));

  let targetSchoolYearId: string;
  let updatedSchoolYears: SchoolYear[];

  // Configurazione orario proveniente dal backup per l'anno di destinazione
  const matchedBackupYear = Array.isArray(backupJson.schoolYears)
    ? (backupJson.schoolYears.find((sy: any) => sy && (sy.id === targetYearSummary.id || doSchoolYearsMatch(sy, targetYearSummary))) || undefined)
    : undefined;

  const backupTimeSlots =
    normalizeTimeSlotsRecord(targetYearSummary.timeSlots) ||
    normalizeTimeSlotsRecord(matchedBackupYear?.timeSlots) ||
    normalizeTimeSlotsRecord(backupJson.timeSlots);

  const backupDurations =
    normalizeDurationsRecord(targetYearSummary.durations, backupTimeSlots) ||
    normalizeDurationsRecord(matchedBackupYear?.durations, backupTimeSlots) ||
    normalizeDurationsRecord(backupJson.durations, backupTimeSlots);

  const backupRecesses =
    normalizeRecessesList(targetYearSummary.recesses) ??
    normalizeRecessesList(matchedBackupYear?.recesses) ??
    normalizeRecessesList(backupJson.recesses);

  const backupMaxHours =
    normalizeMaxHoursValue(targetYearSummary.maxHours) ??
    normalizeMaxHoursValue(matchedBackupYear?.maxHours) ??
    normalizeMaxHoursValue(backupJson.maxHours);

  if (matchedExistingYear) {
    targetSchoolYearId = matchedExistingYear.id;
    // Aggiorna solo l'anno corrispondente, preservando il suo ID e proteggendo tutti gli altri anni
    updatedSchoolYears = existingYears.map(y => {
      if (y.id === matchedExistingYear.id) {
        return {
          ...y,
          label: targetYearSummary.label || y.label,
          startDate: targetYearSummary.startDate,
          endDate: targetYearSummary.endDate,
          splitDate: targetYearSummary.splitDate,
          isSixDayWeek: targetYearSummary.isSixDayWeek,
          closures: targetYearSummary.closures || [],
          timeSlots: backupTimeSlots || y.timeSlots,
          durations: backupDurations || y.durations,
          recesses: backupRecesses !== undefined ? backupRecesses : y.recesses,
          maxHours: backupMaxHours || y.maxHours
        };
      }
      return y;
    });
  } else {
    // Non esiste ancora nell'app: crea il nuovo anno per 2025-2026
    // Assicurati che l'ID non entri in collisione con un anno esistente
    const collision = existingYears.some(y => y.id === targetYearSummary.id);
    targetSchoolYearId = collision ? crypto.randomUUID() : targetYearSummary.id;

    const newYear: SchoolYear = {
      id: targetSchoolYearId,
      label: targetYearSummary.label,
      startDate: targetYearSummary.startDate,
      endDate: targetYearSummary.endDate,
      splitDate: targetYearSummary.splitDate,
      isSixDayWeek: targetYearSummary.isSixDayWeek,
      closures: targetYearSummary.closures || [],
      timeSlots: backupTimeSlots,
      durations: backupDurations,
      recesses: backupRecesses,
      maxHours: backupMaxHours
    };

    // Ordina gli anni cronologicamente
    updatedSchoolYears = [...existingYears, newYear].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  // 2. ISOLAMENTO LEZIONI ESISTENTI (ANNO PROTETTO, ES. 2026-2027)
  // Assicurati che tutte le lezioni esistenti di altri anni abbiano schoolYearId assegnato esplicitamente
  // e conservale intatte al 100%!
  const protectedExistingSchedule: Lesson[] = [];
  currentState.schedule.forEach(l => {
    // Se la lezione appartiene già all'anno che stiamo sostituendo, scartala (verrà sostituita dal backup)
    if (l.schoolYearId && l.schoolYearId === targetSchoolYearId) {
      return;
    }
    // Se la lezione appartiene a un altro anno esplicito, conservala intatta
    if (l.schoolYearId && l.schoolYearId !== targetSchoolYearId) {
      protectedExistingSchedule.push(l);
      return;
    }
    // Se non ha schoolYearId, deduci se appartiene all'anno target o a quello protetto
    if (l.weekStart && l.weekStart >= targetYearSummary.startDate && l.weekStart <= targetYearSummary.endDate) {
      return; // appartiene al target
    }
    // Appartiene agli altri anni (es. anno corrente)
    const otherYear = existingYears.find(y => y.id !== targetSchoolYearId) || existingYears[0];
    protectedExistingSchedule.push({
      ...l,
      schoolYearId: otherYear ? otherYear.id : l.schoolYearId
    });
  });

  // 3. ESTRAZIONE E MAPPATURA LEZIONI DAL BACKUP (2025-2026)
  const rawIncomingSchedule: Lesson[] = Array.isArray(backupJson.schedule) ? backupJson.schedule : [];
  const hasMultipleYearsInBackup = Array.isArray(backupJson.schoolYears) && backupJson.schoolYears.length > 1;

  const targetIncomingLessons = rawIncomingSchedule.filter(l => {
    if (!l) return false;
    if (hasMultipleYearsInBackup) {
      if (l.schoolYearId && l.schoolYearId === targetYearSummary.id) return true;
      if (l.weekStart) {
        return l.weekStart >= targetYearSummary.startDate && l.weekStart <= targetYearSummary.endDate;
      }
      return false;
    }
    return true;
  });

  // PREVENZIONE TOTALE COLLISIONE ID:
  // Se un ID lezione del backup coincide con una lezione protetta (es. 2026-2027),
  // rimappa l'ID della lezione del 2025-2026 e aggiorna le relative note del 2025-2026.
  const protectedLessonIds = new Set(protectedExistingSchedule.map(l => l.id));
  const lessonIdRemap = new Map<string, string>();

  targetIncomingLessons.forEach(l => {
    if (protectedLessonIds.has(l.id)) {
      const newId = crypto.randomUUID();
      lessonIdRemap.set(l.id, newId);
    }
  });

  const restoredLessons: Lesson[] = targetIncomingLessons.map(l => {
    const finalId = lessonIdRemap.get(l.id) || l.id;
    return {
      ...l,
      id: finalId,
      schoolYearId: targetSchoolYearId
    };
  });

  const newFullSchedule = [...protectedExistingSchedule, ...restoredLessons];

  // 4. ISOLAMENTO E SOSTITUZIONE NOTE (CONTROLLARE, FARE, VARIE, VOTI)
  // Conserva tutte le note che NON cadono nell'intervallo dell'anno target (es. tutto il 2026-2027 resta intatto)
  const protectedNotes = currentState.lessonNotes.filter(n => {
    if (!n || !n.date) return true;
    const d = n.date.slice(0, 10);
    return d < targetYearSummary.startDate || d > targetYearSummary.endDate;
  });

  // Estrai dal backup solo le note dell'anno target
  const rawIncomingNotes: LessonNote[] = Array.isArray(backupJson.lessonNotes) ? backupJson.lessonNotes : [];
  const targetIncomingNotes = rawIncomingNotes.filter(n => {
    if (!n || !n.date) return false;
    const d = n.date.slice(0, 10);
    return d >= targetYearSummary.startDate && d <= targetYearSummary.endDate;
  });

  // Applica il rimappaggio di lessonId per le note del backup in caso di collisione
  const restoredNotes: LessonNote[] = targetIncomingNotes.map(n => {
    const mappedLessonId = lessonIdRemap.get(n.lessonId) || n.lessonId;
    return {
      ...n,
      lessonId: mappedLessonId
    };
  });

  const newFullNotes = [...protectedNotes, ...restoredNotes];

  // 5. GIORNI SPECIALI (ASSEMBLEE, PERMESSI, ECC.)
  const protectedSpecialDays = currentState.specialDays.filter(sd => {
    if (!sd || !sd.date) return true;
    const d = sd.date.slice(0, 10);
    return d < targetYearSummary.startDate || d > targetYearSummary.endDate;
  });

  const rawIncomingSpecialDays: SpecialDay[] = Array.isArray(backupJson.specialDays) ? backupJson.specialDays : [];
  const targetIncomingSpecialDays = rawIncomingSpecialDays.filter(sd => {
    if (!sd || !sd.date) return false;
    const d = sd.date.slice(0, 10);
    return d >= targetYearSummary.startDate && d <= targetYearSummary.endDate;
  });

  const newFullSpecialDays = [...protectedSpecialDays, ...targetIncomingSpecialDays];

  // 6. PERIODI DI ORARIO PROVVISORIO
  const protectedProvisional = (currentState.provisionalPeriods || []).filter(p => {
    if (!p || !p.startDate || !p.endDate) return true;
    return p.endDate < targetYearSummary.startDate || p.startDate > targetYearSummary.endDate;
  });

  const rawIncomingProvisional: ProvisionalSchedulePeriod[] = Array.isArray(backupJson.provisionalPeriods) ? backupJson.provisionalPeriods : [];
  const targetIncomingProvisional = rawIncomingProvisional.filter(p => {
    if (!p || !p.startDate || !p.endDate) return false;
    return p.startDate <= targetYearSummary.endDate && p.endDate >= targetYearSummary.startDate;
  });

  // Evita collisione ID su periodi provvisori e normalizza i relativi intervalli orari personalizzati
  const protectedProvIds = new Set(protectedProvisional.map(p => p.id));
  const provIdRemap = new Map<string, string>();
  const restoredProvisional: ProvisionalSchedulePeriod[] = targetIncomingProvisional.map(p => {
    const newId = protectedProvIds.has(p.id) ? crypto.randomUUID() : p.id;
    if (newId !== p.id) {
      provIdRemap.set(p.id, newId);
    }
    const normalizedPeriodSlots = normalizeTimeSlotsRecord(p.timeSlots);
    return {
      ...p,
      id: newId,
      schoolYearId: p.schoolYearId ? targetSchoolYearId : p.schoolYearId,
      timeSlots: normalizedPeriodSlots
    };
  });

  if (provIdRemap.size > 0) {
    for (let i = 0; i < restoredLessons.length; i++) {
      const pid = restoredLessons[i].periodId;
      if (pid && provIdRemap.has(pid)) {
        restoredLessons[i] = { ...restoredLessons[i], periodId: provIdRemap.get(pid) };
      }
    }
  }

  const newFullProvisional = [...protectedProvisional, ...restoredProvisional];

  // 7. GESTIONE CLASSI E MATERIE (ISOLAMENTO PER ANNO SCOLASTICO)
  // Per proteggere le classi e le materie degli altri anni:
  // Se stiamo ripristinando l'anno corrente attivo, sostituisci le classi/materie correnti.
  // Se appartengono esplicitamente ad altri anni, conservale intatte.
  const activeYearForCurrentDate = currentState.schoolYears.find(
    y => getLocalDateStr(currentState.currentDate) >= y.startDate && getLocalDateStr(currentState.currentDate) <= y.endDate
  ) || currentState.schoolYears[0];

  const isTargetActiveYear = !!(matchedExistingYear && activeYearForCurrentDate && matchedExistingYear.id === activeYearForCurrentDate.id);

  const protectedClasses: ClassEntity[] = currentState.classes
    .filter(c => {
      if (c.schoolYearId && c.schoolYearId === targetSchoolYearId) return false;
      if (!c.schoolYearId && isTargetActiveYear) return false;
      return true;
    })
    .map(c => ({
      ...c,
      schoolYearId: c.schoolYearId || (activeYearForCurrentDate ? activeYearForCurrentDate.id : undefined)
    }));

  const rawIncomingClasses: ClassEntity[] = Array.isArray(backupJson.classes) ? backupJson.classes : [];
  const protectedClassIds = new Set(protectedClasses.map(c => c.id));
  const classIdRemap = new Map<string, string>();

  rawIncomingClasses.forEach(c => {
    if (protectedClassIds.has(c.id)) {
      classIdRemap.set(c.id, crypto.randomUUID());
    }
  });

  const restoredClasses: ClassEntity[] = rawIncomingClasses.map(c => ({
    ...c,
    id: classIdRemap.get(c.id) || c.id,
    schoolYearId: targetSchoolYearId
  }));

  const newFullClasses = [...protectedClasses, ...restoredClasses];

  // Materie
  const protectedSubjects: Subject[] = currentState.subjects
    .filter(s => {
      if (s.schoolYearId && s.schoolYearId === targetSchoolYearId) return false;
      if (!s.schoolYearId && isTargetActiveYear) return false;
      return true;
    })
    .map(s => ({
      ...s,
      schoolYearId: s.schoolYearId || (activeYearForCurrentDate ? activeYearForCurrentDate.id : undefined)
    }));

  const rawIncomingSubjects: Subject[] = Array.isArray(backupJson.subjects) ? backupJson.subjects : [];
  const protectedSubjectIds = new Set(protectedSubjects.map(s => s.id));
  const subjectIdRemap = new Map<string, string>();

  rawIncomingSubjects.forEach(s => {
    if (protectedSubjectIds.has(s.id)) {
      subjectIdRemap.set(s.id, crypto.randomUUID());
    }
  });

  const restoredSubjects: Subject[] = rawIncomingSubjects.map(s => ({
    ...s,
    id: subjectIdRemap.get(s.id) || s.id,
    schoolYearId: targetSchoolYearId
  }));

  const newFullSubjects = [...protectedSubjects, ...restoredSubjects];

  // 8. DATABASE COMPITI (TASK TEMPLATES)
  // Ripristino effettivo dell'intero database compiti da Impostazioni -> Database compiti.
  const rawIncomingTemplates: TaskTemplate[] = Array.isArray(backupJson.taskTemplates) ? backupJson.taskTemplates : [];
  
  let newFullTemplates: TaskTemplate[];
  if (rawIncomingTemplates.length > 0) {
    // Normalizza i record importati preservando identificativi, titoli, compiti e classi associate
    const incomingRestored: TaskTemplate[] = rawIncomingTemplates.map(t => ({
      id: t.id || crypto.randomUUID(),
      title: t.title || 'Nuovo Gruppo Compiti',
      tasks: t.tasks || '',
      associatedClassNames: Array.isArray(t.associatedClassNames) ? [...t.associatedClassNames] : [],
      schoolYearId: t.schoolYearId || targetSchoolYearId
    }));

    // Mantieni solo eventuali record esplicitamente legati ad altri anni scolastici
    const otherYearTemplates = currentState.taskTemplates.filter(t => 
      t.schoolYearId && t.schoolYearId !== targetSchoolYearId
    );

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const combinedTemplates: TaskTemplate[] = [];

    // Priorità assoluta ai record del backup ripristinato
    incomingRestored.forEach(t => {
      seenIds.add(t.id);
      const titleKey = t.title.trim().toLowerCase();
      if (titleKey) seenTitles.add(titleKey);
      combinedTemplates.push(t);
    });

    // Includi record di altri anni scolastici solo se non duplicati
    otherYearTemplates.forEach(t => {
      const titleKey = (t.title || '').trim().toLowerCase();
      if (!seenIds.has(t.id) && (!titleKey || !seenTitles.has(titleKey))) {
        combinedTemplates.push(t);
        seenIds.add(t.id);
        if (titleKey) seenTitles.add(titleKey);
      }
    });

    newFullTemplates = combinedTemplates;
  } else {
    newFullTemplates = currentState.taskTemplates;
  }

  // LinkedSubjectGroups
  const rawIncomingGroups: LinkedSubjectGroup[] = Array.isArray(backupJson.linkedSubjectGroups) ? backupJson.linkedSubjectGroups : [];
  const currentGroupIds = new Set((currentState.linkedSubjectGroups || []).map(g => g.id));
  const mergedGroups: LinkedSubjectGroup[] = [...(currentState.linkedSubjectGroups || [])];

  rawIncomingGroups.forEach(g => {
    if (!currentGroupIds.has(g.id)) {
      mergedGroups.push(g);
    }
  });

  // 8. COERENZA CHIUSURE GLOBALI
  // Le chiusure attive in visualizzazione corrispondono all'anno della data corrente
  const activeYearAfter = updatedSchoolYears.find(
    y => getLocalDateStr(currentState.currentDate) >= y.startDate && getLocalDateStr(currentState.currentDate) <= y.endDate
  ) || updatedSchoolYears[0];

  const newActiveClosures = activeYearAfter?.closures || currentState.schoolClosures;

  // Determina se applicare anche i parametri orari globali (intervalli orari, durate, ricreazioni, max ore):
  // - quando si ripristina l'anno scolastico attualmente attivo
  // - oppure su un nuovo dispositivo / stato iniziale senza anni configurati o con un singolo anno non ancora personalizzato
  const isFreshSingleYear =
    !matchedExistingYear &&
    existingYears.length <= 1 &&
    currentState.lessonNotes.length === 0 &&
    !existingYears[0]?.timeSlots;
  const shouldApplyGlobalTimeSettings =
    isTargetActiveYear ||
    !activeYearForCurrentDate ||
    existingYears.length === 0 ||
    isFreshSingleYear;

  const restoredTimeSlots =
    shouldApplyGlobalTimeSettings && backupTimeSlots
      ? backupTimeSlots
      : currentState.timeSlots;
  const restoredDurations =
    shouldApplyGlobalTimeSettings && backupDurations
      ? backupDurations
      : currentState.durations;
  const restoredRecesses =
    shouldApplyGlobalTimeSettings && backupRecesses !== undefined
      ? backupRecesses
      : currentState.recesses;
  const restoredMaxHours =
    shouldApplyGlobalTimeSettings && backupMaxHours
      ? backupMaxHours
      : currentState.maxHours;

  return {
    newState: {
      schoolYears: updatedSchoolYears,
      schedule: newFullSchedule,
      lessonNotes: newFullNotes,
      specialDays: newFullSpecialDays,
      schoolClosures: newActiveClosures,
      provisionalPeriods: newFullProvisional,
      classes: newFullClasses,
      subjects: newFullSubjects,
      taskTemplates: newFullTemplates,
      linkedSubjectGroups: mergedGroups,
      timeSlots: restoredTimeSlots,
      durations: restoredDurations,
      recesses: restoredRecesses,
      maxHours: restoredMaxHours
    },
    restoredYearLabel: targetYearSummary.label,
    targetSchoolYearId,
    stats: {
      lessonsRestored: restoredLessons.length,
      notesRestored: restoredNotes.length,
      specialDaysRestored: targetIncomingSpecialDays.length,
      closuresRestored: (targetYearSummary.closures || []).length,
      provisionalPeriodsRestored: restoredProvisional.length,
      classesRestored: restoredClasses.length,
      subjectsRestored: restoredSubjects.length,
      taskTemplatesRestored: rawIncomingTemplates.length
    }
  };
};
