// Registrazione delle Cloud Functions. La logica sta nei moduli importati, testati sugli emulatori.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { defineBoolean, defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { FUNCTIONS_REGION } from '../../shared/region';
import { issueQuoteHandler } from './issue';
import { setNextQuoteNumberHandler } from './numbering';
import { generateQuotePdf, regenerateQuotePdfHandler } from './pdf/generate';
import { discardRevisionHandler, startRevisionHandler } from './revisions';

initializeApp();

/**
 * Le callable devono essere raggiungibili da internet a livello di Cloud Run: l'accesso vero è controllato
 * dentro ogni funzione (utente Firebase autenticato + membership dell'azienda). Esplicito, così anche un
 * aggiornamento imposta il permesso, non solo la prima creazione.
 */
const CALLABLE = { invoker: 'public' as const };
const PDF_CALLABLE = { ...CALLABLE, memory: '512MiB' as const, timeoutSeconds: 120 };
// maxInstances limita i costi in caso di traffico anomalo.
setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 5 });

/** true nel progetto di test (functions/.env.quadro-app-test); in produzione resta false. */
const allowUnconfirmedVatTexts = defineBoolean('ALLOW_UNCONFIRMED_VAT_TEXTS', { default: false });
/** Bucket di Storage, esplicito: lo stesso nome va in VITE_FIREBASE_STORAGE_BUCKET del frontend. */
const storageBucket = defineString('STORAGE_BUCKET');

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

function pdfDeps() {
  return { db: getFirestore(), bucket: getStorage().bucket(storageBucket.value()) };
}

/** Emette il preventivo, poi genera il PDF. Se il PDF fallisce il numero resta: pdfStatus "error" e si può rigenerare. */
export const issueQuote = onCall(PDF_CALLABLE, (request) =>
  guarded('issueQuote', async () => {
    const uid = requireAuth(request);
    const deps = { ...pdfDeps(), now: () => new Date(), allowUnconfirmedVatTexts: allowUnconfirmedVatTexts.value() };
    const issued = await issueQuoteHandler(deps, uid, request.data);
    const { companyId, quoteId } = request.data as { companyId: string; quoteId: string };
    const pdf = await generateQuotePdf(deps, companyId, quoteId);
    return { ...issued, pdfStatus: pdf.pdfStatus };
  }),
);

export const regenerateQuotePdf = onCall(PDF_CALLABLE, (request) =>
  guarded('regenerateQuotePdf', () => regenerateQuotePdfHandler(pdfDeps(), requireAuth(request), request.data)),
);

export const setNextQuoteNumber = onCall(CALLABLE, (request) =>
  guarded('setNextQuoteNumber', () =>
    setNextQuoteNumberHandler({ db: getFirestore(), now: () => new Date() }, requireAuth(request), request.data),
  ),
);

export const startRevision = onCall(CALLABLE, (request) =>
  guarded('startRevision', () => startRevisionHandler({ db: getFirestore() }, requireAuth(request), request.data)),
);

export const discardRevision = onCall(CALLABLE, (request) =>
  guarded('discardRevision', () => discardRevisionHandler({ db: getFirestore() }, requireAuth(request), request.data)),
);
