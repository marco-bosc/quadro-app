import { beforeEach, describe, expect, it } from 'vitest';
import { issueQuoteHandler, type IssueDeps } from '../../functions/src/issue';
import { setNextQuoteNumberHandler } from '../../functions/src/numbering';
import { HttpsError, Timestamp } from '../../functions/test-support/admin';
import type { QuoteSnapshot } from '../../shared/snapshot';
import { adminDb, clearAll, COMPLETE_SETTINGS, completeContent, seedCompanies, seedDraft } from './helpers';

const db = adminDb();
// 4 ottobre 2026, 10:00 a Roma
const OCT_4 = new Date('2026-10-04T08:00:00Z');

function deps(over: Partial<IssueDeps> = {}): IssueDeps {
  return { db, now: () => OCT_4, allowUnconfirmedVatTexts: false, ...over };
}

const issue = (quoteId: string, over: Partial<IssueDeps> = {}, uid = 'ownerA', version = 1, companyId = 'A') =>
  issueQuoteHandler(deps(over), uid, { companyId, quoteId, version });

/** Motivo dell'errore (details.reason) o codice, per confronti leggibili. */
async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof HttpsError) return (e.details as { reason?: string } | undefined)?.reason ?? e.code;
    throw e;
  }
  throw new Error('Doveva fallire');
}

async function quoteData(id: string, companyId = 'A') {
  return (await db.doc(`companies/${companyId}/quotes/${id}`).get()).data()!;
}

beforeEach(async () => {
  await clearAll();
  await seedCompanies(db);
});

describe('emissione', () => {
  it('assegna 2026/001, congela l’istantanea e porta lo stato a issued con PDF in attesa', async () => {
    await seedDraft(db, 'A', 'q1');
    const result = await issue('q1');
    expect(result).toEqual({ displayNumber: '2026/001', totalCents: 18_300 });

    const q = await quoteData('q1');
    expect(q).toMatchObject({
      status: 'issued',
      number: { year: 2026, sequence: 1 },
      revision: 0,
      displayNumber: '2026/001',
      pdfStatus: 'pending',
      pdfPath: null,
      version: 2,
      issuedBy: 'ownerA',
    });
    expect((q.issuedAt as Timestamp).toDate()).toEqual(OCT_4);
    const snap = q.snapshot as QuoteSnapshot;
    expect(snap.number).toEqual({ year: 2026, sequence: 1, revision: 0, display: '2026/001', fileName: 'Preventivo_2026-001.pdf' });
    expect(snap.issueDate).toBe('2026-10-04');
    expect(snap.company).toMatchObject({ legalName: COMPLETE_SETTINGS.legalName, vatNumber: '01234567897', taxRegime: 'ordinary' });
    expect(snap.totals).toMatchObject({ taxableCents: 15_000, vatCents: 3_300, totalCents: 18_300 });
    expect(snap.content.title).toBe('Quadro elettrico');
    expect(snap.vatTexts).toEqual([{ code: 'VAT22', rateBp: 2200, label: 'IVA 22%', legend: null }]);

    expect((await db.doc('companies/A/counters/quotes-2026').get()).data()).toMatchObject({ lastIssued: 1, next: 2 });
  });

  it('due emissioni simultanee ricevono numeri diversi e consecutivi', async () => {
    await Promise.all(['q1', 'q2', 'q3', 'q4'].map((id) => seedDraft(db, 'A', id)));
    const results = await Promise.all(['q1', 'q2', 'q3', 'q4'].map((id) => issue(id)));
    const numbers = results.map((r) => r.displayNumber).sort();
    expect(numbers).toEqual(['2026/001', '2026/002', '2026/003', '2026/004']);
    expect((await db.doc('companies/A/counters/quotes-2026').get()).data()).toMatchObject({ lastIssued: 4, next: 5 });
  });

  it('le aziende hanno numerazioni indipendenti', async () => {
    await seedDraft(db, 'A', 'qa');
    await seedDraft(db, 'B', 'qb');
    expect((await issue('qa')).displayNumber).toBe('2026/001');
    expect((await issue('qb', {}, 'ownerB', 1, 'B')).displayNumber).toBe('2026/001');
  });

  it('nel nuovo anno (ora di Roma) la numerazione riparte da 001', async () => {
    await seedDraft(db, 'A', 'dic');
    await seedDraft(db, 'A', 'gen');
    // 31/12/2026 22:30 UTC = 23:30 a Roma: ancora 2026
    expect((await issue('dic', { now: () => new Date('2026-12-31T22:30:00Z') })).displayNumber).toBe('2026/001');
    // 31/12/2026 23:30 UTC = 00:30 del 1° gennaio a Roma: già 2027, anche se in UTC è ancora il 31
    const jan = await issue('gen', { now: () => new Date('2026-12-31T23:30:00Z') });
    expect(jan.displayNumber).toBe('2027/001');
    expect(((await quoteData('gen')).snapshot as QuoteSnapshot).issueDate).toBe('2027-01-01');
  });

  it('il server ricalcola i totali: valori alterati nel documento non entrano nell’istantanea', async () => {
    await seedDraft(db, 'A', 'q1');
    // Totali falsi scritti nel documento (senza regole, come caso peggiore): il server li ignora.
    await db.doc('companies/A/quotes/q1').update({ totalCents: 1, totals: { totalCents: 1 } });
    await issue('q1');
    const snap = (await quoteData('q1')).snapshot as QuoteSnapshot;
    expect(snap.totals.totalCents).toBe(18_300);
    expect(Object.values(snap.totals.lineAmounts).sort()).toEqual([10_000, 5_000].sort());
    expect(snap).not.toHaveProperty('totalCents');
  });

  it('modificare le impostazioni dopo l’emissione non cambia l’istantanea', async () => {
    await seedDraft(db, 'A', 'q1');
    await issue('q1');
    const before = (await quoteData('q1')).snapshot;
    await db.doc('companies/A').update({
      'settings.legalName': 'Nuova Ragione Sociale',
      'settings.address': 'Altro indirizzo',
      'settings.hourlyRate': 999_999,
    });
    expect((await quoteData('q1')).snapshot).toEqual(before);
  });
});

describe('emissione rifiutata', () => {
  it('preventivo incompleto (prezzo mancante)', async () => {
    const c = completeContent();
    c.sections[0].lines[0].unitPriceTenThousandths = null;
    await seedDraft(db, 'A', 'q1', c);
    expect(await failure(issue('q1'))).toBe('incomplete');
    expect((await quoteData('q1')).status).toBe('draft');
    expect((await db.doc('companies/A/counters/quotes-2026').get()).exists).toBe(false);
  });

  it('voce opzionale senza prezzo', async () => {
    const c = completeContent();
    c.sections[0].lines[1] = { ...c.sections[0].lines[1], optional: true, unitPriceTenThousandths: null };
    await seedDraft(db, 'A', 'q1', c);
    expect(await failure(issue('q1'))).toBe('incomplete');
  });

  it('versione superata', async () => {
    await seedDraft(db, 'A', 'q1', completeContent(), 3);
    expect(await failure(issue('q1', {}, 'ownerA', 2))).toBe('version-conflict');
  });

  it('preventivo di un’altra azienda, anche conoscendone l’ID', async () => {
    await seedDraft(db, 'B', 'qb');
    expect(await failure(issue('qb', {}, 'ownerA', 1, 'B'))).toBe('permission-denied');
    expect(await failure(issue('qb', {}, 'ownerA', 1, 'A'))).toBe('not-found');
    expect((await quoteData('qb', 'B')).status).toBe('draft');
  });

  it('utente senza membership', async () => {
    await seedDraft(db, 'A', 'q1');
    expect(await failure(issue('q1', {}, 'sconosciuto'))).toBe('permission-denied');
  });

  it('preventivo già emesso: nessun secondo numero', async () => {
    await seedDraft(db, 'A', 'q1');
    await issue('q1');
    expect(await failure(issue('q1', {}, 'ownerA', 2))).toBe('not-draft');
    expect((await db.doc('companies/A/counters/quotes-2026').get()).data()).toMatchObject({ lastIssued: 1 });
  });

  it('dati di intestazione mancanti o partita IVA non valida', async () => {
    await seedDraft(db, 'A', 'q1');
    await db.doc('companies/A').update({ 'settings.vatNumber': '01234567890' });
    expect(await failure(issue('q1'))).toBe('missing-company-profile');
    await db.doc('companies/A').update({ 'settings.vatNumber': '01234567897', 'settings.address': '' });
    expect(await failure(issue('q1'))).toBe('missing-company-profile');
  });

  it('sconto finale oltre l’imponibile', async () => {
    await seedDraft(db, 'A', 'q1', completeContent({ finalDiscountCents: 15_001 }));
    expect(await failure(issue('q1'))).toBe('invalid');
  });

  it('parametri non validi', async () => {
    expect(await failure(issueQuoteHandler(deps(), 'ownerA', { companyId: 'A', quoteId: '../x', version: 1 }))).toBe(
      'invalid-argument',
    );
    expect(await failure(issueQuoteHandler(deps(), 'ownerA', { companyId: 'A', quoteId: 'q1', version: '1' }))).toBe(
      'invalid-argument',
    );
  });
});

describe('diciture IVA non confermate', () => {
  function withCode(code: 'VAT10' | 'RC_ATER' | 'RC_A' | 'FORF') {
    const c = completeContent({ defaultVatCode: code === 'FORF' ? 'FORF' : 'VAT22' });
    c.sections[0].lines[0].vatCode = code;
    if (code === 'FORF') c.sections[0].lines[1].vatCode = 'FORF';
    return c;
  }

  it.each(['VAT10', 'RC_ATER', 'RC_A'] as const)('in produzione (parametro false) %s non si emette', async (code) => {
    await seedDraft(db, 'A', 'q1', withCode(code));
    expect(await failure(issue('q1'))).toBe('unconfirmed-vat-texts');
    expect((await quoteData('q1')).status).toBe('draft');
  });

  it('in produzione FORF (azienda forfettaria) non si emette', async () => {
    await db.doc('companies/A').update({ 'settings.taxRegime': 'flat_rate', 'settings.defaultVatCode': 'FORF' });
    await seedDraft(db, 'A', 'q1', withCode('FORF'));
    expect(await failure(issue('q1'))).toBe('unconfirmed-vat-texts');
  });

  it('in produzione un preventivo tutto al 22% si emette', async () => {
    await seedDraft(db, 'A', 'q1');
    expect((await issue('q1')).displayNumber).toBe('2026/001');
  });

  it('in test (parametro true) si emette e l’istantanea conserva il segnaposto', async () => {
    await seedDraft(db, 'A', 'q1', withCode('RC_ATER'));
    await issue('q1', { allowUnconfirmedVatTexts: true });
    const snap = (await quoteData('q1')).snapshot as QuoteSnapshot;
    expect(snap.vatTexts.find((t) => t.code === 'RC_ATER')?.legend).toMatch(/^\[DA CONFERMARE\]/);
  });

  it('azienda diventata forfettaria: l’istantanea usa FORF anche se la bozza aveva altri codici', async () => {
    await db.doc('companies/A').update({ 'settings.taxRegime': 'flat_rate', 'settings.defaultVatCode': 'FORF' });
    await seedDraft(db, 'A', 'q1');
    await issue('q1', { allowUnconfirmedVatTexts: true });
    const snap = (await quoteData('q1')).snapshot as QuoteSnapshot;
    expect(snap.totals.vatGroups.map((g) => g.code)).toEqual(['FORF']);
    expect(snap.totals.totalCents).toBe(15_000);
  });
});

describe('prossimo numero', () => {
  const setNext = (next: unknown, uid = 'ownerA', now = OCT_4) =>
    setNextQuoteNumberHandler({ db, now: () => now }, uid, { companyId: 'A', next });

  it('l’owner imposta il prossimo numero e la prossima emissione lo usa', async () => {
    expect(await setNext(15)).toEqual({ year: 2026, next: 15, display: '2026/015' });
    await seedDraft(db, 'A', 'q1');
    expect((await issue('q1')).displayNumber).toBe('2026/015');
    expect((await db.doc('companies/A/counters/quotes-2026').get()).data()).toMatchObject({ lastIssued: 15, next: 16 });
  });

  it('si può solo aumentare rispetto all’ultimo emesso', async () => {
    await setNext(10);
    await seedDraft(db, 'A', 'q1');
    await issue('q1'); // 2026/010
    expect(await failure(setNext(10))).toBe('next-not-increasing');
    expect(await failure(setNext(3))).toBe('next-not-increasing');
    expect(await setNext(11)).toMatchObject({ next: 11 });
    // tornare più in basso del valore impostato ma sopra l'ultimo emesso è ammesso
    await setNext(40);
    expect(await setNext(12)).toMatchObject({ next: 12 });
  });

  it('solo l’owner, solo per la propria azienda, solo numeri validi', async () => {
    expect(await failure(setNext(5, 'memberA'))).toBe('permission-denied');
    expect(await failure(setNext(5, 'ownerB'))).toBe('permission-denied');
    expect(await failure(setNext(0))).toBe('invalid-argument');
    expect(await failure(setNext(2.5))).toBe('invalid-argument');
    expect(await failure(setNext(1_000_000))).toBe('invalid-argument');
  });

  it('vale per l’anno corrente a Roma', async () => {
    await setNext(20, 'ownerA', new Date('2026-12-31T23:30:00Z'));
    expect((await db.doc('companies/A/counters/quotes-2027').get()).data()).toMatchObject({ next: 20 });
  });
});
