# Decisioni successive alla v0.4

Aggiornamento: 4 ottobre 2026 (seconda revisione, prima di I02).
Questo file prevale su `QUADRO_STATO_PROGETTO_v0_4.md` dove sono in conflitto.
Le parti segnate **DA CONFERMARE** dipendono dalla risposta del commercialista.

## Strumenti e ambienti

- **Agente di sviluppo:** Claude Code (prima Codex). Le istruzioni sono in `CLAUDE.md`, che sostituisce `AGENTS.md`.
- **Ambiente:** GitHub Codespaces su account personale, configurato da `.devcontainer/devcontainer.json`.
- **Firebase:** due progetti separati, test e produzione, nella stessa regione europea.
  Per ora esiste solo il progetto di test, sul piano gratuito. Il piano a consumo (Blaze),
  con avviso di budget, si attiva prima dell'incarico che richiede Cloud Functions (I02b: emissione e PDF).

## Prodotto

- **Posizionamento:** raccoglitore di lead, dalla richiesta di preventivo alla gestione delle offerte. Non un gestionale.
- **Lead resta centrale:** I03 confermato.
- **Listini Metel:** forse in futuro, non pianificati. Il campo codice articolo esiste già per prepararli.
- **AI (I04) sospesa** fino ai risultati del test manuale con elettricisti reali, in corso in parallelo allo sviluppo.
- **Sequenza:** I01 base → I02 editor e calcoli → I02b emissione, numerazione e PDF → valutazione dei test sul campo.

## Regime fiscale e IVA

- **Regime dell'azienda** nelle impostazioni: `ordinario` oppure `forfettario`.
  Un'azienda forfettaria non applica IVA: tutte le righe usano il codice forfettario e la scelta dell'aliquota non viene mostrata.
- **Aliquota per preventivo, modificabile per riga.** Il preventivo ha un'aliquota predefinita, copiata sulle nuove righe;
  ogni riga può cambiarla. I totali IVA si raggruppano per codice.
- **Codici previsti:**

| Codice | Aliquota | Uso | Dicitura sul documento |
|---|---|---|---|
| `VAT22` | 22% | Ordinaria | Nessuna |
| `VAT10` | 10% | Manutenzione o ristrutturazione su abitazioni | Facoltativa, testo DA CONFERMARE |
| `RC_ATER` | 0% | Installazione impianti in edifici verso soggetti IVA (art. 17 c.6 lett. a-ter DPR 633/72) | DA CONFERMARE |
| `RC_A` | 0% | Subappalto nel settore edile (art. 17 c.6 lett. a DPR 633/72) | DA CONFERMARE |
| `FORF` | 0% | Regime forfettario (L. 190/2014) | DA CONFERMARE |

- Il **4%** non è previsto ora; si aggiunge in seguito se serve.
- **Beni significativi:** nessun calcolo automatico. Nel pilota l'elettricista divide la riga a mano tra le aliquote.
- **Presentazione:** righe IVA esclusa; totale IVA inclusa ben evidente.
- I testi delle diciture stanno in un unico file di configurazione condiviso, con segnaposto chiaramente marcati finché non sono confermati.

## Calcoli e arrotondamenti

- **Unità intere:** importi in centesimi; prezzi unitari in decimillesimi di euro (4 decimali in inserimento, 2 sul PDF);
  quantità in millesimi (fino a 3 decimali); sconti in centesimi di punto percentuale (10% = 1000).
- **Importo riga** = quantità × prezzo unitario × (1 − sconto riga), arrotondato al centesimo, half-up (0,005 → 0,01).
- **Imponibile per codice IVA** = somma degli importi delle righe con quel codice.
- **Sconto finale** in euro, applicato agli imponibili prima dell'IVA. Con più codici IVA si ripartisce in proporzione agli imponibili,
  con il metodo dei resti maggiori, così che la somma delle quote sia esattamente lo sconto. Non può superare l'imponibile totale.
- **IVA** calcolata una sola volta per codice, sull'imponibile scontato, arrotondata al centesimo half-up.
- **Totale** = somma imponibili scontati + somma IVA.
- **Niente sconti in cascata.**
- **Prezzo mancante ≠ zero:** se una riga con importo non ha prezzo, il totale è segnalato come incompleto e il preventivo non può essere emesso.
- Le bozze non salvano totali: si calcolano al volo con il modulo condiviso. All'emissione (I02b) il server li ricalcola con lo stesso modulo.

## Struttura del preventivo

- **Intestazione:** oggetto; cliente come testo libero (nome, indirizzo del cantiere, contatto) finché non c'è l'anagrafica (I03);
  validità dell'offerta e condizioni di pagamento come testo, con valori predefiniti dalle impostazioni dell'azienda;
  aliquota predefinita; sconto finale; livello di dettaglio del PDF.
- **Sezioni** con titolo (es. "Quadro elettrico", "Cucina"), ordinabili.
- **Righe**, ordinabili all'interno della sezione:
  - tipo: `material`, `labor`, `lump_sum` (a corpo), `text` (solo testo, senza importo);
  - descrizione (obbligatoria);
  - codice articolo (facoltativo);
  - unità di misura da lista fissa: pz, m, h, corpo;
  - quantità; prezzo unitario (vuoto ammesso); sconto %; codice IVA;
  - flag **opzionale**: voce mostrata ma esclusa dai totali.
- **Manodopera:** tariffa oraria predefinita nelle impostazioni dell'azienda, copiata (non collegata) sulle nuove righe di manodopera e modificabile.
- **Dettaglio sul PDF**, scelto per preventivo: prezzi per riga (predefinito), solo totali per sezione, solo totale.
- **Esclusi per ora:** costo d'acquisto e ricarico, note interne per riga, sconti in cascata, aliquota 4%, automatismi sui beni significativi.

## Salvataggio

- Salvataggio esplicito con avviso di modifiche non salvate (confermato).
- Controllo di versione: un salvataggio fallisce, con messaggio chiaro, se nel frattempo il documento è cambiato.
- Copia locale nel browser delle modifiche non salvate, con proposta di recupero alla riapertura (in I02).

## Invio

- **Email centrale rimandata a dopo il pilota.** Nel pilota: condivisione del PDF dal dispositivo (Web Share API),
  download e link `mailto`. Brevo resta un'ipotesi per dopo.

## Domande aperte per il commercialista

1. Per un elettricista bastano 22%, 10%, 4%, inversione contabile e forfettario, o manca qualcosa?
2. Testo esatto delle diciture per inversione contabile (installazione impianti e subappalto edile) e per il forfettario.
3. Per i forfettari va indicato il bollo da 2 € anche sul preventivo?
4. Come conviene presentare i beni significativi in un preventivo?
5. Ritenuta del 4% per i condomini e split payment per la PA: vanno considerati nel preventivo o solo in fattura?
