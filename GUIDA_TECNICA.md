# MAGIDARIO / MAGICLASS - GUIDA TECNICA (ARCHITETTURA 100% LOCALE)

## 1. Architettura Generale
MagiClass è una Progressive Web App (PWA) **completamente locale e autonoma**, costruita con React, TypeScript, Vite e Tailwind CSS:
- **Zero dipendenze cloud:** non utilizza Firebase, Google Cloud, Google Drive, OAuth 2.0 né server remoti.
- **Zero trasmissione dati:** tutti i dati didattici (classi, alunni, orario, intervalli orari, periodi provvisori, note, compiti, database compiti) restano esclusivamente sul dispositivo dell'utente.
- **Funzionamento offline completo:** tutti gli asset applicativi vengono precachati dal Service Worker generato da `vite-plugin-pwa`.

## 2. Database Locale e Persistenza (`utils/localDatabase.ts`)
- **Archiviazione primaria:** database IndexedDB dedicato `magiclass_local_db` con due object store:
  - `app_state`: memorizza lo stato applicativo completo in transazioni atomiche `readwrite` con numero di revisione e schema versionato (`schemaVersion: 2`).
  - `snapshots`: conserva automaticamente fino a 5 snapshot di sicurezza (creati prima della migrazione iniziale o prima di ogni ripristino da backup).
- **Migrazione automatica senza perdita dati:** all'avvio, se `magiclass_local_db` è vuoto ma esistono dati preesistenti nelle chiavi `techdraw_*` di `localStorage`, l'app crea uno snapshot `pre_migration`, copia tutti i dati in IndexedDB e ne verifica l'avvenuta scrittura.
- **Gestione errori e quota:** gestisce `QuotaExceededError` e indisponibilità di IndexedDB con fallback locale sicuro e notifica esplicita all'utente.
- **Bonifica automatica residui cloud:** all'avvio rimuove eventuali vecchie chiavi `magiclass_google_*`, `magiclass_drive_*` e il vecchio database `magiclass_secure_vault`.

## 3. Backup e Ripristino su Disco Locale (`utils/deviceBackup.ts`, `utils/backupRestore.ts`, `components/BackupModal.tsx`)
- **Formato strutturato e verificabile (`MAGICLASS_LOCAL_BACKUP`, `schemaVersion: "2.0"`):**
  - Include impronta crittografica **SHA-256** (`integrityChecksum`) calcolata sul contenuto canonico del backup.
  - Comprende l'intero stato dell'anno scolastico attivo: orario definitivo e provvisorio, intervalli orari e durate, ricreazioni, classi e alunni, materie e gruppi di materie collegate, note/compiti per singola ora, giorni speciali, chiusure e l'intero Database Compiti.
- **Cartella locale dedicata (File System Access API):** su browser compatibili consente di selezionare una cartella sul disco (es. `MagiClass_Backup`), salvare nuovi backup verificati, elencare i backup presenti e aprirli direttamente per il ripristino.
- **Compatibilità universale:** fallback automatico tramite selettore di salvataggio/download e `<input type="file">` per tutti i browser desktop e mobile, più pulsante dedicato *"Copia trasferibile (.json)"*.
- **Protezione pre-ripristino e rollback:**
  - Verifica versione schema e integrità SHA-256 (blocca file corrotti o manomessi; mantiene piena compatibilità con i backup classici v1).
  - Mostra anteprima dettagliata dei contenuti e richiede conferma esplicita prima della sovrascrittura.
  - Crea automaticamente uno snapshot `pre_restore` prima di scrivere; in caso di errore esegue il rollback automatico e consente comunque di annullare manualmente l'ultimo ripristino.

## 4. Pubblicazione e Aggiornamento tramite GitHub Pages
Il progetto è configurato con percorsi relativi (`base: './'` in `vite.config.ts`, manifest e icone relativi) per funzionare sia su domini radice sia su sottopath di GitHub Pages (`https://<utente>.github.io/<repository>/`).

### Procedura di pubblicazione:
1. Caricare il repository su GitHub (branch `main`).
2. Nelle impostazioni del repository GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Ad ogni push sul branch `main`, il workflow `.github/workflows/deploy.yml` esegue automaticamente `npm install`, `npm run build` e pubblica la cartella `dist/` su GitHub Pages senza richiedere alcun secret o credenziale.

### Comandi locali:
- `npm install` — installa le dipendenze locali.
- `npm run dev` — avvia l'app in sviluppo su `http://localhost:3000`.
- `npm run lint` — verifica la tipizzazione TypeScript (`tsc --noEmit`).
- `npm run build` — genera il pacchetto statico PWA in `dist/`.
- `npm run preview` — verifica in locale la build di produzione.
