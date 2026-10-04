// Aritmetica intera e conversioni testo ↔ interi.
// Unità: importi in centesimi, prezzi unitari in decimillesimi di euro,
// quantità in millesimi, sconti in centesimi di punto percentuale (10% = 1000).

/** Decimali ammessi in inserimento per ciascuna unità intera. */
export const DECIMALS = {
  cents: 2,
  unitPrice: 4,
  quantity: 3,
  percent: 2,
} as const;

/**
 * Divisione intera con arrotondamento half-up (0,5 → 1), per numeratore ≥ 0 e denominatore > 0.
 * È l'unico punto in cui si arrotonda: tutti i calcoli la riusano.
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError('divRoundHalfUp: numeratore negativo o denominatore non positivo');
  }
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Converte un BigInt in number solo se è un intero sicuro; altrimenti lancia. */
export function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Valore oltre il limite degli interi sicuri');
  }
  return Number(value);
}

export type ParseResult = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Converte il testo inserito dall'utente in un intero con `decimals` cifre decimali implicite.
 * - "" (o solo spazi) → null: un campo vuoto resta vuoto, mai zero.
 * - Accetta la virgola o il punto come separatore decimale ("12,5", "12.5").
 * - Accetta il punto come separatore delle migliaia solo insieme alla virgola ("1.234,56").
 * - "1.200" è ambiguo (1200 o 1,2?): errore, non si indovina.
 * - Testo non valido, negativo o con troppi decimali: errore, mai zero né arrotondamento.
 */
export function parseDecimal(text: string, decimals: number, max: number): ParseResult {
  const raw = text.trim();
  if (raw === '') return { ok: true, value: null };

  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(raw)) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d+$/.test(raw) || /^\d+$/.test(raw)) {
    normalized = raw.replace(',', '.');
  } else if (/^\d+\.\d+$/.test(raw)) {
    const [intPart, fracPart] = raw.split('.');
    if (fracPart.length === 3 && intPart !== '0') {
      return { ok: false, error: 'Numero ambiguo: usa la virgola per i decimali (es. 1200 oppure 1,2).' };
    }
    normalized = raw;
  } else {
    return { ok: false, error: 'Inserisci un numero valido (es. 12,5).' };
  }

  const [intPart, fracPart = ''] = normalized.split('.');
  if (fracPart.length > decimals) {
    return {
      ok: false,
      error: decimals === 0 ? 'Non sono ammessi decimali.' : `Al massimo ${decimals} decimali.`,
    };
  }
  const digits = (intPart + fracPart.padEnd(decimals, '0')).replace(/^0+(?=\d)/, '');
  if (digits.length > 15) return { ok: false, error: 'Numero troppo grande.' };
  const value = Number(digits);
  if (value > max) return { ok: false, error: `Il valore massimo è ${formatDecimalInput(max, decimals)}.` };
  return { ok: true, value };
}

/**
 * Rappresentazione testuale di un intero per un campo di inserimento: virgola decimale,
 * senza separatore delle migliaia, zeri finali tolti fino a `minDecimals`.
 * null → "" (il campo resta vuoto).
 */
export function formatDecimalInput(value: number | null, decimals: number, minDecimals = 0): string {
  if (value === null) return '';
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Valore non intero o negativo');
  const s = value.toString().padStart(decimals + 1, '0');
  const intPart = s.slice(0, s.length - decimals) || '0';
  let fracPart = decimals > 0 ? s.slice(s.length - decimals) : '';
  while (fracPart.length > minDecimals && fracPart.endsWith('0')) fracPart = fracPart.slice(0, -1);
  return fracPart ? `${intPart},${fracPart}` : intPart;
}
