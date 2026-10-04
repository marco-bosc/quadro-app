# Stato del progetto — SaaS per artigiani e professionisti

**Versione:** 0.4 · **Aggiornamento:** 3 ottobre 2026  
**Nome provvisorio:** Quadro; marchio definitivo ancora da scegliere.  
**Destinatari:** fondatori, socio operativo e Codex.

> **Sintesi:** un solo prodotto e un solo marchio trasversale, promosso inizialmente agli elettricisti. Il nucleo è un editor di preventivi utilizzabile manualmente o con assistenza AI. Architettura e perimetro della fase 1 sono concordati; le fasi 2–3 restano una roadmap da dettagliare. Questo documento descrive decisioni e lavoro da svolgere, non funzionalità già disponibili.

**Legenda:** **Confermato** = scelta condivisa; **Previsto** = direzione futura da specificare; **Da decidere** = proposta non ancora approvata. La priorità è semplicità di sviluppo e manutenzione, non una scadenza rigida di sette giorni.

## 1. Dove siamo oggi

| Area | Stato documentato |
|---|---|
| Problema e soluzione | Flusso lead → preventivo → invio concordato. Bisogni e valore commerciale ancora da verificare con elettricisti reali. |
| Prodotto | Perimetro della fase 1 definito; funzioni future separate dal primo rilascio. |
| Architettura | React + Vite + TypeScript e Firebase; niente VPS nel progetto iniziale. |
| Documentazione | Disponibili blueprint storico, pacchetto operativo v0.2 e sintesi v0.3; questo documento consolida anche le decisioni successive sul marchio. |
| Implementazione | Nella conversazione non sono stati condivisi un repository da verificare, un rilascio funzionante o esiti di test. Non è quindi documentato il completamento di alcun incremento. |
| Validazione | Preparato un messaggio per introdurre le idee a un elettricista; non sono ancora stati riportati risultati di interviste, tester attivi o vendite. |
| Prossimo traguardo | Avviare I01 con dati fittizi e raccogliere esempi reali anonimizzati per editor e PDF. |

**Principio guida:** pochi servizi gestiti, poche dipendenze, un risultato verificabile alla volta. Il problema da evitare è la complessità del codice e dell'organizzazione del progetto, non il solo luogo in cui gira il backend.

## 2. Prodotto, pubblico e marchio

### Decisioni confermate

- **Una sola app, una sola base di codice, un solo marchio**, abbastanza ampio da servire più mestieri. Non creare oggi applicazioni duplicate per categoria.
- **Promozione verticale:** partire dagli elettricisti, con messaggi, esempi e dimostrazioni specifici. Altre categorie potranno avere pagine e contenuti dedicati senza cambiare marchio.
- **Niente promessa “per chiunque”:** l'espansione va validata su professionisti che condividono il flusso richiesta → raccolta informazioni → preventivo personalizzato.
- **Web app in italiano**, pensata prima per smartphone e utilizzabile anche da desktop. Connessione richiesta; niente modalità offline o app native nel perimetro attuale.
- **Non diventare un ERP:** niente estensione a magazzino, acquisti o contabilità di commessa.

### Nome — decisione aperta

Preferenza per nomi italiani o dal suono italiano, concreti e pronunciabili. Evitare nomi tecnologici artificiali e formule come “-ify” o “appify”.

**Nomi che l'utente ha indicato come preferiti:** Mestio, BuonLavoro, Mestia, Bottego, Preventia, Preventino, Offrilo, Vocivo.

Non esiste ancora un finalista approvato. Disponibilità di domini, usi commerciali e marchi da verificare prima dell'adozione. Le altre idee emerse nel brainstorming non costituiscono una selezione condivisa. Il nome non deve bloccare I01.

### Modello commerciale

Prima tester con attivazione assistita, poi abbonamento indicativamente intorno a **40 €/mese**. Prezzo definitivo, IVA inclusa/esclusa, quote e pagamento integrato restano da definire. Agenti WhatsApp e telefonici non sono promessi illimitati dentro quel prezzo.

## 3. Flusso funzionale congelato

### Ingressi

| Origine | Fase | Risultato |
|---|---|---|
| Telefonata o incontro gestiti dal professionista | 1 | Inserimento manuale di un lead. |
| Sopralluogo o lavoro già conosciuto | 1 | Nuovo preventivo diretto, senza lead obbligatorio. |
| Agente WhatsApp | 2 | Lead automatico con contatto e riepilogo delle informazioni raccolte. |
| Agente telefonico | 3, ultimo incremento | Lead automatico nello stesso percorso. |

### Gestione e compilazione

```text
Richiesta → Lead «Da valutare» → Apertura e lettura della scheda
                                 ├─ Archiviazione recuperabile
                                 └─ Presa in carico
                                      └─ Eventuale creazione del preventivo

Preventivo da lead ───────────┐
Preventivo diretto, senza lead ┴─→ UN SOLO EDITOR
                                 ├─ Compilazione completamente manuale
                                 ├─ Bozza AI da testo / informazioni del lead
                                 └─ Bozza AI da registrazione o file audio
                                            ↓
                         Revisione umana + inserimento dei prezzi
                                            ↓
                         Salva bozza → anteprima → conferma → PDF
                                            ↓
                            Email / condivisione manuale WhatsApp
```

Lead e preventivo sono entità separate. Si legge la scheda prima di decidere; prendere in carico non obbliga a preventivare subito. Archiviare nasconde dalla lista operativa senza cancellare. Le modalità di compilazione sono combinabili e il percorso manuale deve funzionare anche senza AI.

### Stati da non confondere

| Oggetto | Stati / eventi |
|---|---|
| Lead | Da valutare, preso in carico, archiviato. |
| Documento | Bozza, emesso. |
| Esito commerciale | In attesa, accettato, rifiutato; aggiornamento manuale nella fase 1. |
| Invio | Tentativo, esito tecnico disponibile o annotazione manuale; non implica consegna, lettura o accettazione. |

## 4. Fase 1 — Preventivazione essenziale

**Obiettivo:** un tester prepara e spedisce un preventivo reale senza configurare un listino, con il controllo completo su contenuto e prezzi.

| Ambito | Funzionalità da implementare |
|---|---|
| Accesso | Login e recupero accesso, attivazione assistita; un utente per azienda. Metodo preciso da confermare. |
| Profilo impresa | Dati aziendali, logo, contatto di risposta e impostazioni essenziali del documento. |
| Home | Nuovo preventivo, richieste da valutare e documenti recenti; niente dashboard analitica complessa. |
| Lead | Creazione manuale, contatto, riepilogo, appunti e luogo; lettura, presa in carico, archiviazione e ripristino. |
| Clienti | Anagrafica minima, scelta o inserimento del destinatario; indirizzo cliente distinto dal luogo dell'intervento. |
| Editor unico | Aggiungere, modificare, eliminare e riordinare lavorazioni, titoli di sezione e commenti. |
| Righe economiche | Descrizione, quantità anche frazionaria, unità di misura, prezzo unitario e totale. Sconto globale, IVA e riepilogo; dettagli di calcolo da chiudere. |
| AI da testo | Proporre struttura, descrizioni e quantità supportate dagli appunti; evidenziare dubbi e informazioni mancanti. Nessun prezzo automatico. |
| Voce | Registrare o caricare audio, consultare/correggere la trascrizione, ottenere la proposta nello stesso editor. Non obbligare a rileggere tutta la trascrizione prima della bozza. |
| Salvataggio | Salvare e riaprire bozze anche incomplete; proporre l'anteprima dopo il salvataggio. Segnalare chiaramente modifiche non salvate. |
| Conferma e PDF | Controllo server, dati completi e prezzi espliciti prima dell'emissione. PDF con dati impresa/cliente, lavorazioni, importi e note. |
| Email | Invio dal servizio centrale dopo il clic del professionista, PDF allegato, risposta indirizzata all'impresa. Brevo è il fornitore proposto, non definitivo. |
| WhatsApp | Condivisione manuale del file dal dispositivo; download alternativo. Nessun collegamento del numero, bot o API. |
| Archivio | Elenco preventivi e clienti, ricerca e filtri essenziali, ordinamento e paginazione; aggiornamento manuale dell'esito. |
| Operatività | Gestione errori, consumi e limiti AI; backup/ripristino; esportazione e cancellazione tramite procedure assistite. |

### Regole non negoziabili del preventivo

1. **Prezzo mancante ≠ zero.** Si salva una bozza incompleta, ma non si emette un documento definitivo senza prezzi. Un prezzo esplicitamente zero non nasce da una conversione automatica del campo vuoto.
2. **L'AI assiste, non decide gli importi.** Nella fase 1 non determina prezzi, totali, identità del cliente, approvazione o invio.
3. **Calcoli deterministici:** quantità, prezzi, sconto, IVA e totali con aritmetica esatta; importi definitivi verificati sul server.
4. **Documento storico stabile:** conservare copia dei dati usati all'emissione e del PDF. Aggiornare cliente, impresa, logo o modello non altera gli emessi.
5. **Revisione umana:** una rigenerazione AI non deve cancellare correzioni senza consenso. Dati mancanti o incerti non vanno inventati.
6. **Invii consapevoli:** aprire il menu di condivisione non prova l'invio; inviare non prova accettazione. Nessun invio autonomo dell'AI.

**Schermate previste:** accesso; home/richieste; editor; anteprima/documento; archivio/clienti; impostazioni. Il disegno grafico non è ancora approvato.

## 5. Fase 2 — Acquisizione delle richieste e riuso

**Stato:** direzione concordata; ordine, ampiezza e fornitori da definire sulla base del pilota. Ogni funzione è un incremento indipendente.

| Funzione | Perimetro previsto e limite |
|---|---|
| Storico PDF/Word | Importazione controllata, estrazione e revisione; riuso di struttura e lavorazioni. Supporto a PDF digitali, scansioni, DOCX o vecchi DOC da definire separatamente. |
| Riuso / libreria personale | Esempi pertinenti della stessa azienda e possibili voci confermate dall'utente. Non addestramento automatico né listino “imparato” senza controllo. Duplicazione e revisioni da dettagliare. |
| Agente WhatsApp | Raccogliere dati del cliente e del lavoro, creare lead «Da valutare», conservare riepilogo e permettere il passaggio umano. Prima sperimentazione con pochi tester. |
| Numero e invio WhatsApp API | Valutare numero Business esistente con Coexistence oppure numero dedicato per impresa. Attivazione, fornitore, costi e invio automatico dei documenti da verificare. Non previsto un numero centrale condiviso tra tutte le aziende. |
| Collaboratori | Eventuale secondo utente con accessi semplici, invito/revoca e autore delle modifiche; non ruoli o permessi avanzati. |
| Monetizzazione | Attivazione più autonoma e pagamenti/abbonamenti integrati; quote e prezzo da validare. Nessun fornitore di pagamento definitivo. |

**Vincolo sullo storico:** separazione per azienda; niente riuso di dati identificativi dei vecchi clienti nel nuovo preventivo. Il recupero delle lavorazioni viene prima dei suggerimenti economici. Nessuna piattaforma multi-professione configurabile da costruire anticipatamente.

## 6. Fase 3 — Recupero preventivi e assistenza telefonica

| Funzione | Perimetro previsto e limite |
|---|---|
| Promemoria / solleciti | Date configurabili, controlli dell'utente e interruzione dopo risposta, esito o intervento manuale. Canali e automazioni da specificare. |
| Rilevazione delle risposte | Da progettare: l'invio email centrale con risposta all'impresa non porta automaticamente le risposte nella dashboard. Non simulare una risposta rilevata. |
| Suggerimenti di prezzo | Eventuali proposte dallo storico aziendale con documento d'origine, data, unità e contesto verificabili; conferma del professionista. Non prezzi medi trasversali tra aziende. |
| Agente telefonico | **Ultimo incremento:** raccogliere informazioni in chiamata e creare lead nello stesso flusso, con gestione del passaggio umano da definire. |

**Espansione ad altri mestieri:** il marchio e il prodotto unico sono già una decisione; quando aprire nuove categorie e quali configurazioni servano resta da validare. Non è un prerequisito della fase 1 né richiede copie dell'app.

### Esclusioni

**Senza fase approvata:** foto/allegati generici del sopralluogo, firma o accettazione online, tracking aperture, agenda e rapportini. Non risultano autorizzati dallo scambio più recente.

**Fuori dal progetto attuale:** ERP, magazzino, acquisti, contabilità di commessa, fatturazione elettronica, app native e uso offline. Nella fase 1 gli upload previsti sono logo e audio; i PDF sono generati dall'app, non importati come storico.

## 7. Architettura confermata

| Componente | Scelta | Responsabilità |
|---|---|---|
| Frontend | **React + Vite + TypeScript** | Interfaccia nel browser; editor, richieste e archivio. |
| Hosting frontend | **Firebase Hosting**, non App Hosting | Pubblicazione dei file della build del frontend. |
| Backend | Poche **Cloud Functions for Firebase**, in TypeScript | Trascrizione/AI, conferma e numerazione, totali autorevoli, PDF e invio email. |
| Database | **Cloud Firestore** | Un database condiviso per ambiente, con isolamento logico tra aziende. |
| Accessi | **Firebase Authentication** | Identità dell'utente; autorizzazione tramite appartenenza aziendale verificata. |
| File | **Cloud Storage privato** | Audio, logo, PDF emessi e futuri documenti importati. |
| AI, trascrizione ed email | API chiamate dal backend | Segreti solo sul server. Modelli e librerie non ancora scelti definitivamente. |
| Codice | Repository privato **GitHub Free** | Codice e cronologia; non ospita l'applicazione. |
| Sviluppo | Computer del socio, con Codex ed emulatori | Modifiche e prove locali; pubblicazione esplicita successiva. |
| VPS esistente | **Non usata per questa SaaS** | Resta all'altro progetto. |

**Non previsti in questo stack:** Next.js, Supabase/PostgreSQL, Vercel/Netlify, microservizi, framework multiagente, ORM o backend generico aggiuntivo.

### Responsabilità client/server

- **Browser:** interfaccia, input e anteprima dei calcoli; lettura e salvataggio bozze tramite SDK Firebase con regole di accesso.
- **Server:** operazioni privilegiate, chiamate con segreti, emissione e invio; verifica di utente, azienda, risorse e dati economici.
- **Modulo condiviso:** tipi, validazione e calcoli effettivamente riutilizzati, senza duplicare logiche economiche.

Organizzazione indicativa del codice: `src/`, `functions/`, `shared/`, test e script necessari. È una proposta essenziale, non una struttura da espandere con livelli astratti. Una funzione concreta di salvataggio non richiede controller, servizio generico, repository astratto e adattatore.

### Modello dati da implementare progressivamente

**Aziende → appartenenze degli utenti → clienti / lead / preventivi / file / operazioni.**

L'azienda è proprietaria dei dati; l'utente è l'autore o il membro autorizzato. Un utente per azienda nella fase 1 non significa rendere azienda e utente la stessa entità. Gli identificativi di lead e cliente restano collegamenti facoltativi del preventivo; non sostituiscono la copia storica dei dati. File binari fuori dal database; query circoscritte all'azienda e archivi paginati.

## 8. Ambienti, pubblicazione e costi operativi

### Come gira l'app

**Sviluppo locale con dati fittizi → ambiente Firebase di test → produzione separata prima dei dati reali.**

Il frontend viene pubblicato su Firebase Hosting; l'app online non dipende dal computer del socio. Backend e dati rimangono nei servizi Firebase. Non spostare il frontend sulla VPS soltanto perché è già disponibile.

**Commit ≠ push ≠ deploy:** salvare spesso il codice, ma pubblicare solo quando deciso. Nessuna GitHub Action o pubblicazione automatica nella configurazione iniziale. Niente file dei clienti, credenziali, dipendenze generate o backup nel repository.

Script da creare e documentare, non ancora confermati come esistenti:

| Script previsto | Scopo |
|---|---|
| `npm run dev` | Avvio locale del frontend e degli emulatori necessari. |
| `npm run check` | Controlli del codice, build e test pertinenti. |
| `npm run deploy:test` | Pubblicazione esplicita nell'ambiente di test, con configurazioni coerenti. |

### Budget già discusso — non nuove tariffe verificate

| Scenario | Accantonamento orientativo |
|---|---|
| Piccolo pilota, nello scenario fino a circa 10 aziende | Circa **50 €/mese**. |
| 100 aziende, circa 30 preventivi per azienda/mese | Circa **150 €/mese** per il servizio base. |

Sono stime preliminari della conversazione, non costi misurati, tetti garantiti o listini aggiornati. Escludono sviluppo/Codex, assistenza, acquisizione, imposte, agenti WhatsApp/telefonici e importazioni massive. Firebase è previsto a consumo; nessun abbonamento aggiuntivo GitHub o nuova VPS nel piano iniziale.

Misurare generazioni, token, minuti audio, file, letture database, invii e assistenza. Imporre quote, paginazione e limiti ai tentativi; test ordinari con risposte simulate e chiamate AI reali mirate. Gli avvisi di spesa non vanno trattati come unico controllo.

## 9. Sicurezza, dati e affidabilità

| Vincolo | Verifica richiesta |
|---|---|
| Isolamento aziendale | A non legge, modifica, esporta o invia dati/file di B, anche conoscendone gli identificativi. |
| Autorizzazioni | Security Rules su accessi client e file; controlli espliciti anche nelle funzioni privilegiate. Il solo login non basta. |
| Accessi amministrativi | Proteggere credenziali, limitare gli amministratori e impedire l'autoassegnazione a un'altra azienda. |
| File e log | File privati; segreti fuori dal client; niente contenuti personali nei log tecnici. |
| Salvataggio | Niente conferme fittizie, perdita silenziosa di modifiche o sovrascrittura di una versione più recente. |
| Errori e richieste ripetute | Appunti salvati prima dell'AI; tentativi recuperabili; doppio clic senza doppia emissione. Invio dall'esito ambiguo da verificare, non ripetere alla cieca. |
| Importi e PDF | Test su frazioni, campi mancanti e arrotondamenti; PDF multipagina leggibile; dati emessi immutabili. |
| Ripristino | Backup di dati e file e prova effettiva di ripristino in ambiente separato. |
| Esportazione/cancellazione | Procedure assistite che includano dati collegati e file; ambito verificato prima di operazioni distruttive. |
| Prima dei dati reali | Verificare contratti, fornitori, regioni, trasferimenti, conservazione, informative e procedure applicabili. |

**Scelta progettuale:** database condiviso con isolamento aziendale, non un database per ogni cliente. Questo documento non certifica conformità legale o sicurezza implementata. Non promettere dati esclusivamente UE sulla sola base della regione del database; verificare tutti i servizi, inclusa Authentication. Nessun uso dei dati di un'azienda per alimentare l'AI di un'altra.

## 10. Step di sviluppo della fase 1

Gli incrementi sotto **non sono altre macrofasi**. La sicurezza e i test accompagnano ciascuno; non si rinviano alla fine.

| Step | Risultato da provare | Confine |
|---|---|---|
| **I01 — Base funzionante** | Due aziende fittizie isolate; accesso, creazione, salvataggio e riapertura di una bozza manuale minima. | Niente AI, PDF o invii. |
| **I02 — Preventivo manuale completo** | Editor, sezioni/commenti, quantità e calcoli; poi conferma e PDF storico. | Prima editor/calcoli, poi PDF in un incarico separato. |
| **I03 — Lead, clienti e archivio** | Richiesta manuale collegata allo stesso editor; clienti e documenti ricercabili. | Nessun secondo editor o CRM generalista. |
| **I04 — Assistenza AI** | Bozza da testo; successivamente registrazione/trascrizione e voce. | Prima test simulati, poi modello reale; nessun prezzo automatico. |
| **I05 — Invio** | Email centrale e condivisione manuale del PDF. | Due implementazioni distinte; niente API WhatsApp. |
| **I06 — Pilota** | Percorso completo su dispositivi reali, attivazione tester, procedure e consumi osservabili. | Verifica complessiva; non primo intervento di sicurezza. |

### Metodo di lavoro con Codex

Un incarico circoscritto per volta. Non autorizzare “costruisci tutta la SaaS”. Per ogni task: risultato osservabile, prove previste, implementazione minima, test effettivamente eseguiti, istruzioni di prova e problemi ancora aperti. Non iniziare lo step successivo senza chiudere quello assegnato.

Niente nuovi servizi, cambi stack, rifacimenti estranei o codice delle fasi future senza decisione esplicita. Non creare risorse a pagamento, distribuire in produzione, inviare messaggi reali o cancellare dati senza autorizzazione. Conservare punti di ripristino nel repository.

**Documenti operativi:** `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `AGENTS.md`, `README.md`. Allinearli alle decisioni successive prima di usarli come specifica di un task; il vecchio blueprint non ha pari autorità.

## 11. Validazione commerciale e prossime azioni

**Approccio alle telefonate:** introduzione molto breve delle possibilità, poi domanda aperta e silenzio per ascoltare. Le funzioni future citate nel sondaggio sono ipotesi di interesse, non promesse di disponibilità al lancio.

Domanda guida già preparata: **«Oggi qual è la cosa che ti fa perdere più tempo e che vorresti toglierti di mezzo?»**

| Azione successiva | Risultato atteso | Responsabilità proposta |
|---|---|---|
| Revisionare questo documento | Conferme e modifiche puntuali, senza riaprire tutto il progetto. | Entrambi i fondatori. |
| Parlare con potenziali tester | Bisogni raccontati spontaneamente, flusso reale, volume e strumenti usati oggi. | Fondatore sul prodotto/commerciale. |
| Raccogliere esempi | 3–5 preventivi anonimizzati e due esempi di appunti/vocali. Servono a progettare, non sono l'importatore dello storico. | Prodotto + tester. |
| Avviare I01 | Repository e ambiente locale riproducibili; bozza salvata e isolamento verificato. | Socio operativo con Codex. |
| Chiudere editor/PDF | Campi, trattamento dello sconto/IVA, precisione, numerazione e modello approvati prima di I02. | Entrambi, su documenti reali. |
| Organizzare il pilota | Proposta: 3–5 tester; accesso ai dati reali solo dopo le verifiche richieste. | Entrambi. |

**Misure del pilota:** tempo fino al PDF utilizzabile, correzioni necessarie, errori bloccanti, ritorno spontaneo, costi per preventivo e minuti di assistenza. Verificare disponibilità a pagare circa 40 €/mese. Non risultano concordate soglie numeriche definitive di successo o abbandono.

## 12. Questioni ancora aperte

| Tema | Proposta / decisione da chiudere |
|---|---|
| Nome e dominio | Selezione finale e verifiche; italiano nel tono, marchio unico. |
| Accesso | Default v0.2: email/password, verifica email e recupero; attivazione assistita. |
| Salvataggio | Default: esplicito con avviso di modifiche non salvate; niente autosalvataggio iniziale. |
| Sconto e IVA | Default: sconto percentuale globale e una sola aliquota scelta dall'impresa, solo se adatti ai documenti reali. Non una prescrizione fiscale. |
| Precisione | Default v0.2: prezzi fino a 4 decimali, quantità fino a 3, totali a 2; arrotondamento half-up per riga, sconto e IVA. Da approvare prima di I02. |
| PDF, numerazione e correzioni | Default: un modello, progressivo per azienda/anno alla conferma; correzione con nuova bozza collegata e nuovo numero, senza alterare l'originale. |
| Fornitori tecnici | Modello AI, trascrizione, libreria PDF e servizio email. Brevo con Reply-To verificato resta la proposta. |
| Limiti e conservazione | Default v0.2 non approvati: 100 blocchi, audio 5 minuti/25 MB, testo 12.000 caratteri, audio conservato 30 giorni. Quote e procedure da validare; nessuna cancellazione automatica dei preventivi concordata. |
| WhatsApp futuro | Numero, percorso Coexistence/dedicato, fornitore, condizioni d'invio, passaggio umano e sostenibilità economica. |
| Commerciale | Prezzo finale, trattamento IVA, quote, abbonamenti e moduli aggiuntivi; altre categorie da validare. |
| Collaboratori e solleciti | Quando introdurli e con quali regole; rilevazione delle risposte e stop dei promemoria da progettare. |

## 13. Provenienza e modifiche rispetto ai documenti precedenti

**Fonti interne:**

- **Conversazione:** decisioni dei fondatori, chiarimenti sullo stack, hosting, vincoli, funzionalità, marchio e modalità di intervista.
- **`QUADRO_SINTESI_PRODOTTO_ARCHITETTURA_v0.3.md`:** §§1–7, base di flusso, fasi, stack, budget e questioni aperte.
- **Pacchetto `QUADRO_AVVIO_CODEX_v0.2.zip`:** `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `AGENTS.md`, `README.md`; requisiti e default operativi, non prova di codice implementato.
- **`QUADRO_BLUEPRINT.md` v0.1:** riferimento storico, in particolare §§9–12 e 17; non specifica esecutiva corrente.

**Aggiornamenti consolidati:** marchio unico e comunicazione verticale ora confermati; nome definitivo ancora aperto; inserite preferenze di naming e stato delle interviste. Restano superati lo stack Next.js/Supabase/Vercel, il listino obbligatorio al primo accesso e la precedente roadmap del blueprint. I vecchi piani 29/49/99 euro e le relative ipotesi di mercato non costituiscono il listino o la validazione del progetto attuale.

Non sono state svolte nuove verifiche di tariffe, marchi o requisiti legali per redigere questa sintesi. Le stime rimangono ipotesi; le questioni aperte non diventano requisiti approvati soltanto perché riportate qui.

**Punto di ripartenza operativo:** I01 — creare, salvare e riaprire una bozza manuale con isolamento verificato tra due aziende fittizie; in parallelo, ascolto dei tester e raccolta degli esempi.
