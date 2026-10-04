import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { displayQuoteNumber } from '../../shared/numbering';
import type { QuoteSnapshot } from '../../shared/snapshot';
import { precondition, requireMember, requireString } from './access';

export interface RevisionDeps {
  db: Firestore;
}

/**
 * "Correggi": da un preventivo emesso crea una bozza copiata dall'istantanea, collegata all'originale.
 * Una sola revisione aperta per preventivo: l'originale registra openRevisionId nella stessa transazione.
 */
export async function startRevisionHandler(deps: RevisionDeps, uid: string, data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const companyId = requireString(input.companyId, 'companyId');
  const quoteId = requireString(input.quoteId, 'quoteId');
  await requireMember(deps.db, uid, companyId);

  const quotes = deps.db.collection(`companies/${companyId}/quotes`);
  const originalRef = quotes.doc(quoteId);
  const draftRef = quotes.doc();

  return deps.db.runTransaction(async (tx) => {
    const original = (await tx.get(originalRef)).data();
    if (!original) throw new HttpsError('not-found', 'Preventivo non trovato.');
    if (original.status === 'superseded') {
      throw precondition('superseded', 'Questo preventivo è già stato sostituito da una revisione: correggi l’ultima versione.');
    }
    if (original.status !== 'issued') throw precondition('not-issued', 'Si può correggere solo un preventivo emesso.');
    if (typeof original.openRevisionId === 'string') {
      const open = await tx.get(quotes.doc(original.openRevisionId));
      if (open.exists) {
        throw new HttpsError('failed-precondition', 'C’è già una revisione aperta per questo preventivo.', {
          reason: 'revision-open',
          revisionId: original.openRevisionId,
        });
      }
    }

    const snapshot = original.snapshot as QuoteSnapshot;
    const revision = (typeof original.revision === 'number' ? original.revision : 0) + 1;
    tx.set(draftRef, {
      ...snapshot.content,
      status: 'draft',
      version: 1,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      revisionOf: quoteId,
      revision,
    });
    tx.update(originalRef, { openRevisionId: draftRef.id });
    return {
      quoteId: draftRef.id,
      revision,
      displayNumber: displayQuoteNumber({ year: snapshot.number.year, sequence: snapshot.number.sequence, revision }),
    };
  });
}

/** Elimina la bozza di revisione e libera l'originale. */
export async function discardRevisionHandler(deps: RevisionDeps, uid: string, data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const companyId = requireString(input.companyId, 'companyId');
  const quoteId = requireString(input.quoteId, 'quoteId');
  await requireMember(deps.db, uid, companyId);

  const quotes = deps.db.collection(`companies/${companyId}/quotes`);
  const draftRef = quotes.doc(quoteId);

  return deps.db.runTransaction(async (tx) => {
    const draft = (await tx.get(draftRef)).data();
    if (!draft) throw new HttpsError('not-found', 'Revisione non trovata.');
    if (draft.status !== 'draft' || typeof draft.revisionOf !== 'string') {
      throw precondition('not-revision', 'Si può annullare solo una revisione non ancora emessa.');
    }
    const originalRef = quotes.doc(draft.revisionOf);
    const original = (await tx.get(originalRef)).data();
    tx.delete(draftRef);
    if (original?.openRevisionId === quoteId) tx.update(originalRef, { openRevisionId: FieldValue.delete() });
    return { originalId: draft.revisionOf as string };
  });
}
