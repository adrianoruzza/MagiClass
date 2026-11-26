import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Download,
  Upload,
  HardDrive,
  AlertTriangle,
  FileJson,
  CheckCircle2,
  FileText,
  FileDown,
  BookOpen,
  ChevronLeft,
  Calendar,
  ChevronDown,
  Check,
  FolderPlus,
  FolderCheck,
  FolderOpen,
  Loader2,
  ShieldCheck,
  RotateCcw,
  Share2
} from 'lucide-react';
import { SchoolYear } from '../types';
import {
  inspectBackupData,
  verifyBackupIntegrity,
  BackupInspectionResult,
  DetectedYearSummary,
  BackupIntegrityStatus
} from '../utils/backupRestore';
import {
  exportBackupToDevice,
  exportTransferableBackupFile,
  configureBackupDirectory,
  getSavedDirectoryHandle,
  clearSavedDirectoryHandle,
  isFileSystemAccessSupported,
  listBackupsInSavedDirectory,
  readBackupFromSavedDirectory,
  DeviceBackupResult,
  LocalFolderBackupFile,
  formatLastBackupTimestamp
} from '../utils/deviceBackup';
import {
  getLatestPreRestoreSnapshot,
  LocalSnapshotRecord
} from '../utils/localDatabase';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onExportTasks: (format: 'txt' | 'doc', selectedYearId?: string) => void;
  onSelectiveRestore: (
    backupJson: any,
    targetYearSummary: DetectedYearSummary,
    navigateToRestoredYear?: boolean,
    fileName?: string
  ) => Promise<{ stats: any; restoredYearLabel: string }>;
  onRollbackToSnapshot?: (snapshotId: string) => Promise<boolean>;
  getBackupPayload?: () => any;
  schoolYears?: SchoolYear[];
  currentDate?: Date;
  onNavigateToDate?: (date: Date) => void;
  onBackupSuccess?: (timestamp: string) => void;
}

const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onBack,
  onExportTasks,
  onSelectiveRestore,
  onRollbackToSnapshot,
  getBackupPayload,
  schoolYears = [],
  currentDate = new Date(),
  onNavigateToDate,
  onBackupSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveYears = useMemo(() => {
    return schoolYears && schoolYears.length > 0 ? schoolYears : [];
  }, [schoolYears]);

  const defaultYearId = useMemo(() => {
    if (effectiveYears.length === 0) return '';
    if (currentDate) {
      const d = new Date(currentDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const found = effectiveYears.find(year => dateStr >= year.startDate && dateStr <= year.endDate);
      if (found) return found.id;
    }
    return effectiveYears[0].id;
  }, [effectiveYears, currentDate]);

  const [tasksYearId, setTasksYearId] = useState<string>(defaultYearId);

  // Stato anteprima e conferma ripristino
  const [modalView, setModalView] = useState<'main' | 'preview' | 'success'>('main');
  const [loadedJson, setLoadedJson] = useState<any>(null);
  const [inspectionResult, setInspectionResult] = useState<BackupInspectionResult | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<BackupIntegrityStatus | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<string>('1.0');
  const [selectedTargetYearIndex, setSelectedTargetYearIndex] = useState<number>(0);
  const [restoreConfirmed, setRestoreConfirmed] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRestoredYearSummary, setLastRestoredYearSummary] = useState<DetectedYearSummary | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string>('');

  // Stato creazione backup locale
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<DeviceBackupResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savedFolderName, setSavedFolderName] = useState<string | null>(null);

  // Stato elenco backup nella cartella locale configurata
  const [localFolderBackups, setLocalFolderBackups] = useState<LocalFolderBackupFile[]>([]);
  const [showFolderBackups, setShowFolderBackups] = useState<boolean>(false);
  const [loadingFolderList, setLoadingFolderList] = useState<boolean>(false);
  const [loadingFolderFileName, setLoadingFolderFileName] = useState<string | null>(null);
  const [folderListError, setFolderListError] = useState<string | null>(null);

  // Stato snapshot di sicurezza pre-ripristino (rollback)
  const [latestSnapshot, setLatestSnapshot] = useState<LocalSnapshotRecord | null>(null);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);

  const supportsFSA = useMemo(() => isFileSystemAccessSupported(), []);

  const checkSavedFolder = useCallback(async () => {
    if (!supportsFSA) return;
    try {
      const handle = await getSavedDirectoryHandle();
      setSavedFolderName(handle ? handle.name : null);
    } catch {
      setSavedFolderName(null);
    }
  }, [supportsFSA]);

  const checkLatestSnapshot = useCallback(async () => {
    try {
      const snap = await getLatestPreRestoreSnapshot();
      setLatestSnapshot(snap);
    } catch {
      setLatestSnapshot(null);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (defaultYearId) {
        setTasksYearId(defaultYearId);
      }
      setModalView('main');
      setLoadedJson(null);
      setInspectionResult(null);
      setIntegrityStatus(null);
      setSchemaVersion('1.0');
      setRestoreConfirmed(false);
      setIsRestoring(false);
      setErrorMessage(null);
      setLastRestoredYearSummary(null);
      setExportResult(null);
      setExportError(null);
      setShowFolderBackups(false);
      setFolderListError(null);
      setRollbackMessage(null);
      checkSavedFolder();
      checkLatestSnapshot();
    }
  }, [isOpen, defaultYearId, checkSavedFolder, checkLatestSnapshot]);

  if (!isOpen) return null;

  const currentActiveYear = effectiveYears.find(y => {
    const yStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    return yStr >= y.startDate && yStr <= y.endDate;
  }) || effectiveYears[0];

  const processLoadedBackup = async (parsed: any, fileName?: string) => {
    const fName = fileName || loadedFileName;
    setRestoreConfirmed(false);

    // 1. Verifica versione e integrità SHA-256 prima di qualsiasi ripristino
    const verification = await verifyBackupIntegrity(parsed);
    setIntegrityStatus(verification.integrityStatus);
    setSchemaVersion(verification.schemaVersion);

    if (!verification.isCompatible) {
      setErrorMessage(verification.errorMessage || 'File di backup non compatibile o danneggiato.');
      setModalView('preview');
      setInspectionResult(null);
      setLoadedJson(null);
      return;
    }

    // 2. Analisi strutturale dei dati contenuti nel backup
    const inspection = inspectBackupData(parsed, effectiveYears, currentDate, fName);
    if (!inspection.isValid || inspection.detectedYears.length === 0) {
      setErrorMessage(inspection.errorMessage || 'File di backup non valido o non riconosciuto.');
      setModalView('preview');
      setInspectionResult(null);
      setLoadedJson(null);
      return;
    }

    setLoadedJson(parsed);
    setInspectionResult({
      ...inspection,
      schemaVersion: verification.schemaVersion,
      integrityStatus: verification.integrityStatus
    });
    setSelectedTargetYearIndex(0);
    setErrorMessage(null);
    setModalView('preview');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        await processLoadedBackup(parsed, file.name);
      } catch {
        setErrorMessage('Impossibile leggere il file: assicurati che sia un file JSON valido esportato da MagiClass.');
        setModalView('preview');
        setInspectionResult(null);
        setLoadedJson(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = async (navigateToRestored: boolean = false) => {
    if (!loadedJson || !inspectionResult || !restoreConfirmed) return;

    const activeDetectedYear = inspectionResult.detectedYears[selectedTargetYearIndex];
    if (!activeDetectedYear) return;

    setIsRestoring(true);
    setErrorMessage(null);
    try {
      await onSelectiveRestore(loadedJson, activeDetectedYear, navigateToRestored, loadedFileName);
      setLastRestoredYearSummary(activeDetectedYear);
      setModalView('success');
      await checkLatestSnapshot();

      if (navigateToRestored && onNavigateToDate && activeDetectedYear.startDate) {
        const [y, m, d] = activeDetectedYear.startDate.split('-').map(Number);
        onNavigateToDate(new Date(y, m - 1, d, 12, 0, 0));
      }
    } catch (err: any) {
      setErrorMessage(`Errore durante il ripristino (stato precedente preservato): ${err?.message || 'Operazione fallita'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportBackup = async (preferChangeDirectory: boolean = false) => {
    setIsExporting(true);
    setExportError(null);
    setExportResult(null);

    try {
      if (!getBackupPayload) {
        throw new Error('Generatore dati di backup non disponibile.');
      }

      const backupData = getBackupPayload();
      if (!backupData || !backupData.schedule) {
        throw new Error('Dati di backup non validi o incompleti.');
      }

      const res = await exportBackupToDevice(backupData, preferChangeDirectory);
      if (res && res.success) {
        onBackupSuccess?.(new Date().toISOString());
      }
      setExportResult(res);
      await checkSavedFolder();
    } catch (err: any) {
      setExportError(err?.message || 'Impossibile completare il backup locale.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTransferable = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportResult(null);

    try {
      if (!getBackupPayload) {
        throw new Error('Generatore dati di backup non disponibile.');
      }
      const backupData = getBackupPayload();
      const res = await exportTransferableBackupFile(backupData);
      if (res && res.success) {
        onBackupSuccess?.(new Date().toISOString());
      }
      setExportResult(res);
    } catch (err: any) {
      setExportError(err?.message || 'Impossibile esportare la copia trasferibile.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfigureDirectory = async () => {
    try {
      setExportError(null);
      setFolderListError(null);
      const chosen = await configureBackupDirectory();
      if (chosen) {
        setSavedFolderName(chosen);
      }
    } catch (err: any) {
      setExportError(err?.message || 'Impossibile configurare la cartella di destinazione.');
    }
  };

  const handleResetDirectory = async () => {
    await clearSavedDirectoryHandle();
    setSavedFolderName(null);
    setShowFolderBackups(false);
    setLocalFolderBackups([]);
  };

  const handleBrowseLocalFolder = async () => {
    setLoadingFolderList(true);
    setFolderListError(null);
    try {
      const { folderName, files } = await listBackupsInSavedDirectory(true);
      setSavedFolderName(folderName);
      setLocalFolderBackups(files);
      setShowFolderBackups(true);
    } catch (err: any) {
      setFolderListError(err?.message || 'Impossibile leggere i backup dalla cartella locale.');
    } finally {
      setLoadingFolderList(false);
    }
  };

  const handleSelectFolderBackup = async (file: LocalFolderBackupFile) => {
    setLoadingFolderFileName(file.name);
    setFolderListError(null);
    try {
      setLoadedFileName(file.name);
      const parsed = await readBackupFromSavedDirectory(file.name);
      await processLoadedBackup(parsed, file.name);
    } catch (err: any) {
      setErrorMessage(`Impossibile leggere il file "${file.name}": ${err?.message || 'file JSON non valido.'}`);
      setModalView('preview');
    } finally {
      setLoadingFolderFileName(null);
    }
  };

  const handleRollback = async () => {
    if (!latestSnapshot || !onRollbackToSnapshot) return;
    setIsRollingBack(true);
    setRollbackMessage(null);
    try {
      const ok = await onRollbackToSnapshot(latestSnapshot.id);
      if (ok) {
        setRollbackMessage('Stato precedente ripristinato correttamente.');
      }
    } catch (err: any) {
      setRollbackMessage(`Impossibile eseguire il rollback: ${err?.message || 'errore interno.'}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  const activeDetectedYear = inspectionResult ? inspectionResult.detectedYears[selectedTargetYearIndex] : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 animate-magi-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-magi-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,application/json"
          className="hidden"
        />

        {/* Modal Header */}
        <div className="bg-primary text-white p-4 shrink-0 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            {modalView === 'preview' ? (
              <button
                onClick={() => setModalView('main')}
                className="p-1 -ml-1 hover:bg-white/20 rounded-full transition-colors magi-press mr-1"
                title="Torna alle opzioni di backup"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : onBack ? (
              <button
                onClick={onBack}
                className="p-1 -ml-1 hover:bg-white/20 rounded-full transition-colors magi-press mr-1"
                title="Torna al menu impostazioni"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : null}
            <HardDrive className="w-6 h-6" />
            <h2 className="text-lg font-bold">
              {modalView === 'preview'
                ? 'Verifica e Conferma Ripristino'
                : modalView === 'success'
                ? 'Ripristino Completato'
                : 'Backup e Ripristino Locale'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors magi-press"
            title="Chiudi"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* --- VIEW 1: ANTEPRIMA E VERIFICA RIPRISTINO --- */}
        {modalView === 'preview' && (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto scrollbar-thin">
            {errorMessage ? (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-rose-900 mb-1">Impossibile ripristinare il backup</h3>
                <p className="text-sm text-rose-700 mb-4">{errorMessage}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-sm magi-press"
                >
                  Seleziona un altro file
                </button>
              </div>
            ) : activeDetectedYear && (
              <>
                {/* Banner Anno e Stato Integrità */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 shrink-0 mt-0.5">
                      <FileJson className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {integrityStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                            <ShieldCheck className="w-3 h-3" /> Integrità SHA-256 verificata
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider">
                            Formato classico compatibile
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-500">
                          Schema v{schemaVersion}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                        Anno Scolastico {activeDetectedYear.label}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        Dal {activeDetectedYear.startDate.split('-').reverse().join('/')} al {activeDetectedYear.endDate.split('-').reverse().join('/')}
                      </p>
                      {inspectionResult?.backupTimestamp && (
                        <p className="text-xs font-bold text-blue-800 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {formatLastBackupTimestamp(inspectionResult.backupTimestamp)}
                        </p>
                      )}
                      {loadedFileName && (
                        <p className="text-[11px] font-mono text-slate-500 mt-1 truncate" title={loadedFileName}>
                          {loadedFileName}
                        </p>
                      )}
                    </div>
                  </div>

                  {inspectionResult && inspectionResult.detectedYears.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-blue-200">
                      <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider mb-1.5">
                        Seleziona l'Anno Scolastico da ripristinare dal file:
                      </label>
                      <div className="relative">
                        <select
                          value={selectedTargetYearIndex}
                          onChange={(e) => setSelectedTargetYearIndex(Number(e.target.value))}
                          className="w-full bg-white border border-blue-300 text-slate-800 text-sm font-bold rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9 cursor-pointer shadow-sm"
                        >
                          {inspectionResult.detectedYears.map((dy, idx) => (
                            <option key={dy.id} value={idx}>
                              A.S. {dy.label} ({dy.startDate.split('-').reverse().join('/')} - {dy.endDate.split('-').reverse().join('/')})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-blue-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Riepilogo contenuti */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    Dati inclusi per l'A.S. {activeDetectedYear.label}:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-lg font-black text-blue-700">{activeDetectedYear.lessonsCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Lezioni Orario</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-lg font-black text-amber-700">{activeDetectedYear.notesCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Note / Compiti</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-lg font-black text-rose-700">{activeDetectedYear.specialDaysCount + activeDetectedYear.closuresCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Chiusure / Feste</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-lg font-black text-purple-700">{activeDetectedYear.provisionalPeriodsCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Orari Provvisori</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-lg font-black text-emerald-700">{activeDetectedYear.classesCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Classi</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="text-lg font-black text-indigo-700">{activeDetectedYear.subjectsCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Materie</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-3">
                      <div className="text-lg font-black text-teal-700">{activeDetectedYear.taskTemplatesCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Gruppi Database Compiti</div>
                    </div>
                  </div>
                </div>

                {/* Conferma esplicita prima della sovrascrittura */}
                <label className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={restoreConfirmed}
                    onChange={(e) => setRestoreConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-amber-950 leading-relaxed">
                    <strong>Confermo il ripristino:</strong> i dati dell'A.S. {activeDetectedYear.label} saranno sostituiti da questo backup. MagiClass salverà automaticamente uno <strong>snapshot di sicurezza locale</strong> prima di procedere, consentendo il recupero in caso di errore.
                  </span>
                </label>

                {/* Bottoni di Azione */}
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={() => handleConfirmRestore(false)}
                    disabled={!restoreConfirmed || isRestoring}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 magi-press text-base"
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Ripristino in corso...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>Conferma e Ripristina</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl transition-all text-xs text-center magi-press"
                    >
                      Scegli un altro file
                    </button>
                    <button
                      onClick={() => setModalView('main')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl transition-all text-xs text-center magi-press"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- VIEW 2: SUCCESSO RIPRISTINO --- */}
        {modalView === 'success' && lastRestoredYearSummary && (
          <div className="p-6 sm:p-8 space-y-6 text-center animate-magi-scale">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                Ripristino Completato con Successo!
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                I dati dell'<strong>A.S. {lastRestoredYearSummary.label}</strong> sono stati ripristinati e salvati nel database locale del dispositivo.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  if (onNavigateToDate && lastRestoredYearSummary.startDate) {
                    const [y, m, d] = lastRestoredYearSummary.startDate.split('-').map(Number);
                    onNavigateToDate(new Date(y, m - 1, d, 12, 0, 0));
                  }
                  onClose();
                }}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-rose-200 magi-press text-sm"
              >
                Vai alle lezioni dell'A.S. {lastRestoredYearSummary.label}
              </button>

              <button
                onClick={onClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all magi-press text-sm"
              >
                Chiudi e Rimani in {currentActiveYear ? `A.S. ${currentActiveYear.label}` : 'Anno Corrente'}
              </button>
            </div>
          </div>
        )}

        {/* --- VIEW 3: SCHERMATA PRINCIPALE BACKUP LOCALE --- */}
        {modalView === 'main' && (
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto scrollbar-thin">

            {/* SEZIONE 1: SALVATAGGIO BACKUP SU DISCO LOCALE */}
            <div className="bg-gradient-to-br from-blue-50/90 to-slate-50 border-2 border-blue-200/80 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Crea Backup Completo Locale
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-tight">
                    Salva classi, alunni, orario, intervalli orari, compiti e database compiti in formato verificato SHA-256.
                  </p>
                </div>
              </div>

              {savedFolderName && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs">
                  <span className="text-emerald-800 font-semibold flex items-center gap-1.5 truncate">
                    <FolderCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    Cartella locale: <strong className="text-emerald-950 truncate">{savedFolderName}</strong>
                  </span>
                  <button
                    onClick={handleResetDirectory}
                    className="text-slate-500 hover:text-rose-600 text-xs underline font-medium ml-2 shrink-0"
                    title="Reimposta cartella memorizzata"
                  >
                    Reimposta
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => handleExportBackup(false)}
                  disabled={isExporting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 magi-press text-sm"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvataggio e verifica integrità...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{savedFolderName ? `Salva backup in ${savedFolderName}` : 'Salva backup su disco locale'}</span>
                    </>
                  )}
                </button>

                <div className={`grid ${supportsFSA ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {supportsFSA && (
                    <button
                      onClick={handleConfigureDirectory}
                      disabled={isExporting}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors magi-press"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{savedFolderName ? 'Cambia cartella' : 'Scegli cartella'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportTransferable}
                    disabled={isExporting}
                    className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors magi-press"
                    title="Scarica un file JSON autonomo da copiare su un altro PC o tablet"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">Copia trasferibile (.json)</span>
                  </button>
                </div>
              </div>

              {exportResult && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-emerald-950 animate-magi-fade shadow-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs text-emerald-900">
                      Backup creato e verificato con successo!
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-emerald-800 pl-6 space-y-0.5">
                    <div>File: <strong className="font-mono text-emerald-950">{exportResult.fileName}</strong></div>
                    <div>Destinazione: <strong>{exportResult.targetDescription}</strong> ({(exportResult.size / 1024).toFixed(1)} KB)</div>
                    <div className="text-emerald-700 text-[10px]">
                      Schema v{exportResult.schemaVersion} • SHA-256: <span className="font-mono">{exportResult.integrityChecksum.slice(0, 12)}…</span> • Ore {exportResult.verifiedTime}
                    </div>
                  </div>
                </div>
              )}

              {exportError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 animate-magi-fade text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{exportError}</span>
                </div>
              )}
            </div>

            {/* SEZIONE 2: RIPRISTINO DA CARTELLA O FILE LOCALE */}
            <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 border border-amber-200 rounded-2xl p-4 transition-all shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-950 text-base">
                    Ripristina da Disco Locale
                  </h3>
                  <p className="text-xs text-amber-900/75 font-medium leading-tight">
                    Verifica integrità e versione prima del ripristino, con snapshot automatico di sicurezza.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-amber-200 flex items-center justify-center gap-2 magi-press text-sm"
                >
                  <FileJson className="w-4 h-4" />
                  <span>Seleziona file JSON dal dispositivo</span>
                </button>

                {supportsFSA && (
                  <button
                    onClick={handleBrowseLocalFolder}
                    disabled={loadingFolderList}
                    className="w-full bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors magi-press"
                  >
                    {loadingFolderList ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                        <span>Lettura cartella locale...</span>
                      </>
                    ) : (
                      <>
                        <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {savedFolderName
                            ? `Sfoglia backup nella cartella "${savedFolderName}"`
                            : 'Sfoglia backup in una cartella locale'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {folderListError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{folderListError}</span>
                </div>
              )}

              {showFolderBackups && (
                <div className="bg-white border border-amber-200 rounded-xl p-3 animate-magi-fade space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-950 border-b border-amber-100 pb-1.5">
                    <span>Backup trovati in {savedFolderName}:</span>
                    <button
                      onClick={() => setShowFolderBackups(false)}
                      className="text-slate-400 hover:text-slate-600 text-[11px]"
                    >
                      Nascondi
                    </button>
                  </div>
                  {localFolderBackups.length === 0 ? (
                    <p className="text-xs text-slate-500 py-1 text-center italic">
                      Nessun file .json trovato in questa cartella.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {localFolderBackups.map((file) => (
                        <div
                          key={file.name}
                          className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-100 hover:bg-amber-100/70 transition-colors text-xs"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="font-mono font-bold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {file.formattedSize} • {new Date(file.lastModified).toLocaleString('it-IT')}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectFolderBackup(file)}
                            disabled={loadingFolderFileName === file.name}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 magi-press flex items-center gap-1"
                          >
                            {loadingFolderFileName === file.name ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span>Apri</span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Snapshot di sicurezza pre-ripristino (Rollback) */}
              {latestSnapshot && onRollbackToSnapshot && (
                <div className="bg-white/90 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        Snapshot pre-ripristino disponibile
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Salvato il {new Date(latestSnapshot.createdAt).toLocaleString('it-IT')}
                      </p>
                    </div>
                    <button
                      onClick={handleRollback}
                      disabled={isRollingBack}
                      className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-[11px] font-bold rounded-lg shrink-0 magi-press flex items-center gap-1"
                    >
                      {isRollingBack ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      <span>Annulla ripristino</span>
                    </button>
                  </div>
                  {rollbackMessage && (
                    <p className="text-[11px] font-semibold text-emerald-700">{rollbackMessage}</p>
                  )}
                </div>
              )}
            </div>

            {/* SEZIONE 3: ESPORTAZIONE RIEPILOGO COMPITI TXT/DOC */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Esporta Riepilogo Compiti e Note
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onExportTasks('txt', tasksYearId)}
                  className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs magi-press text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Documento .TXT</span>
                </button>
                <button
                  onClick={() => onExportTasks('doc', tasksYearId)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs magi-press text-xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Documento .DOC</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default BackupModal;
