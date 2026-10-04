import { describe, expect, it } from 'vitest';
import { formatEuro, formatPercent, formatQuantity, formatUnitPrice } from '../shared/format';

describe('formattazione', () => {
  it('importi con due decimali e separatore delle migliaia', () => {
    expect(formatEuro(54_336)).toBe('543,36 €');
    expect(formatEuro(123_456)).toBe('1.234,56 €');
    expect(formatEuro(0)).toBe('0,00 €');
    expect(formatEuro(5)).toBe('0,05 €');
    expect(formatEuro(9_999_999_899_000)).toBe('99.999.998.990,00 €');
  });

  it('prezzi unitari da 2 a 4 decimali', () => {
    expect(formatUnitPrice(19_500)).toBe('1,95');
    expect(formatUnitPrice(4_567)).toBe('0,4567');
    expect(formatUnitPrice(120_000)).toBe('12,00');
    expect(formatUnitPrice(123_750)).toBe('12,375');
    expect(formatUnitPrice(15_000_000)).toBe('1.500,00');
  });

  it('quantità senza zeri finali', () => {
    expect(formatQuantity(12_500)).toBe('12,5');
    expect(formatQuantity(1_000)).toBe('1');
    expect(formatQuantity(37_525)).toBe('37,525');
    expect(formatQuantity(1_234_000)).toBe('1.234');
  });

  it('percentuali', () => {
    expect(formatPercent(1_000)).toBe('10%');
    expect(formatPercent(1_250)).toBe('12,5%');
  });
});
