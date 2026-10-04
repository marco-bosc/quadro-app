// Copia nel browser delle modifiche non salvate di una bozza (per azienda e preventivo).
// Ogni accesso allo storage è protetto: se il browser lo blocca, l'app continua senza copia locale.

import { parseQuoteContent, type QuoteContent } from '../shared/quote';

const PREFIX = 'quadro:draft:v1';

export interface LocalDraft {
  /** Versione salvata da cui partivano le modifiche; null per una bozza mai salvata. */
  baseVersion: number | null;
  /** Momento dell'ultima modifica copiata (ISO). */
  savedAt: string;
  content: QuoteContent;
}

export function localDraftKey(companyId: string, quoteId: string | null): string {
  return `${PREFIX}:${companyId}:${quoteId ?? 'new'}`;
}

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLocalDraft(key: string, storage = defaultStorage()): LocalDraft | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data !== 'object' || data === null || typeof data.content !== 'object' || data.content === null) return null;
    return {
      baseVersion: typeof data.baseVersion === 'number' ? data.baseVersion : null,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
      content: parseQuoteContent(data.content as Record<string, unknown>),
    };
  } catch {
    return null;
  }
}

/** Restituisce false se la copia non è stata scritta (storage pieno o bloccato). */
export function writeLocalDraft(key: string, draft: LocalDraft, storage = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalDraft(key: string, storage = defaultStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // niente da fare: la copia resterà e verrà riproposta, mai applicata senza conferma
  }
}

/** Confronto di contenuto indipendente dall'ordine delle chiavi (i campi sono sempre gli stessi). */
export function sameContent(a: QuoteContent, b: QuoteContent): boolean {
  return JSON.stringify(parseQuoteContent(a as unknown as Record<string, unknown>)) ===
    JSON.stringify(parseQuoteContent(b as unknown as Record<string, unknown>));
}
