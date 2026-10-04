// Tipi e validazione della bozza, usati dal frontend e dai test.
// I limiti devono restare allineati a firestore.rules.

export const QUOTE_TITLE_MAX = 200;
export const QUOTE_NOTES_MAX = 5000;

export type QuoteStatus = 'draft';

export interface QuoteDraftInput {
  title: string;
  notes: string;
}

/** Restituisce l'elenco dei problemi (in italiano); vuoto se la bozza è valida. */
export function validateQuoteDraft(input: QuoteDraftInput): string[] {
  const errors: string[] = [];
  if (input.title.length > QUOTE_TITLE_MAX) {
    errors.push(`Il titolo può avere al massimo ${QUOTE_TITLE_MAX} caratteri.`);
  }
  if (input.notes.length > QUOTE_NOTES_MAX) {
    errors.push(`Le note possono avere al massimo ${QUOTE_NOTES_MAX} caratteri.`);
  }
  return errors;
}
