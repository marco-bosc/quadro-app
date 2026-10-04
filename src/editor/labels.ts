import type { QuoteTotals } from '../../shared/calc';
import type { QuoteLine } from '../../shared/quote';

export const LINE_TYPE_LABELS: Record<QuoteLine['type'], string> = {
  material: 'Materiale',
  labor: 'Manodopera',
  lump_sum: 'A corpo',
  text: 'Commento',
};

/** "manca 1 prezzo", "mancano 3 prezzi", oppure "2 righe senza importo" se mancano anche quantità. */
export function missingAmountsLabel(totals: QuoteTotals): string {
  const blocking = totals.incompleteLines.filter(
    (l) => !l.optional && (l.missing.includes('price') || l.missing.includes('quantity')),
  );
  const n = blocking.length;
  if (blocking.every((l) => !l.missing.includes('quantity'))) {
    return n === 1 ? 'manca 1 prezzo' : `mancano ${n} prezzi`;
  }
  return n === 1 ? '1 riga senza importo' : `${n} righe senza importo`;
}

