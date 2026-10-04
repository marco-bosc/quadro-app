import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE, isValidTaxCode, isValidVatNumber, missingForIssue, validateProfile } from '../shared/company';
import { displayQuoteNumber, nextSequence, quoteFileName, romeDate } from '../shared/numbering';

describe('partita IVA', () => {
  it('accetta numeri con carattere di controllo corretto', () => {
    // 0+2+4+6+8 = 20; pari raddoppiate: 2, 6, 1 (10−9), 5 (14−9), 9 (18−9) = 23; 43 → controllo 7
    expect(isValidVatNumber('01234567897')).toBe(true);
    expect(isValidVatNumber('12345678903')).toBe(true);
  });

  it('rifiuta controllo sbagliato, lunghezze sbagliate e caratteri non numerici', () => {
    expect(isValidVatNumber('01234567890')).toBe(false);
    expect(isValidVatNumber('0123456789')).toBe(false);
    expect(isValidVatNumber('012345678970')).toBe(false);
    expect(isValidVatNumber('IT01234567897')).toBe(false);
    expect(isValidVatNumber('0123456789A')).toBe(false);
    expect(isValidVatNumber('')).toBe(false);
  });

  it('codice fiscale: 16 caratteri o 11 cifre', () => {
    expect(isValidTaxCode('RSSMRA80A01L219X')).toBe(true);
    expect(isValidTaxCode('01234567897')).toBe(true);
    expect(isValidTaxCode('RSSMRA80A01')).toBe(false);
  });
});

describe('dati di intestazione', () => {
  const complete = { ...EMPTY_PROFILE, legalName: 'Elettrica Rossi', vatNumber: '01234567897', address: 'Via dei Mille 5, Torino' };

  it('per emettere servono ragione sociale, partita IVA valida e indirizzo', () => {
    expect(missingForIssue(EMPTY_PROFILE)).toEqual(['legalName', 'vatNumber', 'address']);
    expect(missingForIssue(complete)).toEqual([]);
    expect(missingForIssue({ ...complete, vatNumber: '01234567890' })).toEqual(['vatNumber']);
    expect(missingForIssue({ ...complete, address: '  ' })).toEqual(['address']);
  });

  it('salvataggio: vuoti ammessi, valori non validi no', () => {
    expect(validateProfile(EMPTY_PROFILE)).toEqual([]);
    expect(validateProfile({ ...complete, vatNumber: '123', email: 'non-email', taxCode: 'X' }).map((i) => i.field)).toEqual([
      'vatNumber',
      'taxCode',
      'email',
    ]);
    expect(validateProfile({ ...complete, legalName: 'x'.repeat(201) }).map((i) => i.field)).toEqual(['legalName']);
  });
});

describe('numerazione', () => {
  it('formato del numero e del file, con revisione', () => {
    expect(displayQuoteNumber({ year: 2026, sequence: 14, revision: 0 })).toBe('2026/014');
    expect(displayQuoteNumber({ year: 2026, sequence: 14, revision: 1 })).toBe('2026/014 rev. 1');
    expect(displayQuoteNumber({ year: 2026, sequence: 1234, revision: 0 })).toBe('2026/1234');
    expect(quoteFileName({ year: 2026, sequence: 14, revision: 0 })).toBe('Preventivo_2026-014.pdf');
    expect(quoteFileName({ year: 2026, sequence: 14, revision: 2 })).toBe('Preventivo_2026-014_rev2.pdf');
  });

  it('anno e data nel fuso Europe/Rome, non UTC', () => {
    // 31/12/2026 23:30 UTC = 01/01/2027 00:30 a Roma (ora solare, UTC+1)
    expect(romeDate(new Date('2026-12-31T23:30:00Z'))).toEqual({ year: 2027, isoDate: '2027-01-01' });
    expect(romeDate(new Date('2026-12-31T22:59:59Z'))).toEqual({ year: 2026, isoDate: '2026-12-31' });
    // ora legale (UTC+2): 30/06 22:30 UTC = 01/07 00:30 a Roma
    expect(romeDate(new Date('2026-06-30T22:30:00Z')).isoDate).toBe('2026-07-01');
  });

  it('prossimo numero dal contatore', () => {
    expect(nextSequence(undefined)).toBe(1);
    expect(nextSequence({ lastIssued: 13, next: 14 })).toBe(14);
    expect(nextSequence({ lastIssued: 13, next: 50 })).toBe(50);
    // un "next" incoerente non può mai riportare indietro la numerazione
    expect(nextSequence({ lastIssued: 13, next: 5 })).toBe(14);
  });
});
