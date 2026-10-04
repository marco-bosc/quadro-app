# Quadro

Web app per artigiani (prima gli elettricisti): dalla richiesta di preventivo alla gestione delle offerte.
Istruzioni per l'agente in `CLAUDE.md`; documenti di progetto in `docs/`.

Stato: I01 e I02 chiusi; **I02b in corso** — fatti B1 (emissione e numerazione) e B2 (PDF e archiviazione); da fare B3 (revisioni e interfaccia).

## Stack

React + Vite + TypeScript · Firebase Authentication · Cloud Firestore · Firebase Hosting · Vitest.
In sviluppo si usano **solo gli emulatori Firebase** con dati fittizi.

## Avvio nel codespace

Il devcontainer installa Node 22, Java 21 e `firebase-tools`.

```bash
npm install
cp .env.example .env.local     # solo la prima volta; i valori fittizi vanno bene per gli emulatori
npm run dev                    # compila le Functions, avvia emulatori + dati fittizi (seed automatico) + Vite
```

Aspetta la riga `VITE … ready`, poi apri la porta **5173** dalla scheda **Porte** di VS Code (icona del globo).

Utenti fittizi (solo emulatori):

| Azienda | Email | Password |
|---|---|---|
| Elettrica Rossi | `rossi@example.test` | `quadro-demo` |
| Impianti Bianchi | `bianchi@example.test` | `quadro-demo` |

I dati degli emulatori **si azzerano a ogni riavvio** di `npm run dev` (anche quando il codespace va in pausa);
`npm run dev` li ricrea in automatico. Se il login risponde «Email o password non corretti» con gli utenti sopra,
controlla che nel terminale di `npm run dev` compaiano le righe `✓ Elettrica Rossi …`.
Per ripristinare i dati di esempio senza riavviare: `npm run seed` in un secondo terminale.
Il seed può mostrare un avviso `MetadataLookupWarning`: è innocuo (l'SDK cerca un ambiente Google Cloud che qui non c'è).

### Come l'app raggiunge gli emulatori (Codespaces dal browser)

Aprendo il codespace dal browser, `localhost` è il computer dell'utente, non il codespace:
il browser raggiunge solo le porte inoltrate da Codespaces, con indirizzi del tipo
`https://<nome-codespace>-5173.app.github.dev`.

Scelta: **il browser parla solo con Vite (porta 5173)**, e Vite fa da proxy verso gli emulatori
all'interno del codespace (`vite.config.ts`):

- `/identitytoolkit.googleapis.com`, `/securetoken.googleapis.com`, `/emulator` → Auth (9099)
- `/google.firestore.v1.Firestore`, `/v1/projects` → Firestore (8080)
- `/__functions/<nome>` → Functions (5001), riscritto in `/<progetto>/europe-west1/<nome>`
- `/v0` → Storage (9199); su una pagina https l'SDK di Storage viene forzato in https verso il proxy (`src/firebase.ts`)

In `src/firebase.ts` Auth e Firestore puntano all'indirizzo della pagina stessa
(Firestore con HTTPS se la pagina è in HTTPS e long polling forzato). Le porte restano **private**:
nessuna porta va resa pubblica. Funziona allo stesso modo da VS Code desktop (`http://localhost:5173`).

Con `VITE_USE_EMULATORS=true` (obbligatorio in sviluppo: altrimenti l'app si ferma con un errore)
l'app non contatta mai i servizi Firebase reali.

**Interfaccia degli emulatori** (porta 4000): utile per vedere utenti e documenti. Dal browser
alcune sezioni potrebbero non caricarsi perché l'interfaccia chiama direttamente le porte degli emulatori
(8080, 9099, 9150); in quel caso usa VS Code desktop oppure verifica i dati dall'app.

## Script

| Script | Cosa fa |
|---|---|
| `npm run dev` | Emulatori (Auth, Firestore, Hosting, UI), seed dei dati fittizi, poi Vite su 0.0.0.0:5173 |
| `npm run seed` | Ripristina i dati fittizi negli emulatori (richiede `npm run dev` attivo) |
| `npm test` | Tutti i test Vitest, su emulatori Firestore e Storage dedicati (progetto `demo-quadro`) |
| `npm run test:rules` | Solo i test delle Security Rules (Firestore e Storage) |
| `npm run check` | Lint, typecheck, build e test |

`npm test` usa emulatori separati (`firebase.test.json`, porte 8180 e 9189): funziona anche con `npm run dev` acceso.

## Interfaccia

Stile e componenti secondo `docs/DESIGN.md`: token in `src/styles/tokens.css`, font ospitati in `public/fonts/`
(Bricolage Grotesque e Instrument Sans, licenza OFL, file di licenza nella stessa cartella), componenti in `src/ui/`.
Schermate di riferimento con dati fittizi in `docs/design/screens/`.

- **Oggi** (`#/`): bozze dalla più recente, con totale o «manca N prezzi».
- **Editor** (`#/quotes/:id`): cliente, sezioni comprimibili, righe modificate in un pannello a tutto schermo,
  riepilogo con IVA per codice e diciture, condizioni. Salvataggio esplicito con controllo di versione.
- **Profilo** (`#/settings`): regime fiscale, aliquota predefinita, tariffa oraria, testi predefiniti (solo owner); Esci.

**Copia locale:** le modifiche non salvate di una bozza vengono copiate nel browser (`localStorage`, per azienda e
preventivo). Riaprendo la bozza, l'app propone di recuperarle o scartarle; la copia si cancella dopo un salvataggio riuscito.
Se il browser blocca lo storage, l'app funziona senza copia locale.

## Cloud Functions

In `functions/` (pacchetto separato, Node 22). Regione **europe-west1**, dentro la multi-regione `eur3` di Firestore
(`shared/region.ts`). Il codice di `shared/` viene compilato insieme alle Functions: server e browser usano lo stesso calcolo.

- `issueQuote`: verifica appartenenza, versione, completezza e dati di intestazione; ricalcola i totali; in una transazione
  assegna il numero (contatore `companies/{id}/counters/quotes-{anno}`, anno nel fuso Europe/Rome), congela l'istantanea
  (`shared/snapshot.ts`) e porta il preventivo a `issued` con `pdfStatus: "pending"`.
- `setNextQuoteNumber`: solo owner, solo oltre l'ultimo numero emesso dell'anno.
- Dopo l'emissione `issueQuote` genera il PDF (pdfmake, A4, font Instrument Sans e Bricolage Grotesque in `functions/fonts/`)
  solo dall'istantanea e lo salva in `companies/{id}/quotes/{quoteId}/Preventivo_2026-001.pdf`. Se fallisce: `pdfStatus: "error"`,
  il numero resta, e `regenerateQuotePdf` lo rigenera.
- Il logo (`companies/{id}/branding/logo`, PNG o JPEG fino a 1 MB, solo owner) viene **copiato nella cartella del preventivo**
  all'emissione: sostituirlo dopo non cambia i PDF già emessi.
- Bucket di Storage esplicito: `STORAGE_BUCKET` in `functions/.env.quadro-app-test` e `VITE_FIREBASE_STORAGE_BUCKET` in `.env.local`
  devono coincidere (vedi console Firebase → Storage).
- Parametro `ALLOW_UNCONFIRMED_VAT_TEXTS`: `true` nel progetto di test (`functions/.env.quadro-app-test`), `false` per default.
  Con `false` non si emettono preventivi che usano codici IVA con diciture `[DA CONFERMARE]`.

La logica è nei moduli (`issue.ts`, `numbering.ts`, `pdf/`) e viene testata sugli emulatori Firestore e Storage (`tests/functions/`),
compreso il testo dei PDF (estratto con `pdfjs-dist`; `PDF_DUMP_DIR=/cartella npm test` salva i PDF per controllarli a occhio);
`index.ts` registra solo le callable. Dopo una modifica alle Functions con `npm run dev` acceso: `npm run build:functions`
(l'emulatore ricarica il codice compilato).

## Struttura

```
src/        frontend React: pagine, editor/ (editor del preventivo), ui/ (componenti), styles/ (token)
            accesso ai dati in src/quotes.ts e src/settings.ts; copia locale in src/localDraft.ts
functions/  Cloud Functions (vedi sopra)
shared/     codice condiviso tra browser e Functions, senza Firebase né React:
            money.ts (arrotondamento, testo ↔ interi), vat.ts (codici IVA e diciture),
            quote.ts (modello, limiti, validazione), calc.ts (totali del preventivo),
            format.ts (importi, prezzi e quantità per la visualizzazione), company.ts (intestazione,
            partita IVA), numbering.ts (numero e data a Roma), snapshot.ts (istantanea), region.ts
tests/      test delle regole e del salvataggio con controllo di versione
scripts/    seed degli emulatori
firestore.rules, storage.rules, firestore.indexes.json, firebase.json, .firebaserc
```

## Modello dati

- `memberships/{uid}` → `{ companyId, role, createdAt }` — scritta solo dagli script di amministrazione.
- `companies/{companyId}` → `{ name, createdAt, settings }`; `settings` = `{ taxRegime, defaultVatCode, hourlyRate,
  defaultValidityText, defaultPaymentTermsText, version }`, modificabile solo dal ruolo `owner`.
- `companies/{companyId}/quotes/{quoteId}` → `{ title, notes, customer, validityText, paymentTermsText, defaultVatCode,
  finalDiscountCents, pdfDetail, sections, status: "draft", version, createdBy, createdAt, updatedAt }`.
  Sezioni e righe sono incorporate nel documento, così il controllo di versione resta unico. Le bozze non salvano totali:
  si calcolano con `shared/calc.ts`. Le bozze di I01 si aprono con i campi nuovi vuoti e passano al formato nuovo al primo salvataggio.

**Interi, mai decimali:** importi in centesimi, prezzi unitari in decimillesimi di euro, quantità in millesimi,
sconti in centesimi di punto (10% = 1000). Un prezzo o una quantità non inseriti sono `null`, mai 0.

**Limiti** (`LIMITS` in `shared/quote.ts`): 30 sezioni, 300 righe; quantità fino a 99.999,999; prezzo fino a 999.999,9999 €;
oggetto 200 caratteri, note 5000, descrizione riga 1000, codice articolo 50, cliente 200, luogo 300, contatto 200,
validità 500, condizioni di pagamento 1000. Con questi limiti i totali restano interi sicuri in JavaScript.

**Controllo di versione:** bozze e impostazioni si salvano in una transazione sul campo `version`; anche le regole
accettano un aggiornamento solo se `version` cresce esattamente di 1, quindi una versione più recente non viene mai sovrascritta.

**Limite delle regole:** le Security Rules non hanno cicli, quindi validano i campi di primo livello e il numero di sezioni,
ma non i campi delle singole righe. Questi li valida `shared/quote.ts` prima del salvataggio; il server li rivaliderà
all'emissione (I02b).

## Progetti Firebase

`.firebaserc` contiene l'alias `test` (`quadro-app-test`, piano gratuito). Non serve `firebase login`
per lavorare con gli emulatori. Nessun deploy senza autorizzazione esplicita.
