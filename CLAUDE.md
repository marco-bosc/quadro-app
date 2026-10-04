# CLAUDE.md — Istruzioni per l'agente (progetto Quadro)

Leggi questo file all'inizio di ogni sessione. Rispondi e scrivi i report in italiano.

## Il progetto in breve

Quadro (nome provvisorio) è una web app per artigiani, promossa prima agli elettricisti.
È un **raccoglitore di lead**: dalla richiesta di preventivo alla gestione delle offerte.
**Non è un gestionale**: niente magazzino, acquisti, contabilità, fatturazione elettronica.
Web app in italiano, pensata prima per smartphone, usabile da desktop. Niente offline, niente app native.

## Documenti di riferimento (in ordine di autorità)

1. `docs/tasks/<incarico corrente>.md` — l'unico lavoro autorizzato in questa sessione.
2. `docs/DECISIONI.md` — decisioni prese DOPO la v0.4. Prevale sul documento di stato.
3. `docs/QUADRO_STATO_PROGETTO_v0_4.md` — perimetro, flusso, regole, architettura.

Documenti più vecchi (blueprint, pacchetto v0.2) sono solo storici. Se due fonti sono in conflitto, fermati e chiedi.

## Stack confermato

- Frontend: React + Vite + TypeScript, pubblicato su Firebase Hosting (non App Hosting).
- Dati: Cloud Firestore. Accessi: Firebase Authentication (email e password).
- Backend: poche Cloud Functions for Firebase in TypeScript, solo quando un incarico le richiede.
- File: Cloud Storage privato, solo quando un incarico lo richiede.
- Test: Vitest; regole Firestore testate con `@firebase/rules-unit-testing` sugli emulatori.

Non introdurre: Next.js, Supabase, Vercel/Netlify, ORM, librerie di stato globali, framework UI pesanti,
microservizi, backend aggiuntivi. Ogni nuova dipendenza va motivata nel report; se non è banale, chiedi prima.

## Ambiente di lavoro

- Si lavora in **GitHub Codespaces** (Node 22, Java 21, firebase-tools già installati dal devcontainer).
- Sviluppo e test **solo con gli emulatori Firebase** e dati fittizi.
- Il progetto Firebase di test è sul **piano gratuito (Spark)**: niente deploy di Functions o Storage.
  Non attivare servizi a pagamento e non modificare la fatturazione.
- Gli alias dei progetti sono in `.firebaserc` (`test`, e più avanti `prod`). Non toccare mai `prod`.
- Codespaces dal browser: per il browser `localhost` è il computer dell'utente, non il codespace.
  Se l'app deve parlare con gli emulatori, verifica come viene aperto il codespace e proponi una soluzione
  (VS Code desktop oppure proxy di Vite). Non rendere pubbliche le porte senza chiedere.

## Regole non negoziabili del preventivo

1. **Prezzo mancante ≠ zero.** Un campo vuoto resta vuoto (`null`), mai convertito in 0. Si salva una bozza incompleta, non si emette.
2. **L'AI assiste, non decide gli importi.** Mai prezzi, totali, cliente, approvazione o invio decisi dall'AI.
3. **Calcoli deterministici e interi.** Importi in centesimi, prezzi unitari in decimillesimi, quantità in millesimi (interi). Niente float per il denaro. Totali definitivi verificati sul server.
4. **Documento emesso immutabile.** All'emissione si copia lo stato dei dati; modifiche successive a cliente, impresa o logo non lo alterano.
5. **Revisione umana.** Nessuna rigenerazione cancella correzioni dell'utente senza consenso. Dati mancanti non si inventano.
6. **Nessun invio autonomo.** Aprire la condivisione non prova l'invio; inviare non prova l'accettazione.

## Sicurezza e dati

- Ogni dato appartiene a un'**azienda**. L'utente accede solo tramite un documento di appartenenza
  creato dall'amministratore (attivazione assistita). Un utente non può assegnarsi a un'azienda.
- Le Security Rules verificano l'appartenenza su ogni lettura e scrittura. Il solo login non basta.
- L'azienda A non deve poter leggere, modificare o elencare dati di B, nemmeno conoscendone gli ID.
- Salvataggio: mai conferme fittizie, mai perdita silenziosa di modifiche, mai sovrascrivere una versione più recente.
- Nel repository: niente credenziali, file `.env*` reali, dati dei clienti, backup o dipendenze generate.
  La configurazione web di Firebase va in `.env.local` (escluso da git); fornisci un `.env.example`.
- Niente dati personali nei log.

## Convenzioni di codice

- Identificatori, nomi di file e collezioni in inglese; testi dell'interfaccia in italiano.
- Struttura essenziale: `src/` (frontend), `functions/` (quando servirà), `shared/` (tipi, validazione, calcoli usati da entrambi), `tests/`, `scripts/`.
- Codice semplice e diretto: niente livelli astratti (controller, repository generici, adattatori) senza un bisogno concreto.
- Script npm da mantenere aggiornati: `dev`, `check` (lint, typecheck, build, test), `seed` (dati fittizi negli emulatori), più avanti `deploy:test`.

## Metodo di lavoro

- **Un incarico alla volta**, quello indicato in `docs/tasks/`. Non anticipare funzioni di incarichi futuri.
- Prima di scrivere codice: riassumi in poche righe cosa farai e segnala dubbi o conflitti tra documenti.
- Fai commit piccoli e frequenti con messaggi chiari. **Commit ≠ push ≠ deploy**: push solo se richiesto, deploy mai senza autorizzazione esplicita.
- Non creare risorse cloud, non inviare messaggi o email reali, non cancellare dati senza autorizzazione.
- Se qualcosa non funziona dopo due tentativi ragionevoli, fermati e spiega il problema invece di aggirarlo.

## Report di fine incarico (obbligatorio)

1. Cosa è stato fatto (risultato osservabile).
2. Come provarlo, passo per passo, nel codespace.
3. Test eseguiti davvero, con esito. Non dichiarare test non eseguiti.
4. Criteri di accettazione: per ognuno, soddisfatto sì/no.
5. Problemi aperti, rischi e decisioni prese in autonomia.
6. Proposta per il passo successivo (senza implementarla).
