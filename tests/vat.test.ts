import { describe, expect, it } from 'vitest';
import {
  allowedVatCodes,
  effectiveVatCode,
  isPlaceholderLegend,
  PLACEHOLDER_PREFIX,
  VAT,
  VAT_CODES,
} from '../shared/vat';

describe('configurazione IVA', () => {
  it('codici, aliquote e ordine fisso', () => {
    expect(VAT_CODES).toEqual(['VAT22', 'VAT10', 'RC_ATER', 'RC_A', 'FORF']);
    expect(VAT_CODES.map((c) => VAT[c].rateBp)).toEqual([2200, 1000, 0, 0, 0]);
  });

  it('le diciture non confermate sono segnaposto ben riconoscibili', () => {
    expect(VAT.VAT22.legend).toBeNull();
    for (const code of ['VAT10', 'RC_ATER', 'RC_A', 'FORF'] as const) {
      expect(VAT[code].legend?.startsWith(PLACEHOLDER_PREFIX), code).toBe(true);
      expect(isPlaceholderLegend(VAT[code].legend)).toBe(true);
    }
  });

  it('azienda forfettaria: solo FORF; ordinaria: tutti tranne FORF', () => {
    expect(allowedVatCodes('flat_rate')).toEqual(['FORF']);
    expect(allowedVatCodes('ordinary')).toEqual(['VAT22', 'VAT10', 'RC_ATER', 'RC_A']);
  });

  it('codice effettivo secondo il regime', () => {
    expect(effectiveVatCode('VAT22', 'flat_rate', 'FORF')).toBe('FORF');
    expect(effectiveVatCode('VAT10', 'ordinary', 'VAT22')).toBe('VAT10');
    expect(effectiveVatCode('FORF', 'ordinary', 'VAT10')).toBe('VAT10');
    expect(effectiveVatCode('FORF', 'ordinary', 'FORF')).toBe('VAT22');
  });
});
