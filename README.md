# Quadro

Web app per artigiani (prima gli elettricisti): dalla richiesta di preventivo alla gestione delle offerte.
Istruzioni per l'agente in `CLAUDE.md`; documenti di progetto in `docs/`.

Stato: I01 chiuso; **I02 in corso** — fatto I02-A (calcoli, modello dati, regole); da fare I02-B (interfaccia dell'editor).

## Stack

React + Vite + TypeScript · Firebase Authentication · Cloud Firestore · Firebase Hosting · Vitest.
In sviluppo si usano **solo gli emulatori Firebase** con dati fittizi.

## Avvio nel codespace

Il devcontainer installa Node 22, Java 21 e `firebase-tools`.

```bash
npm install
cp .env.example .env.local     # solo la prima volta; i valori fittizi vanno bene per gli emulatori
npm run dev                    # emulatori + dati fittizi (seed automatico) + Vite
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
| `npm test` | Tutti i test Vitest, dentro un emulatore Firestore dedicato (progetto `demo-quadro`) |
| `npm run test:rules` | Solo i test delle Security Rules |
| `npm run check` | Lint, typecheck, build e test |

`npm test` usa un emulatore separato (`firebase.test.json`, porta 8180): funziona anche con `npm run dev` acceso.

## Struttura

```
src/        frontend React (pagine, accesso ai dati in src/quotes.ts)
shared/     codice condiviso con il futuro server, senza Firebase né React:
            money.ts (arrotondamento, testo ↔ interi), vat.ts (codici IVA e diciture),
            quote.ts (modello, limiti, validazione), calc.ts (totali del preventivo)
tests/      test delle regole e del salvataggio con controllo di versione
scripts/    seed degli emulatori
firestore.rules, firestore.indexes.json, firebase.json, .firebaserc
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
