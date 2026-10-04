import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/** Verifica l'appartenenza all'azienda (e, se richiesto, il ruolo owner) come fanno le Security Rules. */
export async function requireMember(db: Firestore, uid: string, companyId: string, role?: 'owner'): Promise<void> {
  const membership = (await db.doc(`memberships/${uid}`).get()).data();
  if (membership?.companyId !== companyId) {
    throw new HttpsError('permission-denied', 'Non hai accesso ai dati di questa azienda.');
  }
  if (role && membership.role !== role) {
    throw new HttpsError('permission-denied', 'Solo il titolare dell’account può fare questa operazione.');
  }
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.includes('/')) {
    throw new HttpsError('invalid-argument', `Parametro non valido: ${name}.`);
  }
  return value;
}

export function requireInt(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new HttpsError('invalid-argument', `Parametro non valido: ${name}.`);
  }
  return value;
}

/** Errore di precondizione con un motivo riconoscibile dal client (details.reason). */
export function precondition(reason: string, message: string): HttpsError {
  return new HttpsError('failed-precondition', message, { reason });
}
