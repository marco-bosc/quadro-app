// Numero del preventivo: "2026/014" sul documento, "2026-014" nei nomi dei file.
// Anno e data sempre nel fuso Europe/Rome.

export const TIME_ZONE = 'Europe/Rome';

export interface QuoteNumber {
  year: number;
  sequence: number;
  /** 0 = originale, 1 = prima revisione, … */
  revision: number;
}

function pad(sequence: number): string {
  return String(sequence).padStart(3, '0');
}

export function displayQuoteNumber({ year, sequence, revision }: QuoteNumber): string {
  return `${year}/${pad(sequence)}${revision > 0 ? ` rev. ${revision}` : ''}`;
}

export function quoteFileName({ year, sequence, revision }: QuoteNumber): string {
  return `Preventivo_${year}-${pad(sequence)}${revision > 0 ? `_rev${revision}` : ''}.pdf`;
}

/** Data di calendario a Roma: { year: 2026, isoDate: "2026-10-04" }. */
export function romeDate(instant: Date): { year: number; isoDate: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: Number(get('year')), isoDate: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Prossimo numero dato lo stato del contatore dell'anno (documento assente = si parte da 1). */
export function nextSequence(counter: { lastIssued?: number; next?: number } | undefined): number {
  const lastIssued = counter?.lastIssued ?? 0;
  return Math.max(counter?.next ?? 1, lastIssued + 1);
}

export const MAX_SEQUENCE = 999_999;
