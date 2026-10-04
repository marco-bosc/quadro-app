import { beforeEach, describe, expect, it } from 'vitest';
import { issueQuoteHandler, type IssueDeps } from '../../functions/src/issue';
import { discardRevisionHandler, startRevisionHandler } from '../../functions/src/revisions';
import { HttpsError } from '../../functions/test-support/admin';
import { parseQuoteContent } from '../../shared/quote';
import type { QuoteSnapshot } from '../../shared/snapshot';
import { adminBucket, adminDb, clearAll, completeContent, seedCompanies, seedDraft } from './helpers';

const db = adminDb();
const bucket = adminBucket();
const deps: IssueDeps = { db, bucket, now: () => new Date('2026-10-04T08:00:00Z'), allowUnconfirmedVatTexts: false };

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof HttpsError) return (e.details as { reason?: string } | undefined)?.reason ?? e.code;
    throw e;
  }
  throw new Error('Doveva fallire');
}

const data = async (id: string) => (await db.doc(`companies/A/quotes/${id}`).get()).data();
const counter = async () => (await db.doc('companies/A/counters/quotes-2026').get()).data();
const issue = (quoteId: string, version = 1) => issueQuoteHandler(deps, 'ownerA', { companyId: 'A', quoteId, version });
const start = (quoteId: string, uid = 'ownerA') => startRevisionHandler({ db }, uid, { companyId: 'A', quoteId });
const discard = (quoteId: string) => discardRevisionHandler({ db }, 'ownerA', { companyId: 'A', quoteId });

/** Emette q1 (2026/001) e una seconda bozza q2 (2026/002), per verificare che le revisioni non tocchino il contatore. */
async function seedIssued() {
  await seedDraft(db, 'A', 'q1');
  await seedDraft(db, 'A', 'q2');
  await issue('q1');
  await issue('q2');
}

beforeEach(async () => {
  await clearAll();
  await seedCompanies(db);
});

describe('startRevision', () => {
  it('crea una bozza dall’istantanea, collegata all’originale, e registra la revisione aperta', async () => {
    await seedIssued();
    const result = await start('q1');
    expect(result).toMatchObject({ revision: 1, displayNumber: '2026/001 rev. 1' });

    const draft = (await data(result.quoteId))!;
    expect(draft).toMatchObject({ status: 'draft', version: 1, revisionOf: 'q1', revision: 1, createdBy: 'ownerA' });
    const snap = (await data('q1'))!.snapshot as QuoteSnapshot;
    expect(parseQuoteContent(draft)).toEqual(snap.content);
    expect(draft).not.toHaveProperty('snapshot');
    expect(draft).not.toHaveProperty('number');
    expect((await data('q1'))!.openRevisionId).toBe(result.quoteId);
  });

  it('una sola revisione aperta per preventivo, anche con richieste simultanee', async () => {
    await seedIssued();
    const results = await Promise.allSettled([start('q1'), start('q1'), start('q1')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const reasons = await Promise.all(
      results.filter((r) => r.status === 'rejected').map((r) => failure(Promise.reject((r as PromiseRejectedResult).reason))),
    );
    expect(reasons.every((r) => r === 'revision-open')).toBe(true);
    const drafts = (await db.collection('companies/A/quotes').where('revisionOf', '==', 'q1').get()).size;
    expect(drafts).toBe(1);
  });

  it('rifiutata su bozze, su preventivi sostituiti e per utenti di altre aziende', async () => {
    await seedDraft(db, 'A', 'bozza');
    expect(await failure(start('bozza'))).toBe('not-issued');
    await seedIssued();
    expect(await failure(start('q1', 'ownerB'))).toBe('permission-denied');
    const { quoteId } = await start('q1');
    await issue(quoteId);
    expect(await failure(start('q1'))).toBe('superseded');
  });
});

describe('emissione della revisione', () => {
  it('stesso numero con rev. 1, contatore invariato, originale sostituito e collegato', async () => {
    await seedIssued();
    const before = await counter();
    const { quoteId } = await start('q1');
    // la bozza di revisione si corregge come una bozza normale
    await db.doc(`companies/A/quotes/${quoteId}`).update({ title: 'Quadro elettrico (corretto)', version: 2 });
    const result = await issue(quoteId, 2);
    expect(result.displayNumber).toBe('2026/001 rev. 1');

    const rev = (await data(quoteId))!;
    expect(rev).toMatchObject({ status: 'issued', number: { year: 2026, sequence: 1 }, revision: 1, displayNumber: '2026/001 rev. 1' });
    const snap = rev.snapshot as QuoteSnapshot;
    expect(snap.number).toMatchObject({ sequence: 1, revision: 1, fileName: 'Preventivo_2026-001_rev1.pdf' });
    expect(snap.content.title).toBe('Quadro elettrico (corretto)');

    const original = (await data('q1'))!;
    expect(original).toMatchObject({ status: 'superseded', supersededBy: quoteId, displayNumber: '2026/001' });
    expect(original).not.toHaveProperty('openRevisionId');
    expect((original.snapshot as QuoteSnapshot).content.title).toBe('Quadro elettrico'); // l'originale resta consultabile e invariato
    expect(await counter()).toEqual(before);
  });

  it('revisione della revisione: rev. 2, sempre senza toccare il contatore', async () => {
    await seedIssued();
    const before = await counter();
    const r1 = await start('q1');
    await issue(r1.quoteId);
    const r2 = await start(r1.quoteId);
    expect(r2.displayNumber).toBe('2026/001 rev. 2');
    expect((await issue(r2.quoteId)).displayNumber).toBe('2026/001 rev. 2');
    expect((await data(r1.quoteId))!.status).toBe('superseded');
    expect(await counter()).toEqual(before);
  });

  it('una revisione incompleta non si emette e l’originale resta emesso', async () => {
    await seedIssued();
    const { quoteId } = await start('q1');
    const content = completeContent();
    content.sections[0].lines[0].unitPriceTenThousandths = null;
    await db.doc(`companies/A/quotes/${quoteId}`).update({ sections: content.sections, version: 2 });
    expect(await failure(issue(quoteId, 2))).toBe('incomplete');
    expect((await data('q1'))!.status).toBe('issued');
  });
});

describe('discardRevision', () => {
  it('elimina la bozza di revisione e libera l’originale, che si può correggere di nuovo', async () => {
    await seedIssued();
    const { quoteId } = await start('q1');
    expect(await discard(quoteId)).toEqual({ originalId: 'q1' });
    expect(await data(quoteId)).toBeUndefined();
    expect((await data('q1'))!).not.toHaveProperty('openRevisionId');
    expect((await start('q1')).revision).toBe(1);
  });

  it('rifiutata su bozze normali e su revisioni già emesse', async () => {
    await seedDraft(db, 'A', 'bozza');
    expect(await failure(discard('bozza'))).toBe('not-revision');
    await seedIssued();
    const { quoteId } = await start('q1');
    await issue(quoteId);
    expect(await failure(discard(quoteId))).toBe('not-revision');
  });
});
