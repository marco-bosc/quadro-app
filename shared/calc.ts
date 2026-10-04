// Calcolo dei totali del preventivo. Funzioni pure, solo interi (BigInt per i prodotti intermedi).
// Regole: docs/DECISIONI.md, sezione "Calcoli e arrotondamenti".
//
//   importo riga  = quantità × prezzo × (1 − sconto riga), arrotondato al centesimo half-up
//   imponibile    = somma per codice IVA delle righe non opzionali e non di testo
//   sconto finale = ripartito tra i codici in proporzione agli imponibili (resti maggiori)
//   IVA           = per codice, sull'imponibile scontato, arrotondata half-up
//   totale        = imponibili scontati + IVA

import { divRoundHalfUp, toSafeNumber } from './money';
import type { QuoteContent, QuoteLine } from './quote';
import { effectiveVatCode, VAT, VAT_CODES, type TaxRegime, type VatCode } from './vat';

/** quantità (×1000) × prezzo (×10000 €) × (10000 − sconto bp) → centesimi (×100): divisore 1000·10000·10000/100 */
const LINE_DIVISOR = 1_000_000_000n;

export type MissingField = 'description' | 'quantity' | 'price';

export interface IncompleteLine {
  sectionId: string;
  lineId: string;
  /** Posizioni per costruire riferimenti leggibili ("Sezione 2, riga 3"). */
  sectionIndex: number;
  lineIndex: number;
  optional: boolean;
  missing: MissingField[];
}

export interface VatGroup {
  code: VatCode;
  rateBp: number;
  /** Imponibile prima dello sconto finale. */
  taxableCents: number;
  /** Quota dello sconto finale attribuita a questo codice. */
  discountCents: number;
  discountedTaxableCents: number;
  vatCents: number;
}

export interface SectionSubtotal {
  sectionId: string;
  /** Somma delle righe non opzionali con importo noto (IVA esclusa, prima dello sconto finale). */
  amountCents: number;
  /** false se una riga non opzionale della sezione non ha importo. */
  complete: boolean;
}

export type CalcError = 'discount-exceeds-taxable';

export interface QuoteTotals {
  /** Importo per riga (anche opzionali); null se manca quantità o prezzo; assente per le righe di testo. */
  lineAmounts: Record<string, number | null>;
  /** Codice IVA effettivo per riga, secondo il regime attuale. */
  lineVatCodes: Record<string, VatCode>;
  sectionSubtotals: SectionSubtotal[];
  /** Un gruppo per ogni codice usato da righe non opzionali con importo, nell'ordine di VAT_CODES. */
  vatGroups: VatGroup[];
  taxableCents: number;
  finalDiscountCents: number;
  discountedTaxableCents: number;
  vatCents: number;
  totalCents: number;
  /** Codici IVA presenti sul documento (anche righe opzionali o senza prezzo), per le diciture. */
  usedVatCodes: VatCode[];
  /** Diciture da mostrare sotto i totali, nell'ordine dei codici. */
  legends: string[];
  incompleteLines: IncompleteLine[];
  /** true se una riga non opzionale non ha importo: i totali non sono definitivi. */
  partial: boolean;
  errors: CalcError[];
  /** true solo se nessuna riga è incompleta (opzionali comprese) e non ci sono errori: emettibile. */
  complete: boolean;
}

export function lineAmountCents(line: QuoteLine): number | null {
  if (line.type === 'text' || line.quantityMilli === null || line.unitPriceTenThousandths === null) return null;
  const numerator =
    BigInt(line.quantityMilli) * BigInt(line.unitPriceTenThousandths) * BigInt(10_000 - line.discountBp);
  return toSafeNumber(divRoundHalfUp(numerator, LINE_DIVISOR));
}

function missingFields(line: QuoteLine): MissingField[] {
  const missing: MissingField[] = [];
  if (line.description.trim() === '') missing.push('description');
  if (line.type === 'text') return missing;
  if (line.quantityMilli === null) missing.push('quantity');
  if (line.unitPriceTenThousandths === null) missing.push('price');
  return missing;
}

/**
 * Ripartisce `discount` tra gli imponibili in proporzione, con il metodo dei resti maggiori:
 * ogni quota è floor(D·Ti/T); i centesimi restanti vanno ai resti più grandi.
 * Parità: imponibile maggiore, poi ordine fisso di VAT_CODES (l'ordine dell'array in ingresso).
 * La somma delle quote è esattamente `discount`. Richiede 0 ≤ discount ≤ somma degli imponibili.
 */
export function allocateDiscount(taxables: bigint[], discount: bigint): bigint[] {
  const total = taxables.reduce((a, b) => a + b, 0n);
  if (discount === 0n) return taxables.map(() => 0n);
  if (discount < 0n || discount > total) throw new RangeError('Sconto fuori dall’intervallo ammesso');
  const shares = taxables.map((t) => (discount * t) / total);
  const remainders = taxables.map((t, i) => ({ i, rest: (discount * t) % total, taxable: t }));
  let left = discount - shares.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => {
    if (a.rest !== b.rest) return a.rest > b.rest ? -1 : 1;
    if (a.taxable !== b.taxable) return a.taxable > b.taxable ? -1 : 1;
    return a.i - b.i;
  });
  for (const r of remainders) {
    if (left === 0n) break;
    shares[r.i] += 1n;
    left -= 1n;
  }
  return shares;
}

export function calculateQuote(content: QuoteContent, regime: TaxRegime): QuoteTotals {
  const lineAmounts: Record<string, number | null> = {};
  const lineVatCodes: Record<string, VatCode> = {};
  const taxableByCode = new Map<VatCode, bigint>();
  const used = new Set<VatCode>();
  const incompleteLines: IncompleteLine[] = [];
  const sectionSubtotals: SectionSubtotal[] = [];
  let partial = false;

  content.sections.forEach((section, sectionIndex) => {
    let sectionAmount = 0n;
    let sectionComplete = true;
    section.lines.forEach((line, lineIndex) => {
      const missing = missingFields(line);
      if (missing.length > 0) {
        incompleteLines.push({
          sectionId: section.id,
          lineId: line.id,
          sectionIndex,
          lineIndex,
          optional: line.optional,
          missing,
        });
      }
      if (line.type === 'text') return;

      const code = effectiveVatCode(line.vatCode, regime, content.defaultVatCode);
      lineVatCodes[line.id] = code;
      used.add(code);
      const amount = lineAmountCents(line);
      lineAmounts[line.id] = amount;
      if (line.optional) return;

      if (amount === null) {
        partial = true;
        sectionComplete = false;
        return;
      }
      sectionAmount += BigInt(amount);
      taxableByCode.set(code, (taxableByCode.get(code) ?? 0n) + BigInt(amount));
    });
    sectionSubtotals.push({ sectionId: section.id, amountCents: toSafeNumber(sectionAmount), complete: sectionComplete });
  });

  const codes = VAT_CODES.filter((c) => taxableByCode.has(c));
  const taxables = codes.map((c) => taxableByCode.get(c)!);
  const taxable = taxables.reduce((a, b) => a + b, 0n);

  const errors: CalcError[] = [];
  let discount = BigInt(content.finalDiscountCents ?? 0);
  if (discount > taxable) {
    errors.push('discount-exceeds-taxable');
    discount = 0n;
  }
  const shares = allocateDiscount(taxables, discount);

  const vatGroups: VatGroup[] = codes.map((code, i) => {
    const discounted = taxables[i] - shares[i];
    const vat = divRoundHalfUp(discounted * BigInt(VAT[code].rateBp), 10_000n);
    return {
      code,
      rateBp: VAT[code].rateBp,
      taxableCents: toSafeNumber(taxables[i]),
      discountCents: toSafeNumber(shares[i]),
      discountedTaxableCents: toSafeNumber(discounted),
      vatCents: toSafeNumber(vat),
    };
  });

  const discountedTaxable = taxable - discount;
  const vatTotal = vatGroups.reduce((sum, g) => sum + BigInt(g.vatCents), 0n);
  const usedVatCodes = VAT_CODES.filter((c) => used.has(c));

  return {
    lineAmounts,
    lineVatCodes,
    sectionSubtotals,
    vatGroups,
    taxableCents: toSafeNumber(taxable),
    finalDiscountCents: toSafeNumber(discount),
    discountedTaxableCents: toSafeNumber(discountedTaxable),
    vatCents: toSafeNumber(vatTotal),
    totalCents: toSafeNumber(discountedTaxable + vatTotal),
    usedVatCodes,
    legends: usedVatCodes.map((c) => VAT[c].legend).filter((l): l is string => l !== null),
    incompleteLines,
    partial,
    errors,
    complete: incompleteLines.length === 0 && errors.length === 0,
  };
}
