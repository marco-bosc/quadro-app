import { describe, expect, it } from 'vitest';
import { DECIMALS, divRoundHalfUp, formatDecimalInput, parseDecimal, toSafeNumber } from '../shared/money';

describe('divRoundHalfUp', () => {
  it('arrotonda half-up esattamente a metà', () => {
    expect(divRoundHalfUp(5n, 10n)).toBe(1n); // 0,5 → 1
    expect(divRoundHalfUp(15n, 10n)).toBe(2n); // 1,5 → 2
    expect(divRoundHalfUp(25n, 10n)).toBe(3n); // 2,5 → 3 (non "al pari")
  });

  it('tronca sotto la metà e arrotonda per eccesso sopra', () => {
    expect(divRoundHalfUp(4999n, 10000n)).toBe(0n);
    expect(divRoundHalfUp(5001n, 10000n)).toBe(1n);
    expect(divRoundHalfUp(0n, 7n)).toBe(0n);
  });

  it('rifiuta numeratore negativo e denominatore non positivo', () => {
    expect(() => divRoundHalfUp(-1n, 10n)).toThrow(RangeError);
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError);
  });
});

describe('toSafeNumber', () => {
  it('converte gli interi sicuri e rifiuta gli altri', () => {
    expect(toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});

describe('parseDecimal', () => {
  const price = (t: string) => parseDecimal(t, DECIMALS.unitPrice, 9_999_999_999);
  const qty = (t: string) => parseDecimal(t, DECIMALS.quantity, 99_999_999);

  it('campo vuoto → null, mai zero', () => {
    expect(price('')).toEqual({ ok: true, value: null });
    expect(price('   ')).toEqual({ ok: true, value: null });
  });

  it('accetta virgola e punto come separatore decimale', () => {
    expect(qty('12,5')).toEqual({ ok: true, value: 12_500 });
    expect(qty('12.5')).toEqual({ ok: true, value: 12_500 });
    expect(price('0,4567')).toEqual({ ok: true, value: 4_567 });
    expect(price('1,95')).toEqual({ ok: true, value: 19_500 });
    expect(price('85')).toEqual({ ok: true, value: 850_000 });
    expect(price(' 7,85 ')).toEqual({ ok: true, value: 78_500 });
  });

  it('zero esplicito resta zero', () => {
    expect(price('0')).toEqual({ ok: true, value: 0 });
    expect(price('0,00')).toEqual({ ok: true, value: 0 });
  });

  it('accetta il punto delle migliaia solo con la virgola decimale', () => {
    expect(price('1.234,56')).toEqual({ ok: true, value: 12_345_600 });
    expect(price('12.345.678,9')).toEqual({ ok: false, error: expect.any(String) }); // oltre il massimo
  });

  it('rifiuta "1.200" perché ambiguo, ma accetta "0.125"', () => {
    expect(price('1.200').ok).toBe(false);
    expect(qty('0.125')).toEqual({ ok: true, value: 125 });
  });

  it('testo non valido, negativi e troppi decimali sono errori, mai zero', () => {
    for (const text of ['abc', '-3', '1,2,3', '1e3', '€ 5', '12,', ',5', '1 000']) {
      expect(price(text).ok, text).toBe(false);
    }
    expect(price('1,23456').ok).toBe(false);
    expect(qty('1,2345').ok).toBe(false);
  });

  it('rifiuta valori oltre il massimo', () => {
    expect(qty('99999,999')).toEqual({ ok: true, value: 99_999_999 });
    expect(qty('100000').ok).toBe(false);
  });
});

describe('formatDecimalInput', () => {
  it('null → campo vuoto', () => {
    expect(formatDecimalInput(null, 4)).toBe('');
  });

  it('virgola decimale e zeri finali tolti fino al minimo', () => {
    expect(formatDecimalInput(12_500, 3)).toBe('12,5');
    expect(formatDecimalInput(1_000, 3)).toBe('1');
    expect(formatDecimalInput(4_567, 4, 2)).toBe('0,4567');
    expect(formatDecimalInput(19_500, 4, 2)).toBe('1,95');
    expect(formatDecimalInput(120_000, 4, 2)).toBe('12,00');
    expect(formatDecimalInput(0, 4, 2)).toBe('0,00');
    expect(formatDecimalInput(5, 2)).toBe('0,05');
  });

  it('andata e ritorno con parseDecimal', () => {
    for (const value of [0, 1, 5, 4_567, 19_500, 9_999_999_999]) {
      expect(parseDecimal(formatDecimalInput(value, 4, 2), 4, 9_999_999_999)).toEqual({ ok: true, value });
    }
  });
});
