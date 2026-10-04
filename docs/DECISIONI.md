# Decisioni successive alla v0.4

Aggiornamento: 4 ottobre 2026. Questo file prevale su `QUADRO_STATO_PROGETTO_v0_4.md` dove sono in conflitto.

## Strumenti e ambienti

- **Agente di sviluppo:** Claude Code (prima Codex). Le istruzioni sono in `CLAUDE.md`, che sostituisce `AGENTS.md`.
- **Ambiente:** GitHub Codespaces su account personale, configurato da `.devcontainer/devcontainer.json`.
- **Firebase:** due progetti separati, test e produzione, nella stessa regione europea.
  Per ora esiste solo il progetto di test, sul piano gratuito. Il piano a consumo (Blaze),
  con avviso di budget, si attiva prima dell'incarico che richiede Cloud Functions (emissione e PDF).

## Prodotto

- **Posizionamento:** raccoglitore di lead, dalla richiesta di preventivo alla gestione delle offerte. Non un gestionale.
- **Lead resta centrale:** I03 confermato.
- **Listini Metel:** forse in futuro, non pianificati.
- **AI (I04) sospesa** fino ai risultati del test manuale con elettricisti reali, in corso in parallelo allo sviluppo.

## Preventivo

- **IVA per preventivo, non per impresa.** Opzioni previste: 22%, 10%, operazione senza IVA per regime forfettario
  (con dicitura), inversione contabile (con dicitura). Elenco e diciture da verificare con un commercialista prima di I02.
- **Importi interi:** centesimi per gli importi, decimillesimi per i prezzi unitari, millesimi per le quantità.
  Arrotondamento half-up per riga, sconto e IVA (default v0.2, da confermare prima di I02).
- **Numerazione:** contatore per azienda e anno, aggiornato in una transazione Firestore all'emissione.
- **PDF:** libreria leggera (pdfmake o pdf-lib) nella Cloud Function. Niente Chrome headless.

## Salvataggio

- Salvataggio esplicito con avviso di modifiche non salvate (confermato).
- Controllo di versione: un salvataggio fallisce, con messaggio chiaro, se nel frattempo il documento è cambiato.
- Copia locale nel browser delle modifiche non salvate, con proposta di recupero alla riapertura (da implementare in I02).

## Invio

- **Email centrale rimandata a dopo il pilota.** Nel pilota: condivisione del PDF dal dispositivo (Web Share API),
  download e link `mailto`. Brevo resta un'ipotesi per dopo.
