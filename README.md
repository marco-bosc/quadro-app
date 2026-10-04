# Quadro

Web app per artigiani (prima gli elettricisti): dalla richiesta di preventivo alla gestione delle offerte.
Istruzioni per l'agente in `CLAUDE.md`; documenti di progetto in `docs/`.

Stato: **I01 — Base funzionante** (accesso, bozze minime, isolamento tra aziende).

## Stack

React + Vite + TypeScript · Firebase Authentication · Cloud Firestore · Firebase Hosting · Vitest.
In sviluppo si usano **solo gli emulatori Firebase** con dati fittizi.

## Avvio nel codespace

Il devcontainer installa Node 22, Java 21 e `firebase-tools`.

```bash
npm install
cp .env.example .env.local     # solo la prima volta; i valori fittizi vanno bene per gli emulatori
npm run dev                    # emulatori Auth, Firestore, Hosting + interfaccia emulatori + Vite
```

In un **secondo terminale**, con `npm run dev` attivo:

```bash
npm run seed                   # crea aziende, utenti e bozze di esempio negli emulatori
```

Poi apri la porta **5173** dalla scheda **Porte** di VS Code (icona del globo).

Utenti fittizi (solo emulatori):

| Azienda | Email | Password |
|---|---|---|
| Elettrica Rossi | `rossi@example.test` | `quadro-demo` |
| Impianti Bianchi | `bianchi@example.test` | `quadro-demo` |

I dati degli emulatori **si azzerano a ogni riavvio** di `npm run dev`: rilancia `npm run seed`.
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
| `npm run dev` | Emulatori (Auth, Firestore, Hosting, UI) + Vite su 0.0.0.0:5173 |
| `npm run seed` | Dati fittizi negli emulatori (richiede `npm run dev` attivo) |
| `npm test` | Tutti i test Vitest, dentro un emulatore Firestore dedicato (progetto `demo-quadro`) |
| `npm run test:rules` | Solo i test delle Security Rules |
| `npm run check` | Lint, typecheck, build e test |

`npm test` avvia un proprio emulatore sulle stesse porte: chiudi prima `npm run dev`.

## Struttura

```
src/        frontend React (pagine, accesso ai dati in src/quotes.ts)
shared/     tipi e validazione condivisi (limiti allineati a firestore.rules)
tests/      test delle regole e del salvataggio con controllo di versione
scripts/    seed degli emulatori
firestore.rules, firestore.indexes.json, firebase.json, .firebaserc
```

## Modello dati (I01)

- `memberships/{uid}` → `{ companyId, role: "owner", createdAt }` — scritta solo dagli script di amministrazione.
- `companies/{companyId}` → `{ name, createdAt }`
- `companies/{companyId}/quotes/{quoteId}` → `{ title, notes, status: "draft", version, createdBy, createdAt, updatedAt }`

Il salvataggio usa una transazione sul campo `version`; anche le regole accettano un aggiornamento
solo se `version` cresce esattamente di 1, quindi una versione più recente non viene mai sovrascritta.

## Progetti Firebase

`.firebaserc` contiene l'alias `test` (`quadro-app-test`, piano gratuito). Non serve `firebase login`
per lavorare con gli emulatori. Nessun deploy senza autorizzazione esplicita.
