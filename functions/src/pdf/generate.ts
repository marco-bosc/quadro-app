import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v2/https';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { PdfStatus, QuoteSnapshot } from '../../../shared/snapshot';
import { requireMember, requireString } from '../access';
import { LOGO_TYPES, quotePdfPath } from '../../../shared/storagePaths';
import { buildPdfDefinition, type PdfLogo } from './document';
import { renderPdf } from './render';

export type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export interface PdfDeps {
  db: Firestore;
  bucket: Bucket;
  /** Sostituibile nei test per simulare un errore di generazione. */
  render?: (definition: TDocumentDefinitions) => Promise<Buffer>;
}


async function loadLogo(bucket: Bucket, logoPath: string | null): Promise<PdfLogo | null> {
  if (!logoPath) return null;
  const file = bucket.file(logoPath);
  const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  const contentType = String(metadata.contentType ?? '');
  if (!(LOGO_TYPES as readonly string[]).includes(contentType)) throw new Error('Formato del logo non valido');
  return { dataUrl: `data:${contentType};base64,${bytes.toString('base64')}` };
}

/**
 * Genera il PDF solo dall'istantanea congelata, lo salva in Storage e aggiorna pdfStatus.
 * In caso di errore il preventivo resta emesso con il suo numero e pdfStatus "error": si può riprovare.
 */
export async function generateQuotePdf(
  deps: PdfDeps,
  companyId: string,
  quoteId: string,
): Promise<{ pdfStatus: PdfStatus; pdfPath: string | null }> {
  const ref = deps.db.doc(`companies/${companyId}/quotes/${quoteId}`);
  const snapshot = (await ref.get()).data()?.snapshot as QuoteSnapshot | undefined;
  if (!snapshot) throw new HttpsError('failed-precondition', 'Il preventivo non è stato emesso.', { reason: 'not-issued' });
  try {
    const logo = await loadLogo(deps.bucket, snapshot.company.logoPath);
    const pdf = await (deps.render ?? renderPdf)(buildPdfDefinition(snapshot, logo));
    const pdfPath = quotePdfPath(companyId, quoteId, snapshot.number.fileName);
    await deps.bucket.file(pdfPath).save(pdf, {
      resumable: false,
      contentType: 'application/pdf',
      metadata: { contentDisposition: `attachment; filename="${snapshot.number.fileName}"` },
    });
    await ref.update({ pdfStatus: 'ready', pdfPath, pdfGeneratedAt: FieldValue.serverTimestamp() });
    return { pdfStatus: 'ready', pdfPath };
  } catch (error) {
    // Nessun dato personale nel log: solo gli identificativi e il messaggio tecnico.
    logger.error('Generazione del PDF non riuscita', {
      companyId,
      quoteId,
      message: error instanceof Error ? error.message : String(error),
    });
    await ref.update({ pdfStatus: 'error' });
    return { pdfStatus: 'error', pdfPath: null };
  }
}

/** Rigenera il PDF di un preventivo emesso (o sostituito), senza toccare numero o contenuto. */
export async function regenerateQuotePdfHandler(deps: PdfDeps, uid: string, data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const companyId = requireString(input.companyId, 'companyId');
  const quoteId = requireString(input.quoteId, 'quoteId');
  await requireMember(deps.db, uid, companyId);
  const quote = (await deps.db.doc(`companies/${companyId}/quotes/${quoteId}`).get()).data();
  if (!quote) throw new HttpsError('not-found', 'Preventivo non trovato.');
  if (quote.status !== 'issued' && quote.status !== 'superseded') {
    throw new HttpsError('failed-precondition', 'Il preventivo non è stato emesso.', { reason: 'not-issued' });
  }
  return generateQuotePdf(deps, companyId, quoteId);
}
