import { describe, expect, it } from 'vitest';
import { allocateDiscount, calculateQuote, lineAmountCents } from '../shared/calc';
import { LIMITS, type QuoteContent, type QuoteLine, type QuoteSection } from '../shared/quote';
import { VAT, type TaxRegime, type VatCode } from '../shared/vat';

let seq = 0;

/** Riga di prova: per default 1 pz × 1,00 € al 22%. */
function line(over: Partial<QuoteLine> = {}): QuoteLine {
  seq += 1;
  return {
    id: `l${seq}`,
    type: 'material',
    description: 'Riga',
    itemCode: '',
    unit: 'pz',
    quantityMilli: 1_000,
    unitPriceTenThousandths: 10_000,
    discountBp: 0,
    vatCode: 'VAT22',
    optional: false,
    ...over,
  };
}

function section(lines: QuoteLine[], id = `s${++seq}`): QuoteSection {
  return { id, title: 'Sezione', lines };
}

function quote(sections: QuoteSection[], over: Partial<QuoteContent> = {}): QuoteContent {
  return {
    title: 'Preventivo',
    notes: '',
    customer: { name: '', siteAddress: '', contact: '' },
    validityText: '',
    paymentTermsText: '',
    defaultVatCode: 'VAT22',
    finalDiscountCents: null,
    pdfDetail: 'lines',
    sections,
    ...over,
  };
}

const calc = (q: QuoteContent, regime: TaxRegime = 'ordinary') => calculateQuote(q, regime);

describe('importo riga: arrotondamento half-up al centesimo', () => {
  it('0,005 € esatti → 0,01 €', () => {
    // 1 × 0,0050 € = 0,005 €
    expect(lineAmountCents(line({ quantityMilli: 1_000, unitPriceTenThousandths: 50 }))).toBe(1);
    // 3 × 0,0035 € = 0,0105 € → 0,01 €
    expect(lineAmountCents(line({ quantityMilli: 3_000, unitPriceTenThousandths: 35 }))).toBe(1);
    // 1 × 1,2350 € con il 10% di sconto = 1,1115 € → 1,11 €
    expect(lineAmountCents(line({ unitPriceTenThousandths: 12_350, discountBp: 1_000 }))).toBe(111);
    // 2,5 × 0,1230 € = 0,3075 € → 0,31 €
    expect(lineAmountCents(line({ quantityMilli: 2_500, unitPriceTenThousandths: 1_230 }))).toBe(31);
  });

  it('appena sotto la metà si arrotonda per difetto', () => {
    // 1 × 0,0049 € → 0,00 €
    expect(lineAmountCents(line({ unitPriceTenThousandths: 49 }))).toBe(0);
    // 0,999 × 0,0050 € = 0,004995 € → 0,00 €
    expect(lineAmountCents(line({ quantityMilli: 999, unitPriceTenThousandths: 50 }))).toBe(0);
  });

  it('quantità con 3 decimali e prezzi con 4 decimali', () => {
    // 37,5 m × 0,4567 € = 17,12625 € → 17,13 €
    expect(lineAmountCents(line({ quantityMilli: 37_500, unitPriceTenThousandths: 4_567 }))).toBe(1_713);
    // 12,345 × 1,2345 € = 15,2399025 € → 15,24 €
    expect(lineAmountCents(line({ quantityMilli: 12_345, unitPriceTenThousandths: 12_345 }))).toBe(1_524);
    // 0,001 × 9.999,9999 € = 9,9999999 € → 10,00 €
    expect(lineAmountCents(line({ quantityMilli: 1, unitPriceTenThousandths: 99_999_999 }))).toBe(1_000);
  });

  it('sconto riga 0%, 100% e intermedi', () => {
    const base = { quantityMilli: 4_000, unitPriceTenThousandths: 123_750 }; // 4 × 12,375 € = 49,50 €
    expect(lineAmountCents(line({ ...base, discountBp: 0 }))).toBe(4_950);
    expect(lineAmountCents(line({ ...base, discountBp: 10_000 }))).toBe(0);
    expect(lineAmountCents(line({ ...base, discountBp: 1_000 }))).toBe(4_455); // 44,55 €
    expect(lineAmountCents(line({ ...base, discountBp: 1_250 }))).toBe(4_331); // 43,3125 € → 43,31 €
    expect(lineAmountCents(line({ ...base, discountBp: 333 }))).toBe(4_785); // 47,85165 € → 47,85 €
  });

  it('prezzo zero esplicito è un importo zero, non un prezzo mancante', () => {
    const t = calc(quote([section([line({ unitPriceTenThousandths: 0 })])]));
    expect(t.totalCents).toBe(0);
    expect(t.complete).toBe(true);
  });

  it('valori massimi senza perdita di precisione', () => {
    const max = line({ quantityMilli: LIMITS.quantityMilli, unitPriceTenThousandths: LIMITS.unitPriceTenThousandths });
    // 99.999,999 × 999.999,9999 € = 99.999.998.990,00000001 € → 9.999.999.899.000 centesimi
    expect(lineAmountCents(max)).toBe(9_999_999_899_000);
    const lines = Array.from({ length: 300 }, () => ({ ...max, id: `m${++seq}` }));
    const t = calc(quote([section(lines)]));
    expect(Number.isSafeInteger(t.totalCents)).toBe(true);
    expect(t.taxableCents).toBe(9_999_999_899_000 * 300);
  });
});

describe('IVA per codice', () => {
  it('un solo codice: IVA calcolata una volta sull’imponibile', () => {
    // 3 righe da 0,33 € → imponibile 0,99 €; IVA 22% = 0,2178 → 0,22 €
    // (per riga sarebbe 3 × 0,0726 → 3 × 0,07 = 0,21 €: deve essere calcolata sul totale del codice)
    const lines = [1, 2, 3].map(() => line({ unitPriceTenThousandths: 3_300 }));
    const t = calc(quote([section(lines)]));
    expect(t.vatGroups).toEqual([
      { code: 'VAT22', rateBp: 2200, taxableCents: 99, discountCents: 0, discountedTaxableCents: 99, vatCents: 22 },
    ]);
    expect(t.totalCents).toBe(121);
    expect(t.legends).toEqual([]);
  });

  it('IVA arrotondata half-up: 0,25 € al 22% = 0,055 → 0,06 €', () => {
    const t = calc(quote([section([line({ unitPriceTenThousandths: 2_500 })])]));
    expect(t.vatCents).toBe(6);
  });

  it('codici misti: gruppi separati nell’ordine fisso e totale coerente', () => {
    const t = calc(
      quote([
        section([line({ unitPriceTenThousandths: 1_000_000, vatCode: 'VAT10' })]), // 100,00 € al 10%
        section([
          line({ unitPriceTenThousandths: 2_000_000, vatCode: 'VAT22' }), // 200,00 € al 22%
          line({ unitPriceTenThousandths: 500_000, vatCode: 'RC_ATER' }), // 50,00 € inversione contabile
        ]),
      ]),
    );
    expect(t.vatGroups.map((g) => [g.code, g.taxableCents, g.vatCents])).toEqual([
      ['VAT22', 20_000, 4_400],
      ['VAT10', 10_000, 1_000],
      ['RC_ATER', 5_000, 0],
    ]);
    expect(t.taxableCents).toBe(35_000);
    expect(t.vatCents).toBe(5_400);
    expect(t.totalCents).toBe(40_400);
    expect(t.usedVatCodes).toEqual(['VAT22', 'VAT10', 'RC_ATER']);
    expect(t.sectionSubtotals.map((s) => s.amountCents)).toEqual([10_000, 25_000]);
  });
});

describe('sconto finale', () => {
  it('ripartito su più codici: la somma delle quote è esattamente lo sconto', () => {
    // Imponibili 200,00 (22%) / 100,00 (10%) / 50,00 (RC); totale 350,00; sconto 10,00 € = 1000 centesimi.
    // Quote esatte: 571,43 / 285,71 / 142,86 → parti intere 571 / 285 / 142 = 998, restano 2 centesimi.
    // Resti: 0,43 / 0,71 / 0,86 → i due maggiori sono RC e 10% → 571 / 286 / 143.
    const t = calc(
      quote(
        [
          section([
            line({ unitPriceTenThousandths: 2_000_000, vatCode: 'VAT22' }),
            line({ unitPriceTenThousandths: 1_000_000, vatCode: 'VAT10' }),
            line({ unitPriceTenThousandths: 500_000, vatCode: 'RC_ATER' }),
          ]),
        ],
        { finalDiscountCents: 1_000 },
      ),
    );
    expect(t.vatGroups.map((g) => [g.code, g.discountCents])).toEqual([
      ['VAT22', 571],
      ['VAT10', 286],
      ['RC_ATER', 143],
    ]);
    expect(t.vatGroups.reduce((s, g) => s + g.discountCents, 0)).toBe(1_000);
    // IVA sugli imponibili scontati: 19.429 × 22% = 4.274,38 → 4.274; 9.714 × 10% = 971,4 → 971
    expect(t.vatGroups.map((g) => g.vatCents)).toEqual([4_274, 971, 0]);
    expect(t.discountedTaxableCents).toBe(34_000);
    expect(t.totalCents).toBe(34_000 + 4_274 + 971);
  });

  it('parità di resti: vince l’imponibile maggiore, poi l’ordine dei codici', () => {
    expect(allocateDiscount([100n, 100n], 1n)).toEqual([1n, 0n]);
    expect(allocateDiscount([1n, 1n, 1n], 2n)).toEqual([1n, 1n, 0n]);
    // resti diversi: decide il resto maggiore (1·200 mod 300 = 200 > 1·100 mod 300 = 100)
    expect(allocateDiscount([100n, 200n], 1n)).toEqual([0n, 1n]);
  });

  it('la somma delle quote è sempre esatta (1000 casi deterministici)', () => {
    let x = 12345;
    const rnd = (n: number) => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % n;
    };
    for (let i = 0; i < 1000; i++) {
      const taxables = Array.from({ length: 1 + rnd(5) }, () => BigInt(rnd(1_000_000)));
      const total = taxables.reduce((a, b) => a + b, 0n);
      const discount = total === 0n ? 0n : BigInt(rnd(Number(total) + 1));
      const shares = allocateDiscount(taxables, discount);
      expect(shares.reduce((a, b) => a + b, 0n)).toBe(discount);
      shares.forEach((s, j) => expect(s <= taxables[j] && s >= 0n).toBe(true));
    }
  });

  it('sconto uguale all’imponibile: totale zero', () => {
    const t = calc(quote([section([line({ unitPriceTenThousandths: 100_000 })])], { finalDiscountCents: 1_000 }));
    expect(t.errors).toEqual([]);
    expect(t.totalCents).toBe(0);
  });

  it('sconto maggiore dell’imponibile: rifiutato, non applicato', () => {
    const t = calc(quote([section([line({ unitPriceTenThousandths: 100_000 })])], { finalDiscountCents: 1_001 }));
    expect(t.errors).toEqual(['discount-exceeds-taxable']);
    expect(t.complete).toBe(false);
    expect(t.finalDiscountCents).toBe(0);
    expect(allocateDiscount.bind(null, [10n], 11n)).toThrow(RangeError);
  });

  it('sconto con prezzi mancanti: applicato agli importi noti, totale parziale', () => {
    const t = calc(
      quote(
        [
          section([
            line({ unitPriceTenThousandths: 1_000_000 }),
            line({ unitPriceTenThousandths: null }),
          ]),
        ],
        { finalDiscountCents: 2_000 },
      ),
    );
    expect(t.partial).toBe(true);
    expect(t.discountedTaxableCents).toBe(8_000);
    // Oltre l'imponibile parziale: errore
    const over = calc(quote([section([line({ unitPriceTenThousandths: null })])], { finalDiscountCents: 1 }));
    expect(over.errors).toEqual(['discount-exceeds-taxable']);
  });
});

describe('righe escluse dai totali', () => {
  it('righe di testo e voci opzionali non entrano nei totali', () => {
    const optional = line({ unitPriceTenThousandths: 450_000, optional: true });
    const text = line({ type: 'text', description: 'I prezzi non comprendono opere murarie' });
    const t = calc(quote([section([line({ unitPriceTenThousandths: 1_000_000 }), optional, text])]));
    expect(t.taxableCents).toBe(10_000);
    expect(t.totalCents).toBe(12_200);
    // l'opzionale ha comunque il suo importo da mostrare
    expect(t.lineAmounts[optional.id]).toBe(4_500);
    expect(t.lineAmounts[text.id]).toBeUndefined();
    expect(t.complete).toBe(true);
  });
});

describe('righe incomplete', () => {
  it('prezzo mancante: importo null, totale parziale, riga da completare', () => {
    const missing = line({ unitPriceTenThousandths: null });
    const s = section([line({ unitPriceTenThousandths: 1_000_000 }), missing]);
    const t = calc(quote([s]));
    expect(t.lineAmounts[missing.id]).toBeNull();
    expect(t.partial).toBe(true);
    expect(t.complete).toBe(false);
    expect(t.incompleteLines).toEqual([
      { sectionId: s.id, lineId: missing.id, sectionIndex: 0, lineIndex: 1, optional: false, missing: ['price'] },
    ]);
    expect(t.sectionSubtotals).toEqual([{ sectionId: s.id, amountCents: 10_000, complete: false }]);
    // l'imponibile mostrato è solo quello noto: il prezzo mancante non vale zero, è segnalato
    expect(t.taxableCents).toBe(10_000);
  });

  it('quantità mancante e descrizione vuota: riga incompleta, bozza comunque calcolabile', () => {
    const l = line({ quantityMilli: null, description: '  ' });
    const t = calc(quote([section([l])]));
    expect(t.incompleteLines[0].missing).toEqual(['description', 'quantity']);
    expect(t.partial).toBe(true);
  });

  it('voce opzionale senza prezzo: blocca l’emissione ma non rende parziale il totale', () => {
    const opt = line({ unitPriceTenThousandths: null, optional: true });
    const t = calc(quote([section([line({ unitPriceTenThousandths: 1_000_000 }), opt])]));
    expect(t.partial).toBe(false);
    expect(t.complete).toBe(false);
    expect(t.incompleteLines.map((l) => [l.lineId, l.optional])).toEqual([[opt.id, true]]);
  });

  it('riga di testo vuota è da completare; con testo no', () => {
    const empty = line({ type: 'text', description: '' });
    const t = calc(quote([section([empty, line({ type: 'text', description: 'Nota' })])]));
    expect(t.incompleteLines.map((l) => [l.lineId, l.missing])).toEqual([[empty.id, ['description']]]);
    expect(t.partial).toBe(false);
  });

  it('preventivo vuoto: totale zero, completo', () => {
    const t = calc(quote([]));
    expect(t.totalCents).toBe(0);
    expect(t.vatGroups).toEqual([]);
    expect(t.complete).toBe(true);
  });
});

describe('inversione contabile e forfettario', () => {
  it.each<VatCode>(['RC_ATER', 'RC_A'])('%s: IVA zero e dicitura presente', (code) => {
    const t = calc(quote([section([line({ unitPriceTenThousandths: 1_234_500, vatCode: code })])]));
    expect(t.vatCents).toBe(0);
    expect(t.totalCents).toBe(12_345);
    expect(t.legends).toEqual([VAT[code].legend]);
    expect(t.legends[0]).toContain('[DA CONFERMARE]');
  });

  it('azienda forfettaria: tutte le righe FORF, IVA zero, dicitura presente', () => {
    // Anche righe salvate con altri codici (es. regime cambiato) diventano FORF nel calcolo.
    const t = calc(
      quote(
        [
          section([
            line({ unitPriceTenThousandths: 1_000_000, vatCode: 'VAT22' }),
            line({ unitPriceTenThousandths: 500_000, vatCode: 'VAT10' }),
          ]),
        ],
        { defaultVatCode: 'FORF', finalDiscountCents: 500 },
      ),
      'flat_rate',
    );
    expect(t.vatGroups.map((g) => g.code)).toEqual(['FORF']);
    expect(t.vatCents).toBe(0);
    expect(t.totalCents).toBe(14_500);
    expect(t.legends).toEqual([VAT.FORF.legend]);
  });

  it('azienda ordinaria con righe FORF rimaste: usano l’aliquota predefinita', () => {
    const l = line({ unitPriceTenThousandths: 1_000_000, vatCode: 'FORF' });
    const t = calc(quote([section([l])], { defaultVatCode: 'VAT10' }));
    expect(t.lineVatCodes[l.id]).toBe('VAT10');
    expect(t.vatCents).toBe(1_000);
  });
});

describe('caso realistico: rifacimento impianto cucina (calcolato a mano)', () => {
  /*
   * Sezione 1 — Quadro elettrico (IVA 10%)
   *   Differenziale 2P 40A 30mA      1 pz   ×  85,40 €            =  85,40 €
   *   Magnetotermico 1P+N 16A        4 pz   ×  12,375 € −10%      =  49,50 × 0,9 = 44,55 €
   *   Cablaggio quadro (manodopera)  3,5 h  ×  32,00 €            = 112,00 €
   *                                              imponibile 10%   = 241,95 €
   * Sezione 2 — Cucina (IVA 22%)
   *   Cavo FS17 3G1,5               37,5 m  ×   0,4567 €          =  17,12625 → 17,13 €
   *   Presa Schuko                   6 pz   ×   7,85 € −5%        =  47,10 × 0,95 = 44,745 → 44,75 €
   *   Assistenza muraria (a corpo)   1 corpo × 150,00 €           = 150,00 €
   *   [testo] I prezzi non comprendono opere murarie               (escluso)
   *   [opzionale] Punto luce esterno 1 pz × 45,00 €               (escluso)
   *                                              imponibile 22%   = 211,88 €
   * Imponibile totale 453,83 €; sconto finale 83,00 €.
   *   quota 10%: 8300 × 24195 / 45383 = 4424,97… → 4424, resto 44108
   *   quota 22%: 8300 × 21188 / 45383 = 3875,02… → 3875, resto 1275
   *   somma 8299: il centesimo mancante va al resto maggiore (10%) → 4425 / 3875
   * Imponibili scontati: 10% 241,95 − 44,25 = 197,70 €; 22% 211,88 − 38,75 = 173,13 €
   * IVA: 197,70 × 10% = 19,77 €; 173,13 × 22% = 38,0886 → 38,09 €
   * Totale: 197,70 + 173,13 + 19,77 + 38,09 = 428,69 €
   */
  const s1 = section(
    [
      line({ description: 'Differenziale 2P 40A 30mA', quantityMilli: 1_000, unitPriceTenThousandths: 854_000, vatCode: 'VAT10' }),
      line({ description: 'Magnetotermico 1P+N 16A', quantityMilli: 4_000, unitPriceTenThousandths: 123_750, discountBp: 1_000, vatCode: 'VAT10' }),
      line({ type: 'labor', unit: 'h', description: 'Cablaggio quadro', quantityMilli: 3_500, unitPriceTenThousandths: 320_000, vatCode: 'VAT10' }),
    ],
    'quadro',
  );
  const s2 = section(
    [
      line({ description: 'Cavo FS17 3G1,5', unit: 'm', quantityMilli: 37_500, unitPriceTenThousandths: 4_567 }),
      line({ description: 'Presa Schuko', quantityMilli: 6_000, unitPriceTenThousandths: 78_500, discountBp: 500 }),
      line({ type: 'lump_sum', unit: 'corpo', description: 'Assistenza muraria', quantityMilli: 1_000, unitPriceTenThousandths: 1_500_000 }),
      line({ type: 'text', description: 'I prezzi non comprendono opere murarie' }),
      line({ description: 'Punto luce esterno', optional: true, unitPriceTenThousandths: 450_000 }),
    ],
    'cucina',
  );
  const t = calc(quote([s1, s2], { finalDiscountCents: 8_300 }));

  it('importi delle righe', () => {
    expect(s1.lines.map((l) => t.lineAmounts[l.id])).toEqual([8_540, 4_455, 11_200]);
    expect(s2.lines.map((l) => t.lineAmounts[l.id])).toEqual([1_713, 4_475, 15_000, undefined, 4_500]);
  });

  it('subtotali di sezione, gruppi IVA e totale', () => {
    expect(t.sectionSubtotals).toEqual([
      { sectionId: 'quadro', amountCents: 24_195, complete: true },
      { sectionId: 'cucina', amountCents: 21_188, complete: true },
    ]);
    expect(t.vatGroups).toEqual([
      { code: 'VAT22', rateBp: 2200, taxableCents: 21_188, discountCents: 3_875, discountedTaxableCents: 17_313, vatCents: 3_809 },
      { code: 'VAT10', rateBp: 1000, taxableCents: 24_195, discountCents: 4_425, discountedTaxableCents: 19_770, vatCents: 1_977 },
    ]);
    expect(t.taxableCents).toBe(45_383);
    expect(t.finalDiscountCents).toBe(8_300);
    expect(t.discountedTaxableCents).toBe(37_083);
    expect(t.vatCents).toBe(5_786);
    expect(t.totalCents).toBe(42_869);
    expect(t.complete).toBe(true);
    expect(t.partial).toBe(false);
    expect(t.legends).toEqual([VAT.VAT10.legend]);
  });
});
