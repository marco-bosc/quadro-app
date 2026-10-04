import { describe, expect, it } from 'vitest';
import { QUOTE_NOTES_MAX, QUOTE_TITLE_MAX, validateQuoteDraft } from '../shared/quote';

describe('validateQuoteDraft', () => {
  it('accetta una bozza vuota (incompleta ma salvabile)', () => {
    expect(validateQuoteDraft({ title: '', notes: '' })).toEqual([]);
  });

  it('accetta i valori al limite', () => {
    expect(validateQuoteDraft({ title: 'x'.repeat(QUOTE_TITLE_MAX), notes: 'x'.repeat(QUOTE_NOTES_MAX) })).toEqual([]);
  });

  it('segnala titolo e note oltre il limite', () => {
    const errors = validateQuoteDraft({ title: 'x'.repeat(QUOTE_TITLE_MAX + 1), notes: 'x'.repeat(QUOTE_NOTES_MAX + 1) });
    expect(errors).toHaveLength(2);
  });
});
