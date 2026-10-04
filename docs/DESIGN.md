# DESIGN.md — Interfaccia di Quadro (stile «Carta e inchiostro»)

Aggiornamento: 4 ottobre 2026 · Versione 0.1  
Posizione nel repository: `docs/DESIGN.md`

Questo file descrive **come appare e come si comporta l'interfaccia**. Non autorizza lavoro:
il perimetro di ogni sessione resta quello di `docs/tasks/<incarico corrente>.md`.
Se questo file è in conflitto con l'incarico, `DECISIONI.md` o le regole del preventivo in `CLAUDE.md`, **prevalgono quelli**: fermati e segnala il conflitto.

Il riferimento visivo è la tela di design "Quadro — app per elettricisti", pagina «B · Flusso fase 1» (privata, non accessibile all'agente).
Le specifiche che contano sono quelle scritte qui; eventuali esportazioni delle schermate stanno in `docs/design/` e valgono solo come guida visiva.

---

## 1. Principi

1. **Smartphone prima di tutto.** Larghezza di riferimento 390 px. Da desktop la colonna resta centrata (max 640 px), senza layout dedicati.
2. **Si usa con una mano, in cantiere.** Aree toccabili di almeno 44 × 44 px. Le azioni principali stanno in basso, a portata di pollice.
3. **Il preventivo è un documento.** L'interfaccia richiama la carta: fondo caldo, inchiostro scuro, righe sottili al posto delle card dove è possibile. L'editor deve somigliare al PDF finale.
4. **Una sola azione primaria per schermata.** In inchiostro (`--ink`). Il blu (`--accent`) indica link, stati selezionati e l'unica azione irreversibile: **Conferma ed emetti**.
5. **L'interfaccia non mente mai.** Niente conferme di salvataggio finte, niente "0,00 €" al posto di un prezzo mancante, niente "inviato" quando si è solo aperta la condivisione.
6. **Niente decorazioni inutili.** Niente gradienti, emoji, ombre pesanti, illustrazioni o barre di stato finte.

## 2. Token

Vanno definiti una volta sola come variabili CSS in `src/styles/tokens.css`, importato in `main.tsx`.
I componenti usano solo le variabili, mai valori esadecimali sparsi.

### 2.1 Colori

| Variabile | Valore | Uso |
|---|---|---|
| `--bg` | `#F4F1EA` | Fondo dell'app (carta) |
| `--surface` | `#FFFDF8` | Campi, card, barre in basso, navigazione |
| `--surface-sunken` | `#E9E4D8` | Commenti nell'editor, fondo dell'anteprima |
| `--paper` | `#FFFFFF` | Solo il foglio del preventivo in anteprima |
| `--ink` | `#1B2433` | Testo principale, pulsante primario, linee forti |
| `--text-2` | `#3D4555` | Testo secondario, descrizioni |
| `--text-3` | `#5A6170` | Etichette, date, metadati |
| `--line` | `#D9D3C6` | Separatori tra righe |
| `--line-field` | `#CFC8B9` | Bordo di campi e chip non selezionati |
| `--line-placeholder` | `#A9A291` | Bordo tratteggiato di logo e segnaposto |
| `--accent` | `#1F3F99` | Link, numeri di sezione, selezione, «Conferma ed emetti» |
| `--accent-hover` | `#142B6B` | Hover/pressione dei link |
| `--warning` | `#A8460C` | Prezzo mancante, «Non salvato», «Esci» |

Contrasti verificati: tutti i colori del testo raggiungono almeno 4,5:1 su `--bg`, `--surface` e `--surface-sunken`
(il minimo è `--warning` su `--surface-sunken`, 4,7:1). Il testo chiaro su `--ink` è 15:1, su `--accent` 9:1.
Non introdurre nuovi colori senza aggiornare questa tabella.

Il **verde non si usa**: lo stato «Accettato» è in `--accent`. Gli stati non si distinguono solo per colore, perché il testo dell'etichetta è sempre presente.

### 2.2 Tipografia

| Ruolo | Font | Note |
|---|---|---|
| Titoli (display) | **Bricolage Grotesque** 700–800 | Titoli di pagina, nomi, sezioni del preventivo, «Totale» |
| Testo e interfaccia | **Instrument Sans** 400–700 | Tutto il resto |
| Fallback | `system-ui, sans-serif` | |

- I font vanno **ospitati nell'app** (file `.woff2` in `public/fonts/` con `@font-face`, `font-display: swap`), non caricati da Google Fonts a runtime. Così si evitano chiamate a terzi con l'IP dell'utente. Scaricare solo i pesi usati e i sottoinsiemi latini. Non serve nessuna dipendenza npm.
- Su tutti gli importi e le quantità: `font-variant-numeric: tabular-nums`.

| Token | Dimensione / interlinea | Peso | Uso |
|---|---|---|---|
| `--fs-display` | 34 px / 1.05, spaziatura −0.02em | 800 display | Titolo di pagina (Archivio, Profilo impresa) |
| `--fs-title` | 30 px / 1.1, spaziatura −0.02em | 800 display | Titolo del preventivo, nome del cliente della richiesta |
| `--fs-h2` | 20–22 px / 1.2 | 700 display | Sezioni della pagina e del preventivo |
| `--fs-body-lg` | 17 px | 600–700 | Nomi nelle liste, pulsanti primari |
| `--fs-body` | 16 px / 1.35 | 400–500 | Descrizioni delle righe. **Minimo per i campi** (sotto i 16 px iOS fa lo zoom) |
| `--fs-sm` | 14–15 px / 1.45 | 400–600 | Testo secondario, pulsanti secondari |
| `--fs-xs` | 13 px | 600–700 | Etichette, metadati |
| `--fs-label` | 12–13 px, MAIUSCOLO, spaziatura 0.08em | 700 | Intestazioni di gruppo («CLIENTE», «OTTOBRE 2026») |

### 2.3 Spaziatura, raggi, ombre

- Scala di spaziatura (px): 4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 28. Margine laterale delle schermate: **22 px**.
- Distanza tra blocchi di una pagina: 22–26 px. Tra campi di un form: 14–18 px.
- Raggi: campi `10px`; pulsanti e card `12px`; chip e filtri `999px` (pillola); foglio del PDF `4px`.
- Ombre: solo sul foglio in anteprima (`0 1px 2px rgb(27 36 51 / .12), 0 8px 24px rgb(27 36 51 / .08)`). Nessun'altra ombra.
- Bordi: `1px solid var(--line)` per separare; `1.5px` per i pulsanti con contorno; `1px solid var(--ink)` per le linee forti (sopra i dati del cliente, sopra il totale).

## 3. Struttura dell'app

```text
┌──────────────────────────────┐
│ Intestazione (solo nelle      │  ← indietro + titolo breve + azione a destra
│ schermate di dettaglio)       │
├──────────────────────────────┤
│ Contenuto scorrevole          │  padding 20–24px 22px
│                              │
├──────────────────────────────┤
│ Barra azioni (dettaglio)      │  oppure  Navigazione (schermate principali)
└──────────────────────────────┘
```

- **Navigazione principale** (Home, Archivio, Profilo, poi Richieste): barra fissa in basso, alta 68 px, sfondo `--surface`, 4 voci testuali: **Oggi · Richieste · Archivio · Profilo**. La voce attiva è in `--accent`, sottolineata (2 px, offset 6 px). Nessuna icona: le parole bastano e si leggono meglio.
- **Schermate di dettaglio** (richiesta, editor, anteprima, emesso): niente navigazione principale. Al suo posto una **barra azioni** fissa in basso.
- Le barre fisse rispettano l'area sicura: `padding-bottom: calc(20px + env(safe-area-inset-bottom))`.
- La pagina non deve mai scorrere in orizzontale. Solo i filtri dell'archivio possono scorrere in una riga (`overflow-x: auto`).

## 4. Componenti

Componenti semplici in `src/ui/`, uno per file, con CSS (modulo CSS o un file CSS per componente; nessuna libreria UI, nessun CSS-in-JS).
Realizzarli **solo quando un incarico li usa**; non costruire il catalogo in anticipo.

| Componente | Specifica |
|---|---|
| `Button` variante `primary` | Sfondo `--ink`, testo `--surface`, altezza min. 52–56 px, raggio 12, 16–17 px peso 700. Uno per schermata. |
| `Button` variante `confirm` | Come primary ma sfondo `--accent`. **Solo** per «Conferma ed emetti». |
| `Button` variante `secondary` | Trasparente, bordo 1.5px `--line` (o `--ink` se è l'alternativa principale), altezza 50–52 px. |
| `Button` variante `pill` | Altezza 44 px, raggio 999, padding 0 14px, 14 px peso 600. Per «+ Lavorazione», «+ Sezione», «Carica altri». |
| Link | `--accent`, peso 600. Usare `<a>` per la navigazione e `<button>` per le azioni. |
| `Field` | `<label>` sopra (14 px, 600) + `<input>`: altezza 48–52 px, bordo 1px `--line-field`, raggio 10, fondo `--surface`, testo 16 px. Errore: bordo e messaggio in `--warning` sotto il campo, collegato con `aria-describedby`. |
| `TextArea` | Come Field, padding 12px 14px, `resize: vertical`. |
| `Select` | `<select>` nativo con lo stile di Field. Nessun menu personalizzato. |
| `StatusPill` | Pillola con bordo 1.5px `--accent`, testo `--accent`, 13 px 700. Esempio: «Da valutare». |
| `StatusText` | Etichetta 12 px MAIUSCOLO 700, spaziatura 0.04em. Colore: `--text-3` (In attesa, Rifiutato, Emesso), `--accent` (Accettato), `--warning` (Bozza incompleta). |
| `ListRow` | `<button>` a tutta larghezza, senza sfondo, linea sopra o sotto `--line`, padding 12–14 px verticale. Griglia: titolo + importo in alto, metadati + stato in basso. |
| `DocCard` | Come ListRow ma con fondo `--surface`, bordo `--line`, raggio 10. Si usa nella Home. |
| `GroupLabel` | Etichetta di gruppo (`--fs-label`, `--text-3`), ad esempio il mese nell'archivio. |
| `Tabs` | Due o più `<button>` uguali; la scheda attiva ha il bordo inferiore 2.5px `--ink`, le altre testo `--text-3`. |
| `Segmented` | Contenitore con bordo 1.5px `--ink`, raggio 12; l'opzione attiva è piena `--ink`. `aria-pressed` su ogni pulsante. Si usa per l'esito commerciale. |
| `FilterChips` | Pillole 36 px; quella attiva è piena `--ink`, le altre `--surface` con bordo `--line-field`. |
| `SaveBar` | Barra azioni dell'editor: a sinistra lo stato di salvataggio (§5.3), a destra «Salva bozza» (primary). |
| `Placeholder` | Riquadro tratteggiato `--line-placeholder` con testo `--text-3`, per il logo mancante. |

Icone: poche, disegnate a linea (traccia 2–2.2, estremità arrotondate), SVG inline in `src/ui/icons.tsx`, con `aria-hidden="true"`.
Servono: indietro, freccia a destra, più, telefono, segnaposto mappa, ricerca, condividi, microfono (dalla fase AI).
Un pulsante con sola icona ha sempre `aria-label` in italiano.

## 5. Regole d'interfaccia del preventivo

Applicano in modo visibile le regole non negoziabili di `CLAUDE.md`.

### 5.1 Importi e quantità

- La formattazione avviene solo in visualizzazione, a partire dagli interi (centesimi, decimillesimi, millesimi). Funzioni in `shared/format.ts` con `Intl.NumberFormat('it-IT')`.
- Importi: `543,36 €` (2 decimali, separatore delle migliaia «.»).
- Prezzi unitari: si mostrano i decimali significativi, da 2 a 4 (`1,95`, `1,9500` solo se inserito così; da decidere in I02 con un esempio reale).
- Quantità: fino a 3 decimali, senza zeri finali (`12,5`, `1`).
- L'input numerico accetta sia la virgola sia il punto e usa `inputmode="decimal"`.

### 5.2 Prezzo mancante

- Un campo prezzo vuoto mostra **«prezzo da inserire»** in `--warning`, peso 700, sottolineato tratteggiato. L'importo della riga è `—`.
- Il totale non mostra mai una cifra parziale come se fosse definitiva: al posto del valore compare **«manca 1 prezzo» / «mancano N prezzi»** in `--warning`.
- L'imponibile si può mostrare con l'etichetta **«Imponibile parziale»**.
- «Anteprima» resta raggiungibile; «Conferma ed emetti» non compare finché manca un prezzo. Al suo posto un messaggio indica cosa manca, con un link alla prima riga incompleta.

### 5.3 Salvataggio (esplicito)

| Stato | Testo a sinistra della SaveBar | Colore |
|---|---|---|
| Nessuna modifica | «Salvato alle 10:58» | `--text-3` |
| Modifiche presenti | «Non salvato» | `--warning` |
| Salvataggio in corso | «Salvataggio…» (pulsante disattivato, niente doppio clic) | `--text-3` |
| Errore di rete | «Non salvato: connessione assente. Riprova.» | `--warning` |
| Conflitto di versione | Riquadro sopra la barra: «Questo preventivo è stato modificato altrove. Le tue modifiche sono ancora qui: copiale prima di ricaricare.» | `--warning` |
| Permessi | «Non hai i permessi per salvare questo documento.» | `--warning` |

- «Salvato» compare **solo** dopo la conferma del server.
- Con modifiche non salvate, il browser chiede conferma se si lascia la pagina (`beforeunload`).

### 5.4 Editor

- Ordine verticale: titolo → dati del cliente e luogo dell'intervento (due colonne, linea forte sopra) → righe → pulsanti per aggiungere → riepilogo → SaveBar.
- **Sezione:** numero in `--accent` + titolo display 20 px.
- **Lavorazione:** descrizione 16 px su una riga; sotto, `quantità unità × prezzo €` a sinistra e importo 16 px peso 700 a destra. Toccando la riga si apre la modifica.
- **Commento:** paragrafo in corsivo su `--surface-sunken`, raggio 8.
- Pulsanti per aggiungere (pillole): «+ Lavorazione» (bordo `--ink`), «+ Sezione», «+ Commento». Il pulsante «Detta» (blu, icona microfono) compare **solo** dall'incarico AI (I04, oggi sospeso).
- Riordino: da definire in I02 (trascinamento con maniglia oppure Su/Giù). Su smartphone, Su/Giù è più affidabile.
- IVA: `<select>` per singolo preventivo con le opzioni: 22%, 10%, Senza IVA (forfettario), Inversione contabile. Diciture da confermare con il commercialista.

### 5.5 Documento emesso

- Titolo con numero e data in `--accent` («N. 2026/014 · 4 ottobre 2026»).
- Nessun campo modificabile. L'unica azione di correzione è «Crea una versione corretta» (link).
- «Condividi» usa la Web Share API con il PDF; se non è disponibile, il pulsante non compare e restano «Scarica PDF» e «Apri email» (`mailto:`).
- Dopo una condivisione, il testo dice: «Ultima condivisione aperta oggi alle 11:02. Questo non conferma che il cliente l'abbia ricevuto.» Mai «Inviato».
- L'esito commerciale (In attesa / Accettato / Rifiutato) si imposta a mano con il Segmented.

## 6. Schermate

L'incarico indica quale schermata realizzare; qui c'è il contenuto atteso. I nomi delle route sono indicativi; il routing si decide nell'incarico che ne ha bisogno (nessuna libreria di routing senza motivazione).

| # | Schermata | Route indicativa | Incarico |
|---|---|---|---|
| 1 | Accesso | `/accesso` | I01 |
| 2 | Home «Oggi» | `/` | I01 (solo l'elenco delle bozze), completa in I03 |
| 3 | Scheda richiesta | `/richieste/:id` | I03 |
| 4 | Editor preventivo | `/preventivi/:id` | I01 (titolo e note), completo in I02 |
| 5 | Anteprima e conferma | `/preventivi/:id/anteprima` | I02 |
| 6 | Emesso e condivisione | `/preventivi/:id` (stato emesso) | I02 / I05 |
| 7 | Archivio (Preventivi · Clienti) | `/archivio` | I03 |
| 8 | Profilo impresa | `/profilo` | I02 (dati sul documento) |

**1 · Accesso.** Marchio «Quadro.» (display 52 px, punto in `--accent`) e sottotitolo «Dalla richiesta al preventivo, dal telefono.». Campi Email e Password (con «Mostra»), pulsante «Accedi», link «Password dimenticata?». In fondo, separato da una linea: «L'accesso viene attivato da noi durante la prova. Non hai ancora un account? Scrivici a [EMAIL ASSISTENZA].» Nessuna registrazione libera.

**2 · Home «Oggi».** In alto il nome dell'impresa e la data, poi il titolo display «N richieste da valutare» (0 → «Nessuna richiesta da valutare»). Elenco delle richieste (ListRow: nome, descrizione breve · luogo, quando), poi il link «Tutte le richieste e archiviate». Poi «Preventivi recenti» (DocCard, al massimo 3). In basso, sopra la navigazione: «Nuovo preventivo» (primary, a tutta larghezza) e un pulsante quadrato con contorno «Nuova richiesta» (`aria-label`).
*In I01:* solo il titolo «Bozze», l'elenco delle bozze dalla più recente e «Nuovo preventivo».

**3 · Scheda richiesta.** Intestazione con indietro, «Richiesta» e StatusPill dello stato. Nome (display 32 px), «Ricevuta oggi alle 9:40 · telefonata, inserita a mano». Due pulsanti: «Chiama» (`tel:`) e «Mappa». Elenco dei dati (Telefono, Luogo, Lavoro) e campo «Appunti». Barra azioni: «Archivia» (secondary) + «Prendi in carico» (primary). Dopo la presa in carico, la primary diventa «Crea preventivo»; per una richiesta archiviata, «Ripristina».

**4 · Editor.** Vedi §5.4. Intestazione: indietro, «Preventivo · bozza», link «Anteprima» a destra.
*In I01:* solo i campi Titolo e Note, più la SaveBar con tutti gli stati di §5.3.

**5 · Anteprima e conferma.** Fondo `--surface-sunken`; il foglio `--paper` riproduce il PDF: logo, dati dell'impresa, «Preventivo», «Numero assegnato alla conferma», Spett.le / Luogo intervento, titolo, tabella (Descrizione · Q.tà · Prezzo · Importo), sezioni e commenti, totali allineati a destra, note dell'impresa. Sotto il foglio, il riquadro di verifica («Tutte le righe hanno un prezzo», «Dati cliente e luogo completi») e l'avviso: «Dopo la conferma il preventivo riceve un numero e non si modifica più. Per correggerlo crei una nuova versione collegata.» Barra: «Modifica» + «Conferma ed emetti» (`confirm`), protetto dal doppio clic.

**6 · Emesso e condivisione.** Vedi §5.5. Ordine: numero e data, titolo, cliente e totale, scheda del PDF, «Invia al cliente» (Condividi, Scarica PDF, Apri email, nota sull'ultima condivisione), «Risposta del cliente» (Segmented), link «Crea una versione corretta».

**7 · Archivio.** Titolo display, Tabs «Preventivi | Clienti», campo di ricerca («Cliente, titolo o numero»), FilterChips (Tutti, Bozze, In attesa, Accettati, Rifiutati), elenco raggruppato per mese (GroupLabel + ListRow), «Carica altri» per la paginazione. Mai caricare tutto l'archivio.

**8 · Profilo impresa.** Sezione «Dati sul preventivo»: logo (Placeholder + «Carica logo»), Ragione sociale, Partita IVA, Indirizzo, Telefono + Email per risposte (due colonne), «Note in fondo al preventivo», nota «Le modifiche valgono per i nuovi preventivi. Quelli già emessi restano come sono stati inviati.» Sezione «Account»: email di accesso (sola lettura), Cambia password, Richiedi esportazione dei dati, Esci (`--warning`). SaveBar con «Salva».

## 7. Testi dell'interfaccia

- Italiano semplice, si dà del **tu**. Frasi brevi. Verbi d'azione sui pulsanti («Salva bozza», non «OK»).
- Termini fissi, da non variare: **richiesta** (non lead), **preventivo**, **bozza**, **emesso**, **lavorazione**, **sezione**, **commento**, **luogo dell'intervento**, **prendi in carico**, **archivia**.
- Date relative nelle liste («oggi», «ieri», «3 giorni fa»); data completa nei documenti («4 ottobre 2026»).
- Gli errori dicono cosa è successo e cosa fare, mai codici tecnici: «Connessione assente. Le modifiche sono ancora qui: riprova tra poco.»

## 8. Accessibilità (da verificare in ogni incarico)

- Elementi nativi: `<button>`, `<a href>`, `<input>` con `<label for>`. Mai `div` cliccabili.
- Focus visibile: `outline: 2px solid var(--accent); outline-offset: 2px` su `:focus-visible`.
- Contrasto minimo 4,5:1 (vedi §2.1). Aree toccabili ≥ 44 px.
- `lang="it"` su `<html>`. Titolo della pagina (`document.title`) per ogni schermata.
- Il testo deve restare leggibile con lo zoom del sistema al 200%: niente altezze fisse sui contenitori di testo.

## 9. Cosa non fare

- Nessuna libreria UI, di icone o di animazione. Nessun font caricato da servizi esterni.
- Nessun colore, font o raggio fuori dai token.
- Nessun autosalvataggio, nessun messaggio di successo prima della risposta del server.
- Nessuno «0,00 €» per un prezzo vuoto; nessun totale presentato come definitivo se è incompleto.
- Nessuna funzione delle fasi future nell'interfaccia (pulsante AI, agenda, firma online) senza un incarico che la preveda.
- Nessuna barra di stato o tastiera finta, nessuna emoji, nessun gradiente.

## 10. Come si aggiorna questo file

1. Le modifiche al design si fanno prima sulla tela, poi si riportano qui con una nuova versione e la data.
2. Se durante un incarico una specifica risulta impraticabile, l'agente **non la cambia da solo**: la segnala nel report (punto 5, «Problemi aperti») con la proposta.
3. Gli screenshot dell'app realizzata (in `docs/design/screens/`, senza dati reali) servono per confrontarla con la tela.
