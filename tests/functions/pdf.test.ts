import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueQuoteHandler, type IssueDeps } from '../../functions/src/issue';
import { generateQuotePdf, regenerateQuotePdfHandler, type PdfDeps } from '../../functions/src/pdf/generate';
import { formatEuro } from '../../shared/format';
import { HttpsError } from '../../functions/test-support/admin';
import { createLine, createSection, type PdfDetail, type QuoteContent } from '../../shared/quote';
import type { QuoteSnapshot } from '../../shared/snapshot';
import { adminBucket, adminDb, clearAll, COMPLETE_SETTINGS, completeContent, seedCompanies, seedDraft } from './helpers';

const db = adminDb();
const bucket = adminBucket();
const OCT_4 = new Date('2026-10-04T08:00:00Z');

function deps(over: Partial<IssueDeps> = {}): IssueDeps {
  return { db, bucket, now: () => OCT_4, allowUnconfirmedVatTexts: true, ...over };
}

/** Emette e genera il PDF come fa la callable issueQuote; `render` simula un guasto della generazione. */
async function issueWithPdf(quoteId: string, render?: PdfDeps['render']) {
  const d = deps();
  const issued = await issueQuoteHandler(d, 'ownerA', { companyId: 'A', quoteId, version: 1 });
  const pdf = await generateQuotePdf({ ...d, render }, 'A', quoteId);
  return { ...issued, ...pdf };
}

async function quoteData(id: string, companyId = 'A') {
  return (await db.doc(`companies/${companyId}/quotes/${id}`).get()).data()!;
}

async function download(path: string): Promise<Buffer> {
  return (await bucket.file(path).download())[0];
}

/** Testo del PDF, pagina per pagina, con gli spazi normalizzati. */
async function pdfText(bytes: Buffer): Promise<{ pages: string[]; text: string }> {
  const doc = await getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' '),
    );
  }
  return { pages, text: pages.join(' ') };
}

/** PNG 1×1 di un colore, per provare il logo senza file esterni. */
function png(r: number, g: number, b: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0, r, g, b]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Preventivo realistico: due sezioni, IVA 22% e 10%, sconto riga, commento, voce opzionale, sconto finale.
 * Importi: quadro 85,40 + 44,55 (4 × 12,375 −10%) = 129,95 al 10%; cucina 17,13 (37,5 m × 0,4567) al 22%.
 */
function richContent(pdfDetail: PdfDetail): QuoteContent {
  const c = completeContent({ pdfDetail, finalDiscountCents: 500, title: 'Rifacimento impianto cucina' });
  c.customer = { name: 'Giulia Verdi', siteAddress: 'Via Garibaldi 12, Torino', contact: '333 000 0000' };
  c.validityText = 'Offerta valida 30 giorni.';
  c.paymentTermsText = 'Saldo a fine lavori con bonifico.';
  c.notes = 'Sopralluogo del 2 ottobre.';
  const quadro = createSection('Quadro elettrico');
  quadro.lines.push(
    { ...createLine('material', 'VAT10', COMPLETE_SETTINGS), description: 'Differenziale 2P 40A', itemCode: 'DIF2P40', quantityMilli: 1_000, unitPriceTenThousandths: 854_000 },
    { ...createLine('material', 'VAT10', COMPLETE_SETTINGS), description: 'Magnetotermico 16A', quantityMilli: 4_000, unitPriceTenThousandths: 123_750, discountBp: 1_000 },
  );
  const cucina = createSection('Cucina');
  cucina.lines.push(
    { ...createLine('material', 'VAT22', COMPLETE_SETTINGS), description: 'Cavo FS17 3G1,5', unit: 'm', quantityMilli: 37_500, unitPriceTenThousandths: 4_567 },
    { ...createLine('text', 'VAT22', COMPLETE_SETTINGS), description: 'I prezzi non comprendono opere murarie.' },
    { ...createLine('material', 'VAT22', COMPLETE_SETTINGS), description: 'Punto luce esterno', quantityMilli: 1_000, unitPriceTenThousandths: 450_000, optional: true },
  );
  c.sections = [quadro, cucina];
  return c;
}

beforeEach(async () => {
  await clearAll();
  await seedCompanies(db);
});

describe('contenuto del PDF', () => {
  async function issueRich(detail: PdfDetail) {
    await seedDraft(db, 'A', 'q1', richContent(detail));
    const result = await issueWithPdf('q1');
    expect(result.pdfStatus).toBe('ready');
    expect(result.pdfPath).toBe('companies/A/quotes/q1/Preventivo_2026-001.pdf');
    const bytes = await download(result.pdfPath!);
    // PDF_DUMP_DIR=/percorso npm test → salva i PDF per il controllo visivo
    if (process.env.PDF_DUMP_DIR) writeFileSync(`${process.env.PDF_DUMP_DIR}/preventivo-${detail}.pdf`, bytes);
    return pdfText(bytes);
  }

  it('comune a tutti i livelli: intestazione, numero, cliente, riepilogo, diciture, condizioni, firma', async () => {
    for (const detail of ['lines', 'sections', 'total'] as const) {
      await clearAll();
      await seedCompanies(db);
      const { text } = await issueRich(detail);
      for (const expected of [
        'Elettrica Rossi di Mario Rossi',
        'P. IVA 01234567897',
        'Via dei Mille 5, 10123 Torino',
        'Preventivo',
        'N. 2026/001',
        '4 ottobre 2026',
        'Giulia Verdi',
        'Via Garibaldi 12, Torino',
        'Rifacimento impianto cucina',
        'Quadro elettrico',
        'Cucina',
        'Differenziale 2P 40A',
        'I prezzi non comprendono opere murarie.',
        'Voci opzionali (non incluse nel totale)',
        'Punto luce esterno',
        '45,00 €',
        'Imponibile',
        'Sconto',
        'Totale IVA inclusa',
        '[DA CONFERMARE]',
        'Offerta valida 30 giorni.',
        'Saldo a fine lavori con bonifico.',
        'Sopralluogo del 2 ottobre.',
        'Per accettazione',
        'Firma del cliente',
        'Mario Rossi',
        'Pagina 1 di ',
      ]) {
        expect(text, `${detail}: «${expected}»`).toContain(expected);
      }
      // Il totale stampato è quello ricalcolato dal server nell'istantanea
      const snap = (await quoteData('q1')).snapshot as QuoteSnapshot;
      expect(text).toContain(formatEuro(snap.totals.totalCents));
    }
  });

  it('dettaglio "prezzi per riga": quantità, prezzi a 2 decimali, sconti, IVA per riga e totali di sezione', async () => {
    const { text } = await issueRich('lines');
    expect(text).toContain('37,5 m'); // quantità senza zeri inutili
    expect(text).toContain('0,46 €'); // 0,4567 → 2 decimali, half-up
    expect(text).toContain('12,38 €'); // 12,375 → 12,38
    expect(text).toContain('10%'); // sconto riga e colonna IVA
    expect(text).toContain('17,13 €');
    expect(text).toContain('Totale sezione');
    expect(text).toContain('Cod. DIF2P40');
  });

  it('dettaglio "solo totali di sezione": niente prezzi delle righe, totali di sezione presenti', async () => {
    const { text } = await issueRich('sections');
    expect(text).toContain('Totale sezione');
    expect(text).toContain('129,95 €');
    // nessun prezzo o importo di riga nel corpo (le voci opzionali hanno comunque il loro prezzo)
    expect(text).not.toContain('0,46 €');
    expect(text).not.toContain('85,40 €');
    expect(text).not.toContain('Cod. DIF2P40');
  });

  it('dettaglio "solo totale": nessun importo di riga o di sezione nel corpo', async () => {
    const { text } = await issueRich('total');
    expect(text).not.toContain('Totale sezione');
    expect(text).not.toContain('129,95 €');
    expect(text).not.toContain('0,46 €');
    expect(text).toContain('Totale IVA inclusa');
  });

  it('azienda forfettaria: "Totale" senza IVA e dicitura del regime', async () => {
    await db.doc('companies/A').update({ 'settings.taxRegime': 'flat_rate', 'settings.defaultVatCode': 'FORF' });
    await seedDraft(db, 'A', 'q1');
    const result = await issueWithPdf('q1');
    const { text } = await pdfText(await download(result.pdfPath!));
    expect(text).toContain('L. 190/2014');
    expect(text).toContain('senza IVA');
    expect(text).not.toContain('IVA inclusa');
    expect(text).toContain('150,00 €');
  });

  it('molte righe: più pagine con "Pagina x di y" e numero del preventivo in ogni pagina', async () => {
    const c = completeContent();
    for (let i = 0; i < 80; i++) {
      c.sections[0].lines.push({ ...createLine('material', 'VAT22', COMPLETE_SETTINGS), description: `Riga di prova numero ${i + 1}`, quantityMilli: 1_000, unitPriceTenThousandths: 10_000 });
    }
    await seedDraft(db, 'A', 'q1', c);
    const result = await issueWithPdf('q1');
    const { pages } = await pdfText(await download(result.pdfPath!));
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, i) => {
      expect(p).toContain(`Pagina ${i + 1} di ${pages.length}`);
      expect(p).toContain('Preventivo 2026/001');
    });
  });
});

describe('errori e rigenerazione', () => {
  it('un errore di generazione lascia pdfStatus "error"; la rigenerazione lo risolve con lo stesso numero', async () => {
    await seedDraft(db, 'A', 'q1');
    const failed = await issueWithPdf('q1', async () => {
      throw new Error('guasto simulato');
    });
    expect(failed.pdfStatus).toBe('error');
    expect(await quoteData('q1')).toMatchObject({ status: 'issued', displayNumber: '2026/001', pdfStatus: 'error' });

    const regenerated = await regenerateQuotePdfHandler({ db, bucket }, 'ownerA', { companyId: 'A', quoteId: 'q1' });
    expect(regenerated).toEqual({ pdfStatus: 'ready', pdfPath: 'companies/A/quotes/q1/Preventivo_2026-001.pdf' });
    expect(await quoteData('q1')).toMatchObject({ displayNumber: '2026/001', pdfStatus: 'ready', number: { year: 2026, sequence: 1 } });
    expect((await db.doc('companies/A/counters/quotes-2026').get()).data()).toMatchObject({ lastIssued: 1, next: 2 });
  });

  it('rigenerare non cambia il contenuto anche se le impostazioni sono cambiate', async () => {
    await seedDraft(db, 'A', 'q1');
    await issueWithPdf('q1');
    await db.doc('companies/A').update({ 'settings.legalName': 'Ragione Sociale Nuova', 'settings.address': 'Indirizzo nuovo' });
    await regenerateQuotePdfHandler({ db, bucket }, 'ownerA', { companyId: 'A', quoteId: 'q1' });
    const { text } = await pdfText(await download('companies/A/quotes/q1/Preventivo_2026-001.pdf'));
    expect(text).toContain('Elettrica Rossi di Mario Rossi');
    expect(text).not.toContain('Ragione Sociale Nuova');
  });

  it('rigenerazione rifiutata per bozze, preventivi di altre aziende e utenti non membri', async () => {
    await seedDraft(db, 'A', 'bozza');
    const reason = async (p: Promise<unknown>) => p.then(() => 'ok', (e: HttpsError) => (e.details as { reason?: string })?.reason ?? e.code);
    expect(await reason(regenerateQuotePdfHandler({ db, bucket }, 'ownerA', { companyId: 'A', quoteId: 'bozza' }))).toBe('not-issued');
    expect(await reason(regenerateQuotePdfHandler({ db, bucket }, 'ownerB', { companyId: 'A', quoteId: 'bozza' }))).toBe('permission-denied');
    expect(await reason(regenerateQuotePdfHandler({ db, bucket }, 'nessuno', { companyId: 'A', quoteId: 'bozza' }))).toBe('permission-denied');
  });
});

describe('logo', () => {
  const red = png(200, 30, 30);
  const blue = png(30, 30, 200);

  it('senza logo: nessuna immagine nel PDF e logoPath null', async () => {
    await seedDraft(db, 'A', 'q1');
    const result = await issueWithPdf('q1');
    expect(((await quoteData('q1')).snapshot as QuoteSnapshot).company.logoPath).toBeNull();
    expect((await download(result.pdfPath!)).includes('/Subtype /Image')).toBe(false);
  });

  it('il logo viene congelato all’emissione: sostituirlo dopo non cambia il PDF rigenerato', async () => {
    await bucket.file('companies/A/branding/logo').save(red, { contentType: 'image/png', resumable: false });
    await seedDraft(db, 'A', 'q1');
    const result = await issueWithPdf('q1');
    const snap = (await quoteData('q1')).snapshot as QuoteSnapshot;
    expect(snap.company.logoPath).toBe('companies/A/quotes/q1/logo');
    expect((await download(result.pdfPath!)).includes('/Subtype /Image')).toBe(true);

    await bucket.file('companies/A/branding/logo').save(blue, { contentType: 'image/png', resumable: false });
    await regenerateQuotePdfHandler({ db, bucket }, 'ownerA', { companyId: 'A', quoteId: 'q1' });
    expect((await download('companies/A/quotes/q1/logo')).equals(red)).toBe(true);
    expect((await quoteData('q1')).snapshot).toEqual(snap);
  });

  it('un logo rimosso dopo l’emissione non impedisce di rigenerare il PDF', async () => {
    await bucket.file('companies/A/branding/logo').save(red, { contentType: 'image/png', resumable: false });
    await seedDraft(db, 'A', 'q1');
    await issueWithPdf('q1');
    await bucket.file('companies/A/branding/logo').delete();
    expect((await regenerateQuotePdfHandler({ db, bucket }, 'ownerA', { companyId: 'A', quoteId: 'q1' })).pdfStatus).toBe('ready');
  });
});
