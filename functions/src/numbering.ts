import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { displayQuoteNumber, MAX_SEQUENCE, romeDate } from '../../shared/numbering';
import { precondition, requireInt, requireMember, requireString } from './access';

export interface NumberingDeps {
  db: Firestore;
  now: () => Date;
}

export function counterPath(companyId: string, year: number): string {
  return `companies/${companyId}/counters/quotes-${year}`;
}

/**
 * Imposta il prossimo numero dell'anno corrente (solo owner), per chi continua una numerazione
 * iniziata con un altro sistema. Si può solo andare oltre l'ultimo numero emesso.
 */
export async function setNextQuoteNumberHandler(deps: NumberingDeps, uid: string, data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const companyId = requireString(input.companyId, 'companyId');
  const next = requireInt(input.next, 'next');
  if (next < 1 || next > MAX_SEQUENCE) throw new HttpsError('invalid-argument', `Il numero deve essere tra 1 e ${MAX_SEQUENCE}.`);
  await requireMember(deps.db, uid, companyId, 'owner');

  const { year } = romeDate(deps.now());
  const ref = deps.db.doc(counterPath(companyId, year));
  return deps.db.runTransaction(async (tx) => {
    const counter = (await tx.get(ref)).data();
    const lastIssued: number = counter?.lastIssued ?? 0;
    if (next <= lastIssued) {
      throw precondition(
        'next-not-increasing',
        `Il prossimo numero deve essere maggiore dell’ultimo emesso (${displayQuoteNumber({ year, sequence: lastIssued, revision: 0 })}).`,
      );
    }
    tx.set(ref, { year, lastIssued, next, updatedAt: FieldValue.serverTimestamp() });
    return { year, next, display: displayQuoteNumber({ year, sequence: next, revision: 0 }) };
  });
}

