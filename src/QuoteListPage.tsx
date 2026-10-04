import { useCallback, useEffect, useState } from 'react';
import { calculateQuote } from '../shared/calc';
import { formatEuro } from '../shared/format';
import type { TaxRegime } from '../shared/vat';
import { missingAmountsLabel } from './editor/labels';
import { describeError } from './errors';
import { db } from './firebase';
import { formatRelative, formatToday } from './format';
import { listQuotes, type Quote } from './quotes';
import { Button } from './ui/Button';
import { buttonClass } from './ui/buttonClass';
import './QuoteListPage.css';

interface Props {
  companyId: string;
  companyName: string;
  regime: TaxRegime;
}

function QuoteRow({ quote, regime }: { quote: Quote; regime: TaxRegime }) {
  const totals = calculateQuote(quote.content, regime);
  const { title, customer } = quote.content;
  return (
    <li>
      <a className="doc-row" href={`#/quotes/${quote.id}`}>
        <span className="doc-row-top">
          <span className="doc-title">{title.trim() || 'Preventivo senza oggetto'}</span>
          <span className="doc-amount num">
            {totals.partial ? <span className="missing">{missingAmountsLabel(totals)}</span> : formatEuro(totals.totalCents)}
          </span>
        </span>
        <span className="doc-row-bottom">
          <span className="muted small">
            {customer.name.trim() || 'Cliente da indicare'} · {formatRelative(quote.updatedAt)}
          </span>
          <span className={`status-text${totals.complete ? '' : ' warning'}`}>
            {totals.complete ? 'Bozza' : 'Bozza incompleta'}
          </span>
        </span>
      </a>
    </li>
  );
}

/** Home "Oggi": per ora solo le bozze (le richieste arriveranno con I03). */
export function QuoteListPage({ companyId, companyName, regime }: Props) {
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

  useEffect(() => {
    document.title = 'Bozze · Quadro';
  }, []);

  return (
    <main className="page with-bottom-bar">
      <div>
        <p className="group-label">{companyName}</p>
        <p className="muted small">{formatToday()}</p>
      </div>
      <h1>Bozze</h1>

      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <Button variant="secondary" strong onClick={load}>Riprova</Button>
        </div>
      )}

      {!error && quotes === null && <p className="muted">Caricamento…</p>}
      {quotes?.length === 0 && <p className="muted">Nessuna bozza. Creane una con «Nuovo preventivo».</p>}

      {quotes && quotes.length > 0 && (
        <ul className="doc-list">
          {quotes.map((q) => (
            <QuoteRow key={q.id} quote={q} regime={regime} />
          ))}
        </ul>
      )}

      <div className="home-actions">
        <a className={buttonClass('primary', 'full')} href="#/quotes/new">Nuovo preventivo</a>
      </div>
    </main>
  );
}
