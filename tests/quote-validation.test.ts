import { EMPTY_PROFILE } from '../shared/company';
import { describe, expect, it } from 'vitest';
import {
  createLine,
  createQuoteContent,
  createSection,
  DEFAULT_SETTINGS,
  LIMITS,
  parseQuoteContent,
  parseSettings,
  validateQuoteContent,
  validateSettings,
  type CompanySettings,
  type QuoteContent,
} from '../shared/quote';

const settings: CompanySettings = {
  ...EMPTY_PROFILE,
  taxRegime: 'ordinary',
  defaultVatCode: 'VAT10',
  hourlyRate: 320_000,
  defaultValidityText: '30 giorni',
  defaultPaymentTermsText: 'Bonifico a fine lavori',
};

function withLine(over: Parameters<typeof createLine>[0] = 'material'): QuoteContent {
  const content = createQuoteContent(settings);
  const section = createSection('Quadro');
  section.lines.push(createLine(over, content.defaultVatCode, settings));
  content.sections.push(section);
  return content;
}

describe('creazione', () => {
  it('nuova bozza precompilata dalle impostazioni', () => {
    const c = createQuoteContent(settings);
    expect(c).toMatchObject({
      validityText: '30 giorni',
      paymentTermsText: 'Bonifico a fine lavori',
      defaultVatCode: 'VAT10',
      finalDiscountCents: null,
      pdfDetail: 'lines',
      sections: [],
    });
    expect(createQuoteContent({ ...settings, taxRegime: 'flat_rate' }).defaultVatCode).toBe('FORF');
  });

  it('righe nuove: nessun prezzo o quantità inventati', () => {
    const material = createLine('material', 'VAT22', settings);
    expect(material).toMatchObject({ unit: 'pz', quantityMilli: null, unitPriceTenThousandths: null, discountBp: 0 });

    const labor = createLine('labor', 'VAT22', settings);
    expect(labor).toMatchObject({ unit: 'h', unitPriceTenThousandths: 320_000, quantityMilli: null });
    expect(createLine('labor', 'VAT22', { ...settings, hourlyRate: null }).unitPriceTenThousandths).toBeNull();

    expect(createLine('lump_sum', 'VAT22', settings)).toMatchObject({ unit: 'corpo', quantityMilli: 1_000 });
    expect(createLine('text', 'VAT22', settings)).toMatchObject({ type: 'text', unitPriceTenThousandths: null });
  });

  it('identificativi diversi per ogni riga e sezione', () => {
    const ids = new Set([createSection().id, createSection().id, createLine('text', 'VAT22', settings).id]);
    expect(ids.size).toBe(3);
  });
});

describe('validateQuoteContent', () => {
  it('una bozza incompleta è salvabile: prezzi, quantità e descrizioni vuote non bloccano', () => {
    expect(validateQuoteContent(withLine(), 'ordinary')).toEqual([]);
    expect(validateQuoteContent(createQuoteContent(settings), 'ordinary')).toEqual([]);
  });

  it('lunghezze massime', () => {
    const c = withLine();
    c.title = 'x'.repeat(LIMITS.title + 1);
    c.customer.siteAddress = 'x'.repeat(LIMITS.customerSiteAddress + 1);
    c.sections[0].lines[0].description = 'x'.repeat(LIMITS.description + 1);
    expect(validateQuoteContent(c, 'ordinary').map((i) => i.path)).toEqual([
      'title',
      'customer.siteAddress',
      'sections.0.lines.0.description',
    ]);
  });

  it('numeri: negativi, non interi e oltre i limiti', () => {
    const c = withLine();
    const l = c.sections[0].lines[0];
    l.quantityMilli = -1;
    l.unitPriceTenThousandths = 1.5;
    l.discountBp = 10_001;
    c.finalDiscountCents = -5;
    expect(validateQuoteContent(c, 'ordinary').map((i) => i.path)).toEqual([
      'finalDiscountCents',
      'sections.0.lines.0.quantityMilli',
      'sections.0.lines.0.unitPriceTenThousandths',
      'sections.0.lines.0.discountBp',
    ]);
  });

  it('sconto riga 0% e 100% ammessi', () => {
    const c = withLine();
    c.sections[0].lines[0].discountBp = 10_000;
    expect(validateQuoteContent(c, 'ordinary')).toEqual([]);
  });

  it('codici IVA ammessi secondo il regime', () => {
    const c = withLine();
    c.sections[0].lines[0].vatCode = 'FORF';
    expect(validateQuoteContent(c, 'ordinary').map((i) => i.path)).toEqual(['sections.0.lines.0.vatCode']);

    const f = withLine();
    expect(validateQuoteContent(f, 'flat_rate').map((i) => i.path)).toEqual([
      'defaultVatCode',
      'sections.0.lines.0.vatCode',
    ]);
  });

  it('limiti su sezioni e righe totali', () => {
    const c = createQuoteContent(settings);
    c.sections = Array.from({ length: LIMITS.sections + 1 }, () => createSection());
    expect(validateQuoteContent(c, 'ordinary').map((i) => i.path)).toEqual(['sections']);

    const d = createQuoteContent(settings);
    d.sections = [createSection(), createSection()];
    for (let i = 0; i <= LIMITS.lines; i++) d.sections[i % 2].lines.push(createLine('text', 'VAT22', settings));
    expect(validateQuoteContent(d, 'ordinary').map((i) => i.path)).toEqual(['sections']);
  });

  it('identificativi duplicati', () => {
    const c = withLine();
    c.sections[0].lines.push({ ...c.sections[0].lines[0] });
    expect(validateQuoteContent(c, 'ordinary').map((i) => i.path)).toEqual(['sections.0.lines.1.id']);
  });
});

describe('parseQuoteContent', () => {
  it('bozza di I01 (solo titolo e note) diventa una bozza valida', () => {
    const c = parseQuoteContent({ title: 'Vecchia bozza', notes: 'Appunti', status: 'draft', version: 3 });
    expect(c).toEqual({
      title: 'Vecchia bozza',
      notes: 'Appunti',
      customer: { name: '', siteAddress: '', contact: '' },
      validityText: '',
      paymentTermsText: '',
      defaultVatCode: 'VAT22',
      finalDiscountCents: null,
      pdfDetail: 'lines',
      sections: [],
    });
    expect(validateQuoteContent(c, 'ordinary')).toEqual([]);
  });

  it('prezzi e quantità mancanti o non validi restano null, mai 0', () => {
    const c = parseQuoteContent({
      sections: [
        {
          id: 's1',
          title: 'A',
          lines: [
            { id: 'a', type: 'material', unitPriceTenThousandths: null, quantityMilli: '3' },
            { id: 'b', type: 'material', unitPriceTenThousandths: 0, quantityMilli: 1000 },
          ],
        },
      ],
    });
    const [a, b] = c.sections[0].lines;
    expect(a.unitPriceTenThousandths).toBeNull();
    expect(a.quantityMilli).toBeNull();
    expect(b.unitPriceTenThousandths).toBe(0);
    expect(b.quantityMilli).toBe(1_000);
  });

  it('andata e ritorno senza perdite', () => {
    const c = withLine('labor');
    c.finalDiscountCents = 1_000;
    expect(parseQuoteContent(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
});

describe('impostazioni', () => {
  it('valori predefiniti per le aziende di I01 senza impostazioni', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('forfettario: aliquota predefinita forzata a FORF', () => {
    expect(parseSettings({ taxRegime: 'flat_rate', defaultVatCode: 'VAT22' }).defaultVatCode).toBe('FORF');
  });

  it('validazione', () => {
    expect(validateSettings(settings)).toEqual([]);
    expect(validateSettings({ ...settings, taxRegime: 'flat_rate' }).map((i) => i.path)).toEqual(['defaultVatCode']);
    expect(validateSettings({ ...settings, hourlyRate: -1 }).map((i) => i.path)).toEqual(['hourlyRate']);
  });
});
