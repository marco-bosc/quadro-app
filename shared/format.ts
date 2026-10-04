// Formattazione per la visualizzazione, costruita dagli interi senza passare da numeri decimali.
// Separatore delle migliaia "." sempre presente (Intl it-IT non lo mette sotto le 5 cifre).

import { DECIMALS } from './money';

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Intero con `decimals` cifre implicite → "1.234,5" (zeri finali tolti fino a `minDecimals`). */
export function formatDecimal(value: number, decimals: number, minDecimals = decimals): string {
  if (!Number.isSafeInteger(value)) throw new RangeError('Valore non intero');
  const negative = value < 0;
  const s = Math.abs(value).toString().padStart(decimals + 1, '0');
  const intPart = groupThousands(s.slice(0, s.length - decimals));
  let frac = decimals > 0 ? s.slice(s.length - decimals) : '';
  while (frac.length > minDecimals && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${negative ? '−' : ''}${intPart}${frac ? `,${frac}` : ''}`;
}

/** Centesimi → "1.234,56 €" */
export function formatEuro(cents: number): string {
  return `${formatDecimal(cents, DECIMALS.cents)} €`;
}

/** Prezzo unitario in decimillesimi → da 2 a 4 decimali: "1,95", "0,4567", "12,00". */
export function formatUnitPrice(tenThousandths: number): string {
  return formatDecimal(tenThousandths, DECIMALS.unitPrice, 2);
}

/** Quantità in millesimi → fino a 3 decimali, senza zeri finali: "12,5", "1". */
export function formatQuantity(milli: number): string {
  return formatDecimal(milli, DECIMALS.quantity, 0);
}

/** Sconto in centesimi di punto → "12,5%". */
export function formatPercent(bp: number): string {
  return `${formatDecimal(bp, DECIMALS.percent, 0)}%`;
}
