import { useCallback, useEffect, useState } from 'react';
import { describeError } from './errors';
import { db } from './firebase';
import { formatDateTime } from './format';
import { listQuotes, type Quote } from './quotes';

export function QuoteListPage({ companyId }: { companyId: string }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setQuotes(await listQuotes(db, companyId));
    } catch (e) {
      setError(describeError(e));
    }
  }, [companyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale dei dati
    void load();
  }, [load]);

  return (
    <section className="stack">
      <div className="row">
        <h1>Bozze</h1>
        <a className="button primary" href="#/quotes/new">Nuova bozza</a>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={load}>Riprova</button>
        </div>
      )}

      {!error && quotes === null && <p className="muted">Caricamento…</p>}
      {quotes?.length === 0 && <p className="muted">Nessuna bozza. Creane una con «Nuova bozza».</p>}

      {quotes && quotes.length > 0 && (
        <ul className="list">
          {quotes.map((q) => (
            <li key={q.id}>
              <a href={`#/quotes/${q.id}`}>
                <span className="list-title">{q.title || '(senza titolo)'}</span>
                <span className="muted small">Modificata {formatDateTime(q.updatedAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
