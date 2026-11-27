import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Calendar, CheckSquare, Palette, HardDrive, Smartphone, 
  RefreshCw, ChevronDown, ChevronUp, CheckCircle2, Download, 
  ArrowRight, Undo2, Redo2, 
  ChevronLeft, Search, Coffee, GraduationCap, LayoutGrid, 
  History, FileText, ShieldAlert, Check, Link2, Clock, 
  CalendarClock, ListTodo, Sparkles, 
  BookOpen, Layers, CheckCheck
} from 'lucide-react';
import AppIcon from './AppIcon';
import { APP_VERSION, APP_RELEASE_DATE as APP_DATE } from '../constants';

const DEFAULT_GUIDE_OPEN_SECTIONS: Record<string, boolean> = {
  'registro-classi': true,
  'collegamento-materie': true
};

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  installPrompt?: any;
  initialOpenSections?: Record<string, boolean>;
  initialSearchQuery?: string;
  initialScrollTop?: number;
  sessionRestoreKey?: number;
  onGuideStateChange?: (state: { openSections: Record<string, boolean>; searchQuery: string }) => void;
  onScrollPositionChange?: (scrollTop: number) => void;
}

const GuideModal: React.FC<GuideModalProps> = ({
  isOpen,
  onClose,
  onBack,
  installPrompt: _installPrompt,
  initialOpenSections,
  initialSearchQuery = '',
  initialScrollTop = 0,
  sessionRestoreKey = 0,
  onGuideStateChange,
  onScrollPositionChange
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    initialOpenSections && Object.keys(initialOpenSections).length > 0
      ? initialOpenSections
      : DEFAULT_GUIDE_OPEN_SECTIONS
  );
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const lastRestoreKeyRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionRestoreKey || sessionRestoreKey === lastRestoreKeyRef.current) return;
    lastRestoreKeyRef.current = sessionRestoreKey;
    if (initialOpenSections) {
      setOpenSections(
        Object.keys(initialOpenSections).length > 0 ? initialOpenSections : {}
      );
    }
    setSearchQuery(initialSearchQuery);
  }, [sessionRestoreKey, initialOpenSections, initialSearchQuery]);

  useEffect(() => {
    if (onGuideStateChange) {
      onGuideStateChange({ openSections, searchQuery });
    }
  }, [openSections, searchQuery, onGuideStateChange]);

  useEffect(() => {
    if (!isOpen || !initialScrollTop) return;
    const frame = requestAnimationFrame(() => {
      if (bodyScrollRef.current) {
        bodyScrollRef.current.scrollTop = initialScrollTop;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, sessionRestoreKey]);

  if (!isOpen) return null;

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const isSectionOpen = (id: string) => {
    if (searchQuery.trim()) return true;
    return !!openSections[id];
  };

  const handleExpandAll = () => {
    setOpenSections({
      'registro-classi': true,
      'collegamento-materie': true,
      'orario-provvisorio': true,
      'compiti-propagazione': true,
      'comandi-re-voto': true,
      'calendario-chiusure': true,
      'esportazione-word': true,
      'backup-locale': true,
      'ore-residue': true,
      'database-giornate': true,
      'interfaccia-pwa': true
    });
  };

  const handleCollapseAll = () => {
    setOpenSections({});
  };

  const handleForceUpdate = () => {
    if (confirm("L'applicazione verrà ricaricata per cercare nuovi aggiornamenti. Assicurati di aver salvato eventuali modifiche. Continuare?")) {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-2 sm:p-4 animate-magi-fade" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-magi-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 shrink-0 flex items-center gap-2 border-b border-slate-700">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-700 rounded-full transition-colors mr-1 magi-press" title="Indietro">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="p-1.5 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight truncate">
                Guida Ufficiale e Manuale d'Uso
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">MagiClass • Technical Education Suite</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors magi-press" title="Chiudi">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search & Quick Controls Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca argomento (es. materie collegate, word, orario provvisorio, compiti...)"
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end text-xs">
            <button 
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-600 font-semibold transition-colors"
            >
              Espandi tutto
            </button>
            <button 
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-600 font-semibold transition-colors"
            >
              Comprimi
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={bodyScrollRef}
          onScroll={onScrollPositionChange ? (e) => onScrollPositionChange(e.currentTarget.scrollTop) : undefined}
          className="flex-1 overflow-y-auto bg-slate-50/60 scrollbar-thin"
        >
            
          {/* App Hero Badge */}
          <div className="bg-white border-b border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-16 h-16 shadow-lg rounded-2xl overflow-hidden shrink-0 ring-4 ring-slate-100">
              <AppIcon className="w-full h-full" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">MagiClass</h1>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-full border border-blue-200 uppercase tracking-wider">
                  v{APP_VERSION}
                </span>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 font-semibold text-[10px] rounded-full border border-slate-200">
                  Aggiornata al {APP_DATE}
                </span>
              </div>
              <p className="text-slate-600 font-medium text-xs sm:text-sm">
                Documentazione completa e manuale operativo delle funzionalità didattiche, dell'orario e della gestione compiti.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">

            {/* SEZIONE 1: GESTIONE DEL REGISTRO E DELLE CLASSI */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('registro-classi')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      1. Gestione del Registro e delle Classi
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Classi, materie, elenco alunni DSA/H e configurazione orario</p>
                  </div>
                </div>
                {isSectionOpen('registro-classi') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('registro-classi') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-indigo-700">
                        <Palette className="w-4 h-4" /> Gestione Classi e Materie
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        Dal menu <strong>Impostazioni &gt; Classi e Materie</strong> puoi gestire in modo completamente autonomo:
                      </p>
                      <ul className="list-disc ml-4 text-xs text-slate-600 space-y-1.5">
                        <li><strong>Creazione Classi:</strong> inserisci il nome della classe e seleziona il colore distintivo per riconoscerla a colpo d'occhio nell'orario.</li>
                        <li><strong>Creazione Materie:</strong> definisci le materie d'insegnamento personalizzando lo stile visivo (sfondo, bordo e colore del testo).</li>
                        <li><strong>Assegnazione Materie alle Classi:</strong> cliccando sul pulsante di modifica della classe, puoi spuntare esattamente quali materie sono attive per quella specifica classe. Solo le materie abilitate compariranno durante l'assegnazione delle lezioni.</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-indigo-700">
                        <GraduationCap className="w-4 h-4" /> Elenco Alunni e Bisogni Educativi (DSA / H)
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        Per ogni classe è presente il tasto alunni (<GraduationCap className="inline w-3.5 h-3.5 text-primary" />) con funzioni avanzate:
                      </p>
                      <ul className="list-disc ml-4 text-xs text-slate-600 space-y-1.5">
                        <li><strong>Inserimento Rapido:</strong> aggiungi gli studenti uno alla volta digitando il nome e cognome.</li>
                        <li><strong>Importazione Multipla (Bulk):</strong> incolla l'intero elenco della classe dal registro elettronico o da un foglio di testo (un nominativo per riga) per caricarli istantaneamente.</li>
                        <li><strong>Indicatori DSA e H:</strong> attiva con un tocco i badge dedicati per identificare tempestivamente alunni con disturbi specifici dell'apprendimento o certificazione.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                    <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-1 text-xs uppercase tracking-wider">
                      <LayoutGrid className="w-4 h-4 text-indigo-600" /> Gestione dell'Orario e Differenza tra Materie
                    </h4>
                    <p className="text-xs text-indigo-900 leading-relaxed mb-2">
                      L'orario scolastico settimanale si compone cliccando semplicemente su ogni casella vuota:
                    </p>
                    <ul className="list-disc ml-4 text-xs text-indigo-800 space-y-1">
                      <li><strong>Slot vuoto:</strong> tocca una casella libera per scegliere classe, materia e aula in cui si svolge la lezione.</li>
                      <li><strong>Modifica e Cancellazione:</strong> tocca qualsiasi lezione già impostata per visualizzarne i compiti, modificarla o cancellarla.</li>
                      <li><strong>Materie Ordinarie vs Materie Collegate:</strong> le materie ordinarie propagano i compiti esclusivamente sulla <em>stessa materia</em>. Le materie collegate, invece, condividono lo stesso gruppo di propagazione compiti sulla <em>stessa classe</em>, garantendo la continuità didattica per i docenti con più cattedre nella medesima classe.</li>
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 2: COLLEGAMENTO TRA MATERIE (STESSO DOCENTE) */}
            <section className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden transition-all ring-1 ring-blue-500/10">
              <button 
                onClick={() => toggleSection('collegamento-materie')} 
                className="w-full flex items-center justify-between p-4 bg-blue-50/80 hover:bg-blue-100/70 transition-colors text-left border-b border-blue-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-blue-950">
                      2. Collegamento tra Materie dello Stesso Docente
                    </h3>
                    <p className="text-[11px] text-blue-700 font-normal">Funzionamento, isolamento per classe e propagazione intelligente compiti</p>
                  </div>
                </div>
                {isSectionOpen('collegamento-materie') ? <ChevronUp className="w-5 h-5 text-blue-700" /> : <ChevronDown className="w-5 h-5 text-blue-700" />}
              </button>

              {isSectionOpen('collegamento-materie') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Nel menu <strong>Gestione classi e materie</strong> è presente il pulsante <strong>"Collega materie"</strong>. Questa funzione consente di raggruppare due o più materie già create quando sono svolte dallo <strong>STESSO DOCENTE</strong> nella scuola.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-blue-700">
                        <CheckCheck className="w-4 h-4 text-blue-600" /> Principi Fondamentali
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc ml-4">
                        <li><strong>Materie Distinte e Intatte:</strong> il collegamento <strong>NON fonde</strong> le materie in una sola e <strong>NON ne modifica il nome o il colore</strong> visualizzato nell'orario. Ciascuna materia rimane chiaramente riconoscibile e autonoma.</li>
                        <li><strong>Scopo del Collegamento:</strong> serve esclusivamente per determinare la corretta <strong>propagazione automatica dei compiti</strong> tra le lezioni tenute dallo stesso insegnante.</li>
                        <li><strong>Multi-Gruppi:</strong> è possibile creare più gruppi indipendenti (es. per diverse aree disciplinari) e aggiungere o rimuovere materie in qualsiasi istante.</li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-blue-700">
                        <ShieldAlert className="w-4 h-4 text-blue-600" /> Regola di Isolamento tra Classi
                      </h4>
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs leading-relaxed">
                        <p className="font-bold mb-1">Vincolo di Classe Inviolabile:</p>
                        La propagazione avviene considerando la coppia <strong>CLASSE + GRUPPO DI MATERIE COLLEGATE</strong>. Il collegamento tra materie <strong>non consente mai la propagazione tra classi diverse</strong>: i compiti di una classe rimangono tassativamente all'interno di quella classe.
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Se una materia non appartiene ad alcun gruppo, la propagazione continua a operare nel modo tradizionale (esclusivamente verso la medesima materia).
                      </p>
                    </div>
                  </div>

                  {/* Esempio Pratico Box */}
                  <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200">
                    <h4 className="font-bold text-blue-900 text-xs sm:text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" /> Esempio Pratico di Propagazione Multi-Materia
                    </h4>
                    <div className="bg-white p-3.5 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-2">
                      <div className="flex items-center gap-2 text-blue-800 font-semibold">
                        <span>Materie collegate nel gruppo docente:</span>
                        <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-900 font-mono text-[11px]">TTRG</span>
                        <span>+</span>
                        <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-900 font-mono text-[11px]">Meccanica</span>
                        <span>+</span>
                        <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-900 font-mono text-[11px]">Tecnologia</span>
                      </div>
                      <p className="leading-relaxed">
                        1. <strong>Giorno 22</strong> &rarr; Classe <strong>1AM</strong> &rarr; Materia <strong>TTRG</strong>: viene assegnato il compito X.<br />
                        2. Il compito X <strong>NON viene completato</strong> (o deve essere verificato alla lezione successiva).<br />
                        3. Il sistema ricerca il <strong>primo giorno successivo</strong> in cui c'è una lezione per la <strong>stessa classe (1AM)</strong> con <strong>una qualsiasi</strong> delle materie del gruppo (ad esempio, il giorno dopo c'è lezione di <em>Meccanica</em>).<br />
                        4. Il compito X viene automaticamente depositato nella lezione di <em>Meccanica</em> della 1AM in <strong>"Controllare"</strong>, garantendo che il docente non perda il filo didattico anche se la materia a orario è differente!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 3: ORARIO DEFINITIVO, ORARIO PROVVISORIO E SCAMPANII */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('orario-provvisorio')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      3. Orario Scolastico, Orario Provvisorio e Scampanii
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Orario ordinario, periodi provvisori indipendenti e durate orarie personalizzate</p>
                  </div>
                </div>
                {isSectionOpen('orario-provvisorio') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('orario-provvisorio') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-amber-700 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> Orario Definitivo vs Provvisorio
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc ml-4">
                        <li><strong>Orario Definitivo (Ordinario):</strong> costituisce l'orario scolastico permanente dell'intero anno didattico.</li>
                        <li><strong>Periodi di Orario Provvisorio:</strong> da <em>Impostazioni &gt; Orario Provvisorio</em> puoi impostare uno o più periodi temporanei indipendenti (es. le prime 2 settimane di scuola, o cambi orario trimestrali), specificando etichetta, data di inizio e data di fine.</li>
                        <li><strong>Isolamento Totale delle Modifiche:</strong> le modifiche apportate durante un periodo provvisorio riguardano <strong>esclusivamente quel periodo/settimana</strong> e non sovrascrivono l'orario definitivo o le settimane successive.</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-amber-700 flex items-center gap-1.5">
                        <Coffee className="w-4 h-4" /> Scampanii, Durate e Ricreazioni
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc ml-4">
                        <li><strong>Scampanii Specifici del Periodo:</strong> ogni periodo provvisorio può avere intervalli orari personalizzati (es. ore ridotte da 50 o 55 minuti, uscite anticipate), visualizzati chiaramente con badge di periodo.</li>
                        <li><strong>Durata delle Lezioni (55 min / 60 min):</strong> cliccando sull'etichetta dell'ora (o da Impostazioni) è possibile impostare durate personalizzate con ricalcolo a catena automatico di tutti gli scampanii della giornata.</li>
                        <li><strong>Ricreazioni:</strong> configura intervalli dedicati (dopo la 2ª, 3ª o 4ª ora, durata 10, 20 o 30 minuti).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-xs text-amber-900">
                    <p className="font-bold mb-1 flex items-center gap-1.5">
                      <ArrowRight className="w-4 h-4 text-amber-700" /> Comportamento della Propagazione con Orario Provvisorio:
                    </p>
                    <p>
                      Durante i giorni coperti da un periodo di orario provvisorio, la propagazione dei compiti segue dinamicamente le lezioni del periodo provvisorio attivo. <strong>Al termine della data di fine del periodo, la propagazione riprende automaticamente e in modo trasparente l'orario definitivo</strong>, garantendo continuità perfetta senza alcun intervento manuale.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 4: COMPITI E PROPAGAZIONE */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('compiti-propagazione')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      4. Gestione Compiti e Flusso di Propagazione
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Schede Controllare / Fare / Varie, stati operativi e condizioni bloccanti</p>
                  </div>
                </div>
                {isSectionOpen('compiti-propagazione') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('compiti-propagazione') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Toccando qualsiasi lezione nell'orario si apre il modale operativo suddiviso in 3 sezioni didattiche specializzate:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100">
                      <span className="font-bold text-indigo-900 text-xs uppercase tracking-wider block mb-1">1. CONTROLLARE</span>
                      <p className="text-[11px] text-indigo-800 leading-normal">
                        Contiene i compiti assegnati nelle lezioni passate che devono essere verificati oggi. Spunta come "Fatto" una volta controllato sul quaderno.
                      </p>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
                      <span className="font-bold text-emerald-900 text-xs uppercase tracking-wider block mb-1">2. FARE</span>
                      <p className="text-[11px] text-emerald-800 leading-normal">
                        Le attività spiegate oggi in classe e gli esercizi/tavole assegnati per casa. Quando completati in classe, si spostano in "Controllare" della lezione successiva.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-100/80 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block mb-1">3. VARIE</span>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        Promemoria operativi, materiale da portare in laboratorio, note disciplinari o comunicazioni alle famiglie.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> Stati Operativi e Spostamento Rapido
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc ml-4">
                      <li><strong>Stato In Sospeso (Pending):</strong> il compito è pianificato ma non ancora completato.</li>
                      <li><strong>Stato Fatto (Done):</strong> segnato con <Check className="inline w-3.5 h-3.5 text-emerald-600" />; se era in <em>FARE</em>, genera automaticamente la voce in <em>CONTROLLARE</em> per la lezione futura.</li>
                      <li><strong>Tasto Freccia ("Sposta alla successiva"):</strong> rimanda un singolo compito non terminato direttamente alla lezione seguente.</li>
                      <li><strong>"Sposta Tutto alla Prossima Lezione":</strong> sposta in blocco tutte le note della lezione alla successiva data utile (con comodo tasto per annullare/ripristinare in caso di errore).</li>
                    </ul>
                  </div>

                  <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200">
                    <h4 className="font-bold text-rose-950 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" /> Condizioni ed Eventi che Bloccano o Modificano la Propagazione
                    </h4>
                    <p className="text-xs text-rose-900 leading-relaxed mb-2">
                      Il motore di propagazione è progettato per rispettare rigorosamente il calendario didattico reale e non depositare mai compiti dove la lezione non ha luogo:
                    </p>
                    <ul className="text-xs text-rose-800 space-y-1 list-disc ml-4">
                      <li><strong>Chiusure e Vacanze Scolastiche:</strong> le date di chiusura vengono ignorate e i compiti vanno alla riapertura.</li>
                      <li><strong>Stati Giornalieri Speciali (Malattia, Permessi, Assemblee, Scuola Chiusa, Gite):</strong> tutti i compiti del giorno vengono automaticamente posticipati alla prima data utile successiva.</li>
                      <li><strong>Lezioni con Eventi Speciali (Esami orali, scritti, pratici, uscite didattiche):</strong> le lezioni etichettate come esami o assemblee non ricevono compiti in propagazione automatica e vengono saltate.</li>
                      <li><strong>Fine Settimana:</strong> i giorni non lavorativi (domenica, e sabato se settimana a 5 giorni) sono esclusi a priori.</li>
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 5: COMANDI RE E VOTO (MONITORAGGIO REGISTRO) */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('comandi-re-voto')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      5. Promemoria Registro Elettronico: Comandi RE e VOTO
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Tracciamento rapido delle trascrizioni su registro ufficiale</p>
                  </div>
                </div>
                {isSectionOpen('comandi-re-voto') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('comandi-re-voto') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-amber-600">
                        <span className="px-1.5 py-0.5 rounded bg-amber-400 text-white font-black text-[10px]">RE</span> Comando Registro Elettronico
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        Sulla cella della lezione compare il badge <strong>RE</strong> per ricordarti se hai già trascritto i compiti e l'argomento sul registro elettronico istituzionale:
                      </p>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc ml-4">
                        <li><strong>Badge Giallo/Ambra Lampeggiante:</strong> indica che ci sono compiti o note ancora da segnare sul Registro Elettronico.</li>
                        <li><strong>Badge Verde con Spunta (✓):</strong> toccando il badge, diventa verde stabile, attestando che la trascrizione è avvenuta.</li>
                        <li>Se modifichi i compiti o propaghi nuove attività alla lezione, il badge si reimposta automaticamente su ambra per richiamare l'attenzione.</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-blue-600">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white font-black text-[10px]">VOTO</span> Comando Trascrizione Voti
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        Quando una lezione è contrassegnata come verifica, interrogazione o prova pratica:
                      </p>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc ml-4">
                        <li><strong>Badge Blu Pulsante:</strong> ti avvisa che le valutazioni di quella prova sono in attesa di essere riportate nel registro dei voti.</li>
                        <li><strong>Badge Blu Scuro con Spunta (✓):</strong> un tocco sul pulsante registra che tutti i voti sono stati inseriti nel registro elettronico ufficiale.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 6: CALENDARIO E CHIUSURE */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('calendario-chiusure')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      6. Calendario Scolastico, Chiusure e Settimane Didattiche
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Intervalli di vacanza, calcolo reale settimane e salti temporali</p>
                  </div>
                </div>
                {isSectionOpen('calendario-chiusure') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('calendario-chiusure') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-rose-700 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Chiusure Programmate e Vacanze
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        Da <strong>Impostazioni &gt; Calendario Scolastico</strong> puoi inserire tutti i periodi di sospensione delle lezioni (es. Vacanze Natalizie, Pasquali, ponti, patroni):
                      </p>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc ml-4">
                        <li><strong>Intervalli Flessibili:</strong> imposta data di inizio, data di fine e motivo della chiusura.</li>
                        <li><strong>Blocco Automatico:</strong> l'orario mostrerà l'indicazione di chiusura per quei giorni impedendo l'inserimento accidentale di lezioni ordinarie.</li>
                        <li><strong>Scavalcamento Compiti:</strong> le scadenze e i compiti vengono automaticamente rimandati al primo giorno di scuola effettivo dopo la riapertura.</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-rose-700 flex items-center gap-1.5">
                        <History className="w-4 h-4" /> Conteggio Settimane Effettive (X / Y)
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        Il tasto <strong>"Oggi"</strong> nell'intestazione mostra il numero della settimana didattica in corso (es. <em>Settimana 12 / 33</em>):
                      </p>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc ml-4">
                        <li><strong>Esclusione Automatica:</strong> le settimane completamente coperte da chiusure scolastiche (es. le due settimane di Natale) vengono escluse dal conteggio totale delle settimane didattiche.</li>
                        <li><strong>Quadrimestri / Trimestri:</strong> configurando la data di cambio periodo, MagiClass adatta statistiche e conteggio residui al relativo periodo didattico.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 7: ESPORTAZIONE WORD (.DOC) E TESTO (.TXT) DEL REGISTRO */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('esportazione-word')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      7. Esportazione Ufficiale Word (.doc) e Testo (.txt) del Registro
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Relazione finale, lezioni svolte e formattazione con data e materia</p>
                  </div>
                </div>
                {isSectionOpen('esportazione-word') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('esportazione-word') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Nella schermata <strong>Backup e Ripristino Locale</strong> trovi i comandi per scaricare il registro completo in formato <strong>Microsoft Word (.doc)</strong> o <strong>Testo (.txt)</strong>.
                  </p>

                  <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-2">
                    <h4 className="font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                      <CheckCheck className="w-4 h-4 text-blue-700" /> Regole di Composizione dell'Esportazione Word
                    </h4>
                    <ul className="space-y-1.5 list-disc ml-4 text-blue-900">
                      <li><strong>Raggruppamento per Classe:</strong> il documento è ordinato classe per classe in successione cronologica.</li>
                      <li><strong>Intestazione Lezione con Data e Materia:</strong> ogni singola lezione viene introdotta dall'intestazione standard: <code>[Data] – [Materia]</code> (ad esempio: <em>18/09/2026 – Disegno tecnico</em>).</li>
                      <li><strong>Inclusione Obbligatoria di Tutte le Lezioni a Orario:</strong> la lezione <strong>deve essere esportata anche quando CONTROLLARE, FARE e VARIE sono completamente vuoti</strong>. La presenza della lezione nell'orario è sufficiente per certificarne l'avvenuto svolgimento sul documento finale.</li>
                      <li><strong>Dettaglio Contenuti:</strong> se per quella lezione sono presenti attività svolte, compiti assegnati o note, questi vengono formattati ordinatamente sotto la rispettiva data.</li>
                    </ul>
                  </div>

                  <p className="text-xs text-slate-500">
                    Il file .doc generato è immediatamente modificabile e stampabile, ideale come allegato alla relazione didattica di fine anno o per il passaggio di consegne tra docenti.
                  </p>
                </div>
              )}
            </section>

            {/* SEZIONE 8: ESPORTAZIONI, BACKUP E SALVATAGGIO LOCALE */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('backup-locale')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold shrink-0">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      8. Database Locale, Backup su Disco e Ripristino Sicuro
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Archiviazione locale IndexedDB, verifica integrità SHA-256 e privacy totale</p>
                  </div>
                </div>
                {isSectionOpen('backup-locale') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('backup-locale') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-sky-700 flex items-center gap-1.5">
                        <Download className="w-4 h-4" /> Backup Locale Verificato (JSON v2.0)
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc ml-4">
                        <li><strong>100% Locale e Autonomo:</strong> tutti i dati risiedono nel database locale IndexedDB del dispositivo, senza account online, server esterni o servizi cloud.</li>
                        <li><strong>Cartella Locale e Verifica SHA-256:</strong> scegli una cartella sul disco (es. <em>MagiClass_Backup</em>) oppure esporta un file trasferibile; ogni backup include un'impronta crittografica SHA-256 per verificarne l'integrità prima del ripristino.</li>
                        <li><strong>Ripristino Selettivo con Snapshot di Sicurezza:</strong> prima di applicare un ripristino, MagiClass salva automaticamente uno snapshot locale dello stato precedente, consentendoti di annullare l'operazione in qualsiasi momento.</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 text-sky-700 flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4" /> Trasferimento Manuale tra Dispositivi
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc ml-4">
                        <li><strong>Copia Trasferibile:</strong> usa il pulsante <em>"Copia trasferibile (.json)"</em> per salvare un file completo comprensivo di orario, intervalli orari, periodi provvisori, classi, compiti e database compiti.</li>
                        <li><strong>Importazione Rapida:</strong> sul secondo dispositivo apri <em>Impostazioni → Backup e Ripristino Locale</em>, seleziona il file JSON e conferma dopo aver verificato l'anteprima.</li>
                        <li><strong>Privacy Garantita:</strong> nessun dato scolastico viene mai trasmesso all'esterno del dispositivo.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 9: ORE E GIORNI RESIDUI DI LEZIONE */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('ore-residue')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      9. Ore e Giorni Residui di Lezione
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Conteggio per classe, ore a disposizione, ore buche e integrazione orario provvisorio</p>
                  </div>
                </div>
                {isSectionOpen('ore-residue') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('ore-residue') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Il pannello <strong>Ore e Giorni Residui</strong> calcola con precisione millimetrica il monte ore didattico rimanente da oggi fino alla fine dell'anno o del periodo:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                      <span className="font-bold text-teal-900 text-xs block mb-1">Ore per Classe</span>
                      <p className="text-[11px] text-teal-800">Visualizzazione separata per ciascuna classe per verificare l'avanzamento dei programmi.</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <span className="font-bold text-blue-900 text-xs block mb-1">Ore a Disposizione</span>
                      <p className="text-[11px] text-blue-800">Conteggio delle ore di potenziamento o supplenza da svolgere.</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <span className="font-bold text-amber-900 text-xs block mb-1">Ore di Buco</span>
                      <p className="text-[11px] text-amber-800">Ore libere intermedie residue previste dall'orario settimanale.</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <span className="font-bold text-indigo-900 text-xs block mb-1">Giorni Residui</span>
                      <p className="text-[11px] text-indigo-800">Dettaglio per giorno della settimana (Lunedì, Martedì...) e totale complessivo.</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800 mb-1">Calcolo Dinamico tra Orario Definitivo e Periodi Provvisori:</p>
                    Il sistema calcola le ore considerando la data esatta: se un giorno ricade in un <strong>periodo di orario provvisorio</strong>, vengono calcolate le ore e gli intervalli specifici di quel periodo; al termine del periodo, il calcolo torna a basarsi sull'orario definitivo. Vengono inoltre escluse tutte le chiusure e i giorni speciali.
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 10: DATABASE COMPITI E GIORNATE SPECIALI */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('database-giornate')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      10. Database Compiti, Task Board e Giornate Speciali
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Template ricorrenti, attività personali e gestione assenze docente</p>
                  </div>
                </div>
                {isSectionOpen('database-giornate') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('database-giornate') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-purple-600" /> Database Compiti
                      </h4>
                      <p className="text-xs text-slate-600 leading-normal">
                        Salva compiti ed esercitazioni modello associandoli a classi specifiche. Durante l'assegnazione della lezione potrai richiamarli con un solo tocco senza riscrivere il testo.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ListTodo className="w-4 h-4 text-purple-600" /> Task Board Personale
                      </h4>
                      <p className="text-xs text-slate-600 leading-normal">
                        Schermata dedicata alle to-do personali del docente: inserisci attività con priorità (Alta, Media, Bassa), spuntale quando completate o rimuovile dall'elenco.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-purple-600" /> Giornate Speciali
                      </h4>
                      <p className="text-xs text-slate-600 leading-normal">
                        Cliccando sulla data del giorno (es. <em>LUN 12</em>) puoi segnare <strong>Malattia</strong>, <strong>Permesso</strong>, <strong>Assemblea</strong> o <strong>Gita</strong>. Tutti i compiti del giorno vengono spostati in avanti in blocco.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SEZIONE 11: INTERFACCIA, NAVIGAZIONE E INSTALLAZIONE PWA */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              <button 
                onClick={() => toggleSection('interfaccia-pwa')} 
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      11. Interfaccia, Navigazione e Installazione PWA
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal">Filtri, ricerca argomenti, scorciatoie Annulla/Ripristina e app nativa</p>
                  </div>
                </div>
                {isSectionOpen('interfaccia-pwa') ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </button>

              {isSectionOpen('interfaccia-pwa') && (
                <div className="p-5 text-sm space-y-4 text-slate-700 leading-relaxed animate-magi-fade">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-slate-700">
                        <LayoutGrid className="w-4 h-4 text-primary" /> Strumenti Rapidi di Navigazione
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc ml-4">
                        <li><strong>Filtro per Classe:</strong> isola la visualizzazione dell'orario di una sola classe per controllarne la programmazione.</li>
                        <li><strong>Ricerca Globale:</strong> premi l'icona lente (<Search className="inline w-3.5 h-3.5 text-slate-500" />) per cercare qualsiasi termine o argomento spiegato tra tutte le classi dell'anno.</li>
                        <li><strong>Selettore del Mese:</strong> tocca il nome del mese in alto per saltare direttamente a qualsiasi settimana dell'anno.</li>
                        <li><strong>Annulla e Ripristina:</strong> tasti dedicati <Undo2 className="inline w-3.5 h-3.5 text-slate-600" /> e <Redo2 className="inline w-3.5 h-3.5 text-slate-600" /> (con supporto Ctrl+Z e Ctrl+Y) per annullare modifiche involontarie.</li>
                      </ul>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-slate-700">
                        <Smartphone className="w-4 h-4 text-slate-600" /> Installazione Nativa su Tablet e Smartphone
                      </h4>
                      <p className="text-xs text-slate-600 mb-2">
                        MagiClass è una Progressive Web App (PWA) e può essere installata direttamente sulla schermata principale del tuo dispositivo:
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1.5 list-disc ml-4">
                        <li><strong>Android (Chrome):</strong> tocca i 3 puntini in alto a destra e seleziona <em>"Installa app"</em> o <em>"Aggiungi a schermata Home"</em>.</li>
                        <li><strong>iPad/iPhone (Safari):</strong> tocca l'icona Condividi (quadrato con freccia verso l'alto) e tocca <em>"Aggiungi alla schermata Home"</em>.</li>
                        <li><strong>Aggiornamenti:</strong> l'app si aggiorna automaticamente; puoi forzare la ricerca e l'installazione dell'ultima versione toccando il tasto <strong>"Aggiorna"</strong> direttamente dal menu <em>Impostazioni</em> o con il pulsante qui sotto.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-center">
                    <button 
                      onClick={handleForceUpdate} 
                      className="py-2.5 px-6 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all magi-press text-xs"
                    >
                      <RefreshCw className="w-4 h-4 text-blue-400" /> Cerca e Forza Aggiornamento Ora
                    </button>
                  </div>
                </div>
              )}
            </section>

          </div>

          {/* Footer */}
          <div className="mt-6 p-8 border-t border-slate-200 bg-slate-100 flex flex-col items-center text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">Diario Scolastico Locale • PWA Offline</p>
            <p className="text-xs text-slate-600 font-medium">
              MagiClass &copy; {new Date().getFullYear()} • Archiviazione 100% Locale
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GuideModal;
