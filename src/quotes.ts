import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { parseQuoteContent, validateQuoteContent, type QuoteContent } from '../shared/quote';
import type { PdfStatus, QuoteSnapshot, QuoteStatus } from '../shared/snapshot';
import type { TaxRegime } from '../shared/vat';

export interface Quote {
  id: string;
  /** Contenuto della bozza; per un preventivo emesso fa fede `snapshot`. */
  content: QuoteContent;
  status: QuoteStatus;
  version: number;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Solo per le bozze di revisione: preventivo corretto e numero di revisione previsto. */
  revisionOf: string | null;
  revision: number;
  /** Solo per i preventivi emessi o sostituiti (scritti dal server). */
  displayNumber: string | null;
  issuedAt: Date | null;
  snapshot: QuoteSnapshot | null;
  pdfStatus: PdfStatus | null;
  pdfPath: string | null;
  openRevisionId: string | null;
  supersededBy: string | null;
}

/** Errore di salvataggio con un motivo riconoscibile dall'interfaccia. */
export class SaveError extends Error {
  readonly reason: 'conflict' | 'not-found' | 'already-exists' | 'invalid';

  constructor(reason: SaveError['reason'], message: string) {
    super(message);
    this.reason = reason;
  }
}

const LIST_LIMIT = 50;

function quotesCollection(db: Firestore, companyId: string) {
  return collection(db, 'companies', companyId, 'quotes');
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

export function toQuote(id: string, data: Record<string, unknown>): Quote {
  return {
    id,
    // Le bozze di I01 (solo titolo e note) vengono lette con i campi nuovi vuoti
    // e salvate nel formato nuovo al primo salvataggio.
    content: parseQuoteContent(data),
    status: data.status === 'issued' || data.status === 'superseded' ? data.status : 'draft',
    version: typeof data.version === 'number' ? data.version : 0,
    createdBy: str(data.createdBy) ?? '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    revisionOf: str(data.revisionOf),
    revision: typeof data.revision === 'number' ? data.revision : 0,
    displayNumber: str(data.displayNumber),
    issuedAt: toDate(data.issuedAt),
    snapshot: typeof data.snapshot === 'object' && data.snapshot !== null ? (data.snapshot as QuoteSnapshot) : null,
    pdfStatus: data.pdfStatus === 'pending' || data.pdfStatus === 'ready' || data.pdfStatus === 'error' ? data.pdfStatus : null,
    pdfPath: str(data.pdfPath),
    openRevisionId: str(data.openRevisionId),
    supersededBy: str(data.supersededBy),
  };
}

function assertValid(content: QuoteContent, regime: TaxRegime) {
  const issues = validateQuoteContent(content, regime);
  if (issues.length > 0) throw new SaveError('invalid', issues.map((i) => i.message).join(' '));
}

/** Campi del contenuto salvati nel documento (copia esplicita: nessun campo estraneo finisce nel database). */
function contentFields(content: QuoteContent) {
  return {
    title: content.title,
    notes: content.notes,
    customer: { ...content.customer },
    validityText: content.validityText,
    paymentTermsText: content.paymentTermsText,
    defaultVatCode: content.defaultVatCode,
    finalDiscountCents: content.finalDiscountCents,
    pdfDetail: content.pdfDetail,
    sections: content.sections.map((section) => ({
      id: section.id,
      title: section.title,
      lines: section.lines.map((line) => ({ ...line })),
    })),
  };
}

export async function listQuotes(db: Firestore, companyId: string): Promise<Quote[]> {
  const snap = await getDocs(query(quotesCollection(db, companyId), orderBy('updatedAt', 'desc'), limit(LIST_LIMIT)));
  return snap.docs.map((d) => toQuote(d.id, d.data()));
}

export async function getQuote(db: Firestore, companyId: string, quoteId: string): Promise<Quote | null> {
  const snap = await getDoc(doc(quotesCollection(db, companyId), quoteId));
  return snap.exists() ? toQuote(snap.id, snap.data()) : null;
}

/**
 * Crea una nuova bozza (versione 1). Usa una transazione invece di setDoc:
 * senza connessione fallisce subito invece di restare in coda, così
 * l'interfaccia non dichiara mai un salvataggio non avvenuto.
 */
export async function createQuote(
  db: Firestore,
  companyId: string,
  uid: string,
  content: QuoteContent,
  regime: TaxRegime,
): Promise<{ id: string; version: number }> {
  assertValid(content, regime);
  const ref = doc(quotesCollection(db, companyId));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (current.exists()) throw new SaveError('already-exists', 'Esiste già una bozza con questo identificativo.');
    tx.set(ref, {
      ...contentFields(content),
      status: 'draft',
      version: 1,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return { id: ref.id, version: 1 };
}

/**
 * Salva una bozza esistente solo se è ancora alla versione da cui l'utente è partito.
 * Se nel frattempo qualcuno l'ha salvata, lancia SaveError('conflict') e non scrive nulla.
 * Restituisce la nuova versione.
 */
export async function saveQuote(
  db: Firestore,
  companyId: string,
  quoteId: string,
  expectedVersion: number,
  content: QuoteContent,
  regime: TaxRegime,
): Promise<number> {
  assertValid(content, regime);
  const ref = doc(quotesCollection(db, companyId), quoteId);
  const conflict = () =>
    new SaveError(
      'conflict',
      'La bozza è stata modificata altrove dopo che l’hai aperta. Le tue modifiche non sono state salvate.',
    );
  try {
    return await runTransaction(db, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists()) throw new SaveError('not-found', 'La bozza non esiste più.');
      if (current.data().version !== expectedVersion) throw conflict();
      const nextVersion = expectedVersion + 1;
      tx.update(ref, {
        ...contentFields(content),
        version: nextVersion,
        updatedAt: serverTimestamp(),
      });
      return nextVersion;
    });
  } catch (error) {
    // Se un altro salvataggio è arrivato tra la lettura e la scrittura, le regole
    // rifiutano la scrittura (la versione non è più attuale+1). Lo distinguiamo
    // da un vero problema di permessi rileggendo la versione.
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      const latest = await getDoc(ref).catch(() => null);
      if (latest?.exists() && latest.data().version !== expectedVersion) throw conflict();
    }
    throw error;
  }
}
