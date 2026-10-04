// Operazioni sul server (Cloud Functions) e download dei PDF con le credenziali dell'utente.

import { httpsCallable } from 'firebase/functions';
import { getBlob, ref } from 'firebase/storage';
import type { PdfStatus } from '../shared/snapshot';
import { functions, storage } from './firebase';

function call<Req, Res>(name: string) {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data: Req) => (await fn(data)).data;
}

export const issueQuote = call<
  { companyId: string; quoteId: string; version: number },
  { displayNumber: string; totalCents: number; pdfStatus: PdfStatus }
>('issueQuote');

export const regenerateQuotePdf = call<{ companyId: string; quoteId: string }, { pdfStatus: PdfStatus; pdfPath: string | null }>(
  'regenerateQuotePdf',
);

export const startRevision = call<{ companyId: string; quoteId: string }, { quoteId: string; revision: number; displayNumber: string }>(
  'startRevision',
);

export const discardRevision = call<{ companyId: string; quoteId: string }, { originalId: string }>('discardRevision');

/** Scarica il PDF con l'SDK (nessun link pubblico). */
export async function downloadPdf(path: string, fileName: string): Promise<File> {
  const blob = await getBlob(ref(storage, path));
  return new File([blob], fileName, { type: 'application/pdf' });
}

/** Dettagli di un errore delle Functions (es. reason, revisionId). */
export function errorDetails(error: unknown): Record<string, unknown> {
  const details = (error as { details?: unknown })?.details;
  return typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : {};
}
