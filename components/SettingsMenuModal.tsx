import React, { useState, useMemo } from 'react';
import { X, Palette, Clock, Calendar, Coffee, ChevronRight, Settings, HelpCircle, ClipboardList, CalendarClock, RefreshCw, HardDrive, Download, Share } from 'lucide-react';
import { APP_VERSION, APP_RELEASE_DATE } from '../constants';

interface SettingsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubjects: () => void;
  onOpenHours: () => void;
  onOpenCalendar: () => void;
  onOpenProvisionalSchedule: () => void;
  onOpenRecess: () => void;
  onOpenGuide: () => void;
  onOpenTaskDatabase: () => void;
  onOpenBackup?: () => void;
  installPrompt?: any;
  onInstalled?: () => void;
}

const SettingsMenuModal: React.FC<SettingsMenuModalProps> = ({
  isOpen,
  onClose,
  onOpenSubjects,
  onOpenHours,
  onOpenCalendar,
  onOpenProvisionalSchedule,
  onOpenRecess,
  onOpenGuide,
  onOpenTaskDatabase,
  onOpenBackup,
  installPrompt,
  onInstalled
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showIOSInstallTip, setShowIOSInstallTip] = useState(false);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }, []);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  if (!isOpen) return null;

  const handleInstallApp = async () => {
    if (installPrompt && typeof installPrompt.prompt === 'function') {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        onInstalled?.();
      }
      return;
    }
    if (isIOS) {
      setShowIOSInstallTip(prev => !prev);
    }
  };

  const handleUpdateApp = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            await reg.update();
          } catch (e) {
            console.warn('SW update warning:', e);
          }
        }
      }
    } catch (err) {
      console.error("Errore durante l'aggiornamento:", err);
    } finally {
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  };

  const commonItemStyle = "bg-slate-50 border-slate-200 hover:border-primary/30 hover:bg-white hover:shadow-lg transition-all duration-300 group magi-press";

  const menuItems = [
    {
      icon: <HardDrive className="w-7 h-7 text-teal-600" />,
      title: "Backup e Ripristino Locale",
      description: "Salva, verifica e ripristina backup su disco.",
      onClick: onOpenBackup,
      color: commonItemStyle,
    },
    {
      icon: <Palette className="w-7 h-7 text-indigo-600" />,
      title: "Classi e Materie",
      description: "Gestisci classi, materie e colori.",
      onClick: onOpenSubjects,
      color: commonItemStyle,
    },
    {
      icon: <ClipboardList className="w-7 h-7 text-amber-600" />,
      title: "Database Compiti",
      description: "Compiti pronti da ripetere per classi.",
      onClick: onOpenTaskDatabase,
      color: commonItemStyle,
    },
    {
      icon: <Clock className="w-7 h-7 text-blue-600" />,
      title: "Ore Giornaliere",
      description: "Imposta il numero massimo di ore.",
      onClick: onOpenHours,
      color: commonItemStyle,
    },
    {
      icon: <Calendar className="w-7 h-7 text-emerald-600" />,
      title: "Calendario Scolastico",
      description: "Inizio scuola e quadrimestri.",
      onClick: onOpenCalendar,
      color: commonItemStyle,
    },
    {
      icon: <CalendarClock className="w-7 h-7 text-amber-600" />,
      title: "Orario Provvisorio",
      description: "Periodi con orario non propagato.",
      onClick: onOpenProvisionalSchedule,
      color: commonItemStyle,
    },
    {
      icon: <Coffee className="w-7 h-7 text-amber-600" />,
      title: "Ricreazione",
      description: "Configura le pause e la durata.",
      onClick: onOpenRecess,
      color: commonItemStyle,
    },
    {
      icon: <HelpCircle className="w-7 h-7 text-rose-600" />,
      title: "Guida Utente",
      description: "Istruzioni e aggiornamenti.",
      onClick: onOpenGuide,
      color: commonItemStyle,
    }
  ];

  const canShowInstall = !isStandalone && (Boolean(installPrompt) || isIOS);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-magi-fade" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-magi-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400 animate-spin-slow" style={{ animationDuration: '8s' }} />
            Impostazioni
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {canShowInstall && (
            <div className="space-y-2">
              <button
                onClick={handleInstallApp}
                className="w-full p-3.5 rounded-2xl border-2 border-primary/25 bg-primary/5 hover:bg-primary/10 flex items-center gap-3 text-left transition-all magi-press"
              >
                <div className="p-2 bg-primary text-white rounded-xl shadow-sm shrink-0">
                  {isIOS ? <Share className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-primary text-sm leading-tight">Installa App Locale (PWA)</div>
                  <div className="text-xs text-slate-600 leading-tight mt-0.5">
                    Usa MagiClass offline dalla schermata Home o desktop.
                  </div>
                </div>
              </button>
              {showIOSInstallTip && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
                  Su Safari (iPhone/iPad): tocca il pulsante <strong>Condividi</strong> e seleziona <strong>Aggiungi alla schermata Home</strong>.
                </div>
              )}
            </div>
          )}

          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                onClose();
                if (item.onClick) {
                  setTimeout(item.onClick, 250);
                }
              }}
              className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 text-left ${item.color} animate-magi-fade`}
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:scale-110 group-hover:rotate-3 transition-transform flex items-center justify-center">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-base leading-tight truncate">{item.title}</div>
                <div className="text-xs text-slate-500 leading-tight mt-1">{item.description}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">MagiClass Locale • v{APP_VERSION} ({APP_RELEASE_DATE})</p>
          <button
            onClick={handleUpdateApp}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold rounded-xl flex items-center gap-1.5 text-xs transition-all shadow-sm disabled:opacity-50 magi-press shrink-0"
            title="Verifica e applica aggiornamenti"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Aggiornamento...' : 'Aggiorna'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsMenuModal;
