// Helper per salvataggio, verifica e ripristino backup su disco locale (Windows, macOS, Linux, Android, iOS)
import { LAST_BACKUP_STORAGE_KEY, APP_VERSION } from '../constants';

const DB_NAME = 'magiclass_backup_db';
const STORE_NAME = 'handles';
const DIRECTORY_KEY = 'backup_dir_handle';

export const BACKUP_FORMAT_SIGNATURE = 'MAGICLASS_LOCAL_BACKUP';
export const BACKUP_SCHEMA_VERSION = '2.0';
export const MAX_SUPPORTED_SCHEMA_MAJOR = 2;

export interface LocalFolderBackupFile {
  name: string;
  size: number;
  formattedSize: string;
  lastModified: number;
  lastModifiedIso: string;
}

export interface DeviceBackupResult {
  success: boolean;
  fileName: string;
  targetDescription: string;
  size: number;
  method: 'directory' | 'save_picker' | 'download';
  verifiedTime: string;
  integrityChecksum: string;
  schemaVersion: string;
}

export interface QuickBackupResult {
  status: 'saved' | 'fallback_download' | 'permission_revoked' | 'folder_unavailable' | 'cancelled' | 'error';
  fileName: string;
  folderName?: string;
  size?: number;
  savedAtIso?: string;
  savedAtFormatted?: string;
  message: string;
}

export const formatLastBackupTimestamp = (isoStringOrDate?: string | Date | null): string => {
  if (!isoStringOrDate) {
    return '';
  }
  const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(d.getTime())) {
    return '';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `Backup ${day}/${month}/${year} ore ${hours}.${minutes}`;
};

export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const recordLastBackupSuccess = (timestamp?: string): string => {
  const nowIso = timestamp || new Date().toISOString();
  try {
    localStorage.setItem(LAST_BACKUP_STORAGE_KEY, nowIso);
    localStorage.setItem('magiclass_last_backup_source', 'export');
    localStorage.setItem('magiclass_last_exported_backup_time', nowIso);
  } catch (e) {
    console.warn('Impossibile salvare timestamp ultimo backup:', e);
  }
  return nowIso;
};

export const recordLastRestoreSuccess = (timestamp: string): string => {
  try {
    localStorage.setItem(LAST_BACKUP_STORAGE_KEY, timestamp);
    localStorage.setItem('magiclass_last_backup_source', 'restore');
    localStorage.setItem('magiclass_last_restored_backup_time', timestamp);
  } catch (e) {
    console.warn('Impossibile salvare timestamp ultimo ripristino:', e);
  }
  return timestamp;
};

export type DevicePlatform = 'windows' | 'android' | 'mac' | 'ios' | 'linux' | 'other';

export const getDevicePlatform = (): DevicePlatform => {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('windows') || ua.includes('win32') || ua.includes('win64')) return 'windows';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return 'other';
};

export const getRecommendedFolderName = (): string => {
  return 'MagiClass_Backup';
};

export const getDeviceInstructions = (): { pathHint: string; description: string } => {
  const platform = getDevicePlatform();
  if (platform === 'windows') {
    return {
      pathHint: 'Desktop \\ MagiClass_Backup',
      description: 'Su Windows il file viene salvato nella cartella MagiClass_Backup o nella cartella scelta.'
    };
  }
  if (platform === 'android') {
    return {
      pathHint: 'Memoria interna / MagiClass_Backup',
      description: 'Su Android il file viene salvato nella cartella MagiClass_Backup o nei Download del dispositivo.'
    };
  }
  return {
    pathHint: 'MagiClass_Backup',
    description: 'Il file viene salvato nella cartella prescelta o nella cartella Download del dispositivo.'
  };
};

/**
 * Serializzazione deterministica canonica per il calcolo dell'impronta SHA-256
 * (esclude i campi di checksum stessi per garantire verificabilità esatta).
 */
export const canonicalizeForChecksum = (value: any): string => {
  const serialize = (node: any): any => {
    if (node === null || typeof node !== 'object') {
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(serialize);
    }
    const sortedKeys = Object.keys(node).sort();
    const out: Record<string, any> = {};
    for (const k of sortedKeys) {
      if (k === 'integrityChecksum' || k === 'checksumAlgorithm') continue;
      const v = node[k];
      if (v !== undefined) {
        out[k] = serialize(v);
      }
    }
    return out;
  };
  return JSON.stringify(serialize(value));
};

// Fallback SHA-256 puro in JS per ambienti browser non-HTTPS dove crypto.subtle potrebbe non essere esposto
const sha256FallbackHex = (input: string): string => {
  const utf8 = unescape(encodeURIComponent(input));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[((bitLen + 64 >> 9) << 4) + 15] = bitLen;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const W = new Array<number>(64);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = words[i + t] | 0;
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, W[t - 15]) ^ rotr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
      const s1 = rotr(17, W[t - 2]) ^ rotr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    H0 = (H0 + a) | 0; H1 = (H1 + b) | 0; H2 = (H2 + c) | 0; H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0; H5 = (H5 + f) | 0; H6 = (H6 + g) | 0; H7 = (H7 + h) | 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map(n => (n >>> 0).toString(16).padStart(8, '0'))
    .join('');
};

/**
 * Calcola l'impronta SHA-256 esadecimale del payload di backup per garantirne l'integrità.
 */
export const computeBackupChecksum = async (backupPayload: any): Promise<string> => {
  const canonical = canonicalizeForChecksum(backupPayload);
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(canonical);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fallback deterministico
  }
  return sha256FallbackHex(canonical);
};

/**
 * Prepara il payload di backup nel formato strutturato, versionato e verificabile (v2.0).
 */
export const prepareVersionedBackupPayload = async (rawPayload: any): Promise<any> => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const basePayload = {
    ...rawPayload,
    backupFormat: BACKUP_FORMAT_SIGNATURE,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: rawPayload?.appVersion || APP_VERSION,
    exportedAt: rawPayload?.exportedAt || localIso,
    createdAt: rawPayload?.createdAt || rawPayload?.exportedAt || localIso
  };

  const checksum = await computeBackupChecksum(basePayload);
  return {
    ...basePayload,
    checksumAlgorithm: 'SHA-256',
    integrityChecksum: checksum
  };
};

/**
 * Gestione persistenza DirectoryHandle tramite IndexedDB nativo del browser
 */
const openHandleDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const getSavedDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) return null;
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DIRECTORY_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Impossibile accedere al database dei permessi cartella:', err);
    return null;
  }
};

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, DIRECTORY_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Impossibile memorizzare il puntatore alla cartella:', err);
  }
};

export const clearSavedDirectoryHandle = async (): Promise<void> => {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DIRECTORY_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Errore rimozione cartella memorizzata:', err);
  }
};

export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
};

/**
 * Genera il nome univoco del file nel formato:
 * MagiClass_Backup_AAAA-MM-GG_HHMMSS.json
 */
export const generateUniqueBackupFileName = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `MagiClass_Backup_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.json`;
};

const formatDateTimeItalian = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const ensureDirectoryPermission = async (
  dirHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite'
): Promise<boolean> => {
  try {
    // @ts-ignore
    const perm = await dirHandle.queryPermission({ mode });
    if (perm === 'granted') return true;
    // @ts-ignore
    const reqPerm = await dirHandle.requestPermission({ mode });
    return reqPerm === 'granted';
  } catch {
    return false;
  }
};

/**
 * Seleziona e memorizza la cartella di backup desiderata dall'utente sul disco locale
 */
export const configureBackupDirectory = async (): Promise<string | null> => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('Il selettore avanzato di cartelle non è supportato da questo browser.');
  }

  try {
    // @ts-ignore
    const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: 'magiclass_backup_folder',
      mode: 'readwrite'
    });

    await saveDirectoryHandle(dirHandle);
    return dirHandle.name;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return null;
    }
    throw err;
  }
};

/**
 * Elenca i file di backup (.json) presenti nella cartella locale configurata,
 * ordinati dal più recente al più vecchio.
 */
export const listBackupsInSavedDirectory = async (
  promptIfMissing: boolean = true
): Promise<{ folderName: string; files: LocalFolderBackupFile[] }> => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('La lettura diretta di cartelle locali non è supportata da questo browser. Usa "Seleziona file JSON".');
  }

  let dirHandle = await getSavedDirectoryHandle();
  if (!dirHandle && promptIfMissing) {
    await configureBackupDirectory();
    dirHandle = await getSavedDirectoryHandle();
  }

  if (!dirHandle) {
    throw new Error('Nessuna cartella di backup selezionata.');
  }

  const granted = await ensureDirectoryPermission(dirHandle, 'read');
  if (!granted) {
    throw new Error('Permesso di lettura negato per la cartella di backup selezionata.');
  }

  const files: LocalFolderBackupFile[] = [];
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
      try {
        const file: File = await entry.getFile();
        files.push({
          name: file.name,
          size: file.size,
          formattedSize: formatFileSize(file.size),
          lastModified: file.lastModified,
          lastModifiedIso: new Date(file.lastModified).toISOString()
        });
      } catch {
        // Ignora file temporanei non leggibili
      }
    }
  }

  files.sort((a, b) => b.lastModified - a.lastModified || b.name.localeCompare(a.name));
  return { folderName: dirHandle.name, files };
};

/**
 * Legge e deserializza un file di backup specifico dalla cartella locale configurata.
 */
export const readBackupFromSavedDirectory = async (fileName: string): Promise<any> => {
  const dirHandle = await getSavedDirectoryHandle();
  if (!dirHandle) {
    throw new Error('Cartella di backup locale non configurata.');
  }
  const granted = await ensureDirectoryPermission(dirHandle, 'read');
  if (!granted) {
    throw new Error('Permesso di lettura negato per la cartella di backup.');
  }
  const fileHandle = await dirHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
};

const validateSerializedBackup = (jsonString: string): void => {
  if (!jsonString || jsonString.length < 50) {
    throw new Error('I dati di backup risultano vuoti o incompleti.');
  }
  const testParse = JSON.parse(jsonString);
  if (!testParse.schedule || !testParse.schoolYears || !Array.isArray(testParse.schoolYears)) {
    throw new Error('Struttura dei dati compromessa: impossibile generare il backup.');
  }
};

/**
 * Esporta una copia trasferibile del backup come file scaricabile/salvabile (.json)
 * per il trasferimento manuale verso un altro computer o dispositivo.
 */
export const exportTransferableBackupFile = async (rawBackupData: any): Promise<DeviceBackupResult> => {
  const versioned = await prepareVersionedBackupPayload(rawBackupData);
  const fileName = generateUniqueBackupFileName();
  const jsonString = JSON.stringify(versioned, null, 2);
  validateSerializedBackup(jsonString);

  const blob = new Blob([jsonString], { type: 'application/json' });
  const verifiedTime = new Date().toLocaleTimeString('it-IT');

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      // @ts-ignore
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Backup JSON MagiClass',
          accept: { 'application/json': ['.json'] }
        }]
      });
      // @ts-ignore
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      const writtenFile = await fileHandle.getFile();
      if (writtenFile.size === 0) {
        throw new Error('Verifica di scrittura fallita: il file salvato risulta vuoto.');
      }

      recordLastBackupSuccess();
      return {
        success: true,
        fileName: writtenFile.name || fileName,
        targetDescription: 'File esportato sul disco',
        size: writtenFile.size,
        method: 'save_picker',
        verifiedTime,
        integrityChecksum: versioned.integrityChecksum,
        schemaVersion: versioned.schemaVersion
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Esportazione annullata dall\'utente.');
      }
      // Fallback a download standard
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  recordLastBackupSuccess();
  return {
    success: true,
    fileName,
    targetDescription: 'Download dispositivo',
    size: blob.size,
    method: 'download',
    verifiedTime,
    integrityChecksum: versioned.integrityChecksum,
    schemaVersion: versioned.schemaVersion
  };
};

/**
 * Esporta il backup completo nel percorso locale scelto sul dispositivo
 * con formato versionato, checksum SHA-256 e verifica attiva di scrittura.
 */
export const exportBackupToDevice = async (
  rawBackupData: any,
  preferDialog: boolean = false
): Promise<DeviceBackupResult> => {
  const versioned = await prepareVersionedBackupPayload(rawBackupData);
  const fileName = generateUniqueBackupFileName();
  const jsonString = JSON.stringify(versioned, null, 2);
  validateSerializedBackup(jsonString);

  const blob = new Blob([jsonString], { type: 'application/json' });
  const verifiedTime = new Date().toLocaleTimeString('it-IT');

  // Metodo 1: File System Access API con cartella memorizzata o selezionata
  if (isFileSystemAccessSupported()) {
    let dirHandle = await getSavedDirectoryHandle();

    if (preferDialog || !dirHandle) {
      try {
        // @ts-ignore
        const selected = await window.showDirectoryPicker({
          id: 'magiclass_backup_folder',
          mode: 'readwrite',
          startIn: 'desktop'
        });

        if (selected.name !== 'MagiClass_Backup') {
          try {
            dirHandle = await selected.getDirectoryHandle('MagiClass_Backup', { create: true });
          } catch {
            dirHandle = selected;
          }
        } else {
          dirHandle = selected;
        }

        if (dirHandle) {
          await saveDirectoryHandle(dirHandle);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('Salvataggio annullato: nessuna cartella selezionata.');
        }
        console.warn('Errore selezione cartella, fallback al salvataggio file:', err);
      }
    }

    if (dirHandle) {
      try {
        const isPermGranted = await ensureDirectoryPermission(dirHandle, 'readwrite');
        if (isPermGranted) {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          // Verifica attiva post-scrittura
          const writtenFile = await fileHandle.getFile();
          if (writtenFile.size === 0) {
            throw new Error('Verifica di scrittura fallita: il file creato risulta vuoto.');
          }

          recordLastBackupSuccess();
          return {
            success: true,
            fileName,
            targetDescription: `Cartella locale ${dirHandle.name}`,
            size: writtenFile.size,
            method: 'directory',
            verifiedTime,
            integrityChecksum: versioned.integrityChecksum,
            schemaVersion: versioned.schemaVersion
          };
        }
      } catch (err: any) {
        console.warn('Impossibile scrivere nella cartella memorizzata, fallback:', err);
        await clearSavedDirectoryHandle();
      }
    }
  }

  // Metodo 2 e 3: Salvataggio con SaveFilePicker o Download standard
  return exportTransferableBackupFile(rawBackupData);
};

const triggerClassicDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/**
 * Salvataggio rapido con tasto Floppy:
 * - Prima volta: apre showDirectoryPicker() e salva il FileSystemDirectoryHandle in IndexedDB.
 * - Volte successive: salva automaticamente nella stessa cartella senza aprire il selettore.
 * - Permesso revocato / cartella non disponibile: segnala chiaramente l'errore e consente di riscegliere la cartella.
 * - Browser senza showDirectoryPicker (es. Firefox/Safari): fallback download classico con avviso esplicito.
 */
export const saveQuickBackupToLocalFolder = async (
  rawBackupData: any,
  options?: { forcePickFolder?: boolean }
): Promise<QuickBackupResult> => {
  const now = new Date();
  const fileName = generateUniqueBackupFileName(now);
  const savedAtFormatted = formatDateTimeItalian(now);
  const savedAtIso = now.toISOString();

  let jsonString: string;
  let blob: Blob;
  try {
    const versioned = await prepareVersionedBackupPayload(rawBackupData);
    jsonString = JSON.stringify(versioned, null, 2);
    validateSerializedBackup(jsonString);
    blob = new Blob([jsonString], { type: 'application/json' });
  } catch (err: any) {
    return {
      status: 'error',
      fileName,
      message: `Impossibile preparare il backup: ${err?.message || String(err)}`
    };
  }

  // Fallback per browser che non supportano File System Access API (es. Firefox / Safari)
  if (!isFileSystemAccessSupported()) {
    try {
      triggerClassicDownload(blob, fileName);
      recordLastBackupSuccess(savedAtIso);
      return {
        status: 'fallback_download',
        fileName,
        size: blob.size,
        savedAtIso,
        savedAtFormatted,
        message: `Backup scaricato (${fileName}) — ${savedAtFormatted}. In questo browser dovrai scegliere la cartella manualmente ogni volta.`
      };
    } catch (err: any) {
      return {
        status: 'error',
        fileName,
        message: `Errore durante il download del backup: ${err?.message || String(err)}`
      };
    }
  }

  let dirHandle: FileSystemDirectoryHandle | null = options?.forcePickFolder
    ? null
    : await getSavedDirectoryHandle();

  // Prima volta (o nuova selezione richiesta): apre il selettore di cartella del sistema
  if (!dirHandle) {
    try {
      // @ts-ignore
      dirHandle = await window.showDirectoryPicker({
        id: 'magiclass_backup_folder',
        mode: 'readwrite'
      });
      if (dirHandle) {
        await saveDirectoryHandle(dirHandle);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          status: 'cancelled',
          fileName,
          message: 'Salvataggio backup annullato: nessuna cartella selezionata.'
        };
      }
      return {
        status: 'error',
        fileName,
        message: `Impossibile aprire il selettore cartella: ${err?.message || String(err)}`
      };
    }
  }

  if (!dirHandle) {
    return {
      status: 'cancelled',
      fileName,
      message: 'Nessuna cartella selezionata per il salvataggio.'
    };
  }

  const folderName = dirHandle.name;

  // Verifica / rinnovo permesso di scrittura sulla cartella memorizzata
  const hasPermission = await ensureDirectoryPermission(dirHandle, 'readwrite');
  if (!hasPermission) {
    await clearSavedDirectoryHandle();
    return {
      status: 'permission_revoked',
      fileName,
      folderName,
      message: `Permesso revocato o negato per la cartella "${folderName}". Scegli di nuovo la cartella di backup.`
    };
  }

  // Scrittura reale su disco locale
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // Verifica attiva che il file scritto esista e non sia vuoto
    const writtenFile = await fileHandle.getFile();
    if (!writtenFile || writtenFile.size === 0) {
      throw new Error('Verifica post-scrittura fallita: il file salvato su disco risulta vuoto.');
    }

    recordLastBackupSuccess(savedAtIso);
    return {
      status: 'saved',
      fileName,
      folderName,
      size: writtenFile.size,
      savedAtIso,
      savedAtFormatted,
      message: `Backup salvato in ${folderName} — ${savedAtFormatted}`
    };
  } catch (err: any) {
    const errName = err?.name || '';
    if (
      errName === 'NotFoundError' ||
      errName === 'NotAllowedError' ||
      errName === 'InvalidStateError' ||
      errName === 'SecurityError'
    ) {
      await clearSavedDirectoryHandle();
      return {
        status: 'folder_unavailable',
        fileName,
        folderName,
        message: `La cartella "${folderName}" non è più disponibile o il permesso è stato revocato (${err?.message || errName}). Scegli di nuovo la cartella di backup.`
      };
    }
    return {
      status: 'error',
      fileName,
      folderName,
      message: `Errore durante il salvataggio del backup: ${err?.message || String(err)}`
    };
  }
};
