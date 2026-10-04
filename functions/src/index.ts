// Registrazione delle Cloud Functions. La logica sta nei moduli importati, testati sugli emulatori.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineBoolean } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { FUNCTIONS_REGION } from '../../shared/region';
import { issueQuoteHandler } from './issue';
import { setNextQuoteNumberHandler } from './numbering';

initializeApp();
// maxInstances limita i costi in caso di traffico anomalo.
setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 5 });

/** true nel progetto di test (functions/.env.quadro-app-test); in produzione resta false. */
const allowUnconfirmedVatTexts = defineBoolean('ALLOW_UNCONFIRMED_VAT_TEXTS', { default: false });

function requireAuth(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso richiesto.');
  return request.auth.uid;
}

/** Errori imprevisti: log senza dati personali, messaggio generico al client. */
async function guarded<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error(`${name}: errore imprevisto`, { message: error instanceof Error ? error.message : String(error) });
    throw new HttpsError('internal', 'Errore imprevisto sul server. Riprova tra poco.');
  }
}

export const issueQuote = onCall((request) =>
  guarded('issueQuote', () =>
    issueQuoteHandler(
      { db: getFirestore(), now: () => new Date(), allowUnconfirmedVatTexts: allowUnconfirmedVatTexts.value() },
      requireAuth(request),
      request.data,
    ),
  ),
);

export const setNextQuoteNumber = onCall((request) =>
  guarded('setNextQuoteNumber', () =>
    setNextQuoteNumberHandler({ db: getFirestore(), now: () => new Date() }, requireAuth(request), request.data),
  ),
);
