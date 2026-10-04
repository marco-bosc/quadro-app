import { EMPTY_PROFILE } from '../shared/company';
import { describe, expect, it } from 'vitest';
import { createLine, createQuoteContent, createSection, type CompanySettings, type QuoteContent } from '../shared/quote';
import {
  addLine,
  addSection,
  changeLineType,
  deleteLine,
  deleteSection,
  duplicateLine,
  moveLine,
  moveSection,
  normalizeVatCodes,
  updateLine,
} from '../src/editor/contentOps';

const settings: CompanySettings = {
  ...EMPTY_PROFILE,
  taxRegime: 'ordinary',
  defaultVatCode: 'VAT10',
  hourlyRate: 320_000,
  defaultValidityText: '',
  defaultPaymentTermsText: '',
};

function sample(): QuoteContent {
  const c = createQuoteContent(settings);
  const a = createSection('A');
  const b = createSection('B');
  a.lines.push(
    { ...createLine('material', 'VAT10', settings), description: 'uno' },
    { ...createLine('material', 'VAT10', settings), description: 'due' },
    { ...createLine('material', 'VAT10', settings), description: 'tre' },
  );
  c.sections.push(a, b);
  return c;
}

const titles = (c: QuoteContent) => c.sections.map((s) => s.title);
const descriptions = (c: QuoteContent) => c.sections[0].lines.map((l) => l.description);

describe('sezioni', () => {
  it('aggiunge, sposta (senza uscire dai bordi) ed elimina, senza modificare l’originale', () => {
    const c = sample();
    const { content: added, sectionId } = addSection(c);
    expect(added.sections).toHaveLength(3);
    expect(c.sections).toHaveLength(2);
    expect(titles(moveSection(c, c.sections[1].id, -1))).toEqual(['B', 'A']);
    expect(titles(moveSection(c, c.sections[0].id, -1))).toEqual(['A', 'B']);
    expect(titles(moveSection(c, c.sections[1].id, 1))).toEqual(['A', 'B']);
    expect(deleteSection(added, sectionId).sections).toHaveLength(2);
  });
});

describe('righe', () => {
  it('nuova riga con l’aliquota predefinita del preventivo e i valori del tipo', () => {
    const c = { ...sample(), defaultVatCode: 'VAT22' as const };
    const { content, lineId } = addLine(c, c.sections[1].id, 'labor', settings);
    const line = content.sections[1].lines.find((l) => l.id === lineId)!;
    expect(line).toMatchObject({ type: 'labor', unit: 'h', unitPriceTenThousandths: 320_000, vatCode: 'VAT22', quantityMilli: null });
  });

  it('sposta su e giù, duplica sotto l’originale, elimina', () => {
    const c = sample();
    const [l1, l2] = c.sections[0].lines;
    const sid = c.sections[0].id;
    expect(descriptions(moveLine(c, sid, l2.id, -1))).toEqual(['due', 'uno', 'tre']);
    expect(descriptions(moveLine(c, sid, l1.id, -1))).toEqual(['uno', 'due', 'tre']);
    const dup = duplicateLine(c, sid, l1.id);
    expect(descriptions(dup.content)).toEqual(['uno', 'uno', 'due', 'tre']);
    expect(dup.content.sections[0].lines[1].id).toBe(dup.lineId);
    expect(dup.lineId).not.toBe(l1.id);
    expect(descriptions(deleteLine(c, sid, l2.id))).toEqual(['uno', 'tre']);
  });

  it('aggiorna una riga senza cambiarne l’identificativo', () => {
    const c = sample();
    const l = c.sections[0].lines[0];
    const next = updateLine(c, c.sections[0].id, l.id, { unitPriceTenThousandths: null, id: 'altro' });
    expect(next.sections[0].lines[0]).toMatchObject({ id: l.id, unitPriceTenThousandths: null });
  });

  it('cambio di tipo: valori iniziali solo dove la riga è vuota', () => {
    const c = sample();
    const sid = c.sections[0].id;
    const [l1, l2] = c.sections[0].lines;
    const withPrice = updateLine(c, sid, l1.id, { unitPriceTenThousandths: 500_000 });
    const labor = changeLineType(withPrice, sid, l1.id, 'labor', settings);
    expect(labor.sections[0].lines[0]).toMatchObject({ type: 'labor', unit: 'h', unitPriceTenThousandths: 500_000 });
    const lump = changeLineType(c, sid, l2.id, 'lump_sum', settings);
    expect(lump.sections[0].lines[1]).toMatchObject({ unit: 'corpo', quantityMilli: 1_000 });
  });
});

describe('adattamento al regime fiscale', () => {
  it('azienda diventata forfettaria: tutto FORF, segnalato', () => {
    const c = sample();
    const { content, changed } = normalizeVatCodes(c, 'flat_rate', 'FORF');
    expect(changed).toBe(true);
    expect(content.defaultVatCode).toBe('FORF');
    expect(content.sections[0].lines.every((l) => l.vatCode === 'FORF')).toBe(true);
  });

  it('azienda tornata ordinaria: FORF diventa l’aliquota predefinita', () => {
    const c = normalizeVatCodes(sample(), 'flat_rate', 'FORF').content;
    const { content, changed } = normalizeVatCodes(c, 'ordinary', 'VAT10');
    expect(changed).toBe(true);
    expect(content.defaultVatCode).toBe('VAT10');
    expect(content.sections[0].lines.every((l) => l.vatCode === 'VAT10')).toBe(true);
  });

  it('nessun cambiamento: stesso oggetto, nessuna segnalazione', () => {
    const c = sample();
    const result = normalizeVatCodes(c, 'ordinary', 'VAT22');
    expect(result.changed).toBe(false);
    expect(result.content).toBe(c);
  });
});
