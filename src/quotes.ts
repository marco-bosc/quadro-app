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
import { validateQuoteDraft, type QuoteDraftInput, type QuoteStatus } from '../shared/quote';

export interface Quote {
  id: string;
  title: string;
  notes: string;
  status: QuoteStatus;
  version: number;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
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

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toQuote(id: string, data: Record<string, unknown>): Quote {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    status: 'draft',
    version: typeof data.version === 'number' ? data.version : 0,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function assertValid(input: QuoteDraftInput) {
  const errors = validateQuoteDraft(input);
  if (errors.length > 0) throw new SaveError('invalid', errors.join(' '));
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
  input: QuoteDraftInput,
): Promise<{ id: string; version: number }> {
  assertValid(input);
  const ref = doc(quotesCollection(db, companyId));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (current.exists()) throw new SaveError('already-exists', 'Esiste già una bozza con questo identificativo.');
    tx.set(ref, {
      title: input.title,
      notes: input.notes,
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
  input: QuoteDraftInput,
): Promise<number> {
  assertValid(input);
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
        title: input.title,
        notes: input.notes,
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
