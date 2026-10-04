import { useEffect, useState, type FormEvent } from 'react';
import { QUOTE_NOTES_MAX, QUOTE_TITLE_MAX, validateQuoteDraft, type QuoteDraftInput } from '../shared/quote';
import { describeError } from './errors';
import { db } from './firebase';
import { formatDateTime, formatTime } from './format';
import { createQuote, getQuote, saveQuote, SaveError } from './quotes';

interface Props {
  companyId: string;
  uid: string;
  /** null = nuova bozza non ancora salvata */
  quoteId: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onCreated: (id: string) => void;
}

type Message = { kind: 'success' | 'error' | 'conflict'; text: string };

const EMPTY: QuoteDraftInput = { title: '', notes: '' };

export function QuoteEditorPage({ companyId, uid, quoteId: initialId, onDirtyChange, onCreated }: Props) {
  const [quoteId, setQuoteId] = useState(initialId);
  const [loading, setLoading] = useState(initialId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // Ultima versione confermata dal server, e ciò che l'utente sta scrivendo.
  const [saved, setSaved] = useState<QuoteDraftInput>(EMPTY);
  const [draft, setDraft] = useState<QuoteDraftInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const dirty = draft.title !== saved.title || draft.notes !== saved.notes;
  const validationErrors = validateQuoteDraft(draft);

  const load = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const quote = await getQuote(db, companyId, id);
      if (!quote) {
        setLoadError('Bozza non trovata.');
      } else {
        const values = { title: quote.title, notes: quote.notes };
        setSaved(values);
        setDraft(values);
        setVersion(quote.version);
        setUpdatedAt(quote.updatedAt);
        setMessage(null);
      }
    } catch (e) {
      setLoadError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale dei dati
    if (initialId) void load(initialId);
    // Si carica una sola volta all'apertura: ricaricare cancellerebbe le modifiche a schermo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Avviso del browser se si chiude o ricarica la pagina con modifiche non salvate.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || validationErrors.length > 0) return;
    const submitted = { ...draft };
    setSaving(true);
    setMessage(null);
    try {
      if (quoteId === null) {
        const created = await createQuote(db, companyId, uid, submitted);
        setQuoteId(created.id);
        setVersion(created.version);
        onCreated(created.id);
      } else {
        setVersion(await saveQuote(db, companyId, quoteId, version ?? 0, submitted));
      }
      // Solo dopo la conferma del server il testo inviato diventa "salvato".
      setSaved(submitted);
      const now = new Date();
      setUpdatedAt(now);
      setMessage({ kind: 'success', text: `Salvato alle ${formatTime(now)}.` });
    } catch (e) {
      const conflict = e instanceof SaveError && e.reason === 'conflict';
      setMessage({ kind: conflict ? 'conflict' : 'error', text: describeError(e) });
    } finally {
      setSaving(false);
    }
  };

  const reloadLatest = () => {
    if (!quoteId) return;
    if (!window.confirm('Caricando la versione più recente perderai le modifiche a schermo. Continuare?')) return;
    void load(quoteId);
  };

  if (loading) return <p className="muted">Caricamento…</p>;

  if (loadError) {
    return (
      <div className="stack">
        <p className="alert alert-error" role="alert">{loadError}</p>
        <a href="#/">Torna all’elenco</a>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="stack">
      <div className="row">
        <a href="#/">← Bozze</a>
        <span className="muted small">
          {quoteId === null ? 'Nuova bozza' : `Bozza · modificata ${formatDateTime(updatedAt)}`}
        </span>
      </div>

      <label>
        Titolo
        <input
          type="text"
          value={draft.title}
          maxLength={QUOTE_TITLE_MAX}
          placeholder="Es. Rifacimento impianto cucina"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>

      <label>
        Note
        <textarea
          rows={8}
          value={draft.notes}
          maxLength={QUOTE_NOTES_MAX}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
        <span className="muted small">{draft.notes.length} / {QUOTE_NOTES_MAX}</span>
      </label>

      {validationErrors.map((text) => (
        <p key={text} className="alert alert-error">{text}</p>
      ))}

      {message && (
        <div className={`alert ${message.kind === 'success' ? 'alert-success' : 'alert-error'}`} role="status">
          <p>{message.text}</p>
          {message.kind === 'conflict' && (
            <>
              <p className="small">Il tuo testo è ancora qui sopra: copialo se vuoi conservarlo.</p>
              <button type="button" onClick={reloadLatest}>Carica la versione più recente</button>
            </>
          )}
        </div>
      )}

      <div className="savebar">
        <span className={dirty ? 'unsaved' : 'muted small'} aria-live="polite">
          {dirty ? '● Modifiche non salvate' : quoteId === null ? 'Bozza vuota' : 'Tutto salvato'}
        </span>
        <button type="submit" className="primary" disabled={saving || !dirty || validationErrors.length > 0}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </form>
  );
}
