import { describe, expect, it } from 'vitest';
import { createLine, createQuoteContent, createSection, DEFAULT_SETTINGS } from '../shared/quote';
import { localDraftKey, readLocalDraft, removeLocalDraft, sameContent, writeLocalDraft } from '../src/localDraft';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

class BrokenStorage extends MemoryStorage {
  getItem(): string | null {
    throw new Error('bloccato');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

function sampleContent() {
  const c = createQuoteContent(DEFAULT_SETTINGS);
  c.title = 'Impianto';
  const s = createSection('Cucina');
  s.lines.push({ ...createLine('material', 'VAT22', DEFAULT_SETTINGS), description: 'Presa', unitPriceTenThousandths: null });
  c.sections.push(s);
  return c;
}

describe('copia locale', () => {
  it('chiavi separate per azienda e preventivo', () => {
    expect(localDraftKey('A', 'q1')).not.toBe(localDraftKey('B', 'q1'));
    expect(localDraftKey('A', null)).toBe('quadro:draft:v1:A:new');
  });

  it('scrive, rilegge identico (prezzo vuoto resta null) e cancella', () => {
    const storage = new MemoryStorage();
    const key = localDraftKey('A', 'q1');
    const content = sampleContent();
    expect(writeLocalDraft(key, { baseVersion: 3, savedAt: '2026-10-04T10:00:00.000Z', content }, storage)).toBe(true);
    const read = readLocalDraft(key, storage);
    expect(read).toEqual({ baseVersion: 3, savedAt: '2026-10-04T10:00:00.000Z', content });
    expect(read?.content.sections[0].lines[0].unitPriceTenThousandths).toBeNull();
    removeLocalDraft(key, storage);
    expect(readLocalDraft(key, storage)).toBeNull();
  });

  it('dati corrotti o storage bloccato: nessuna copia, nessun errore', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', '{non json');
    expect(readLocalDraft('k', storage)).toBeNull();
    storage.setItem('k', JSON.stringify({ baseVersion: 1 }));
    expect(readLocalDraft('k', storage)).toBeNull();

    const broken = new BrokenStorage();
    expect(readLocalDraft('k', broken)).toBeNull();
    expect(writeLocalDraft('k', { baseVersion: null, savedAt: '', content: sampleContent() }, broken)).toBe(false);
    expect(readLocalDraft('k', null)).toBeNull();
  });

  it('confronto del contenuto', () => {
    const a = sampleContent();
    const b = JSON.parse(JSON.stringify(a));
    expect(sameContent(a, b)).toBe(true);
    b.sections[0].lines[0].unitPriceTenThousandths = 0;
    expect(sameContent(a, b)).toBe(false);
  });
});
