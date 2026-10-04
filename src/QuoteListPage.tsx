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

/** Riga dell'elenco: per gli emessi fanno fede numero e totali dell'istantanea. */
function QuoteRow({ quote, regime, byId }: { quote: Quote; regime: TaxRegime; byId: Map<string, Quote> }) {
  const issued = quote.status !== 'draft' && quote.snapshot !== null;
  const content = issued ? quote.snapshot!.content : quote.content;
  const totals = issued ? null : calculateQuote(quote.content, regime);
  const original = quote.revisionOf ? byId.get(quote.revisionOf) : undefined;
  const replacement = quote.supersededBy ? byId.get(quote.supersededBy) : undefined;

  let status: { text: string; warning?: boolean };
  if (quote.status === 'issued') status = { text: 'Emesso' };
  else if (quote.status === 'superseded') status = { text: 'Sostituito' };
  else if (!totals!.complete) status = { text: 'Bozza incompleta', warning: true };
  else status = { text: 'Bozza' };

  const label = issued
    ? quote.displayNumber
    : quote.revisionOf
      ? `Correzione di ${original?.displayNumber ?? 'un preventivo emesso'}`
      : null;

  return (
    <li>
      <a className={`doc-row${quote.status === 'superseded' ? ' superseded' : ''}`} href={`#/quotes/${quote.id}`}>
        {label && <span className="doc-number num">{label}</span>}
        <span className="doc-row-top">
          <span className="doc-title">{content.title.trim() || 'Preventivo senza oggetto'}</span>
          <span className="doc-amount num">
            {issued ? (
              formatEuro(quote.snapshot!.totals.totalCents)
            ) : totals!.partial ? (
              <span className="missing">{missingAmountsLabel(totals!)}</span>
            ) : (
              formatEuro(totals!.totalCents)
            )}
          </span>
        </span>
        <span className="doc-row-bottom">
          <span className="muted small">
            {content.customer.name.trim() || 'Cliente da indicare'} · {formatRelative(quote.issuedAt ?? quote.updatedAt)}
            {quote.status === 'superseded' && replacement?.displayNumber ? ` · sostituito da ${replacement.displayNumber}` : ''}
          </span>
          <span className={`status-text${status.warning ? ' warning' : ''}`}>{status.text}</span>
        </span>
      </a>
    </li>
  );
}

/** Home "Oggi": per ora solo i preventivi (le richieste arriveranno con I03). */
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
    document.title = 'Preventivi · Quadro';
  }, []);

  const byId = new Map((quotes ?? []).map((q) => [q.id, q]));

  return (
    <main className="page with-bottom-bar">
      <div>
        <p className="group-label">{companyName}</p>
        <p className="muted small">{formatToday()}</p>
      </div>
      <h1>Preventivi</h1>

      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <Button variant="secondary" strong onClick={load}>Riprova</Button>
        </div>
      )}

      {!error && quotes === null && <p className="muted">Caricamento…</p>}
      {quotes?.length === 0 && <p className="muted">Nessun preventivo. Creane uno con «Nuovo preventivo».</p>}

      {quotes && quotes.length > 0 && (
        <ul className="doc-list">
          {quotes.map((q) => (
            <QuoteRow key={q.id} quote={q} regime={regime} byId={byId} />
          ))}
        </ul>
      )}

      <div className="home-actions">
        <a className={buttonClass('primary', 'full')} href="#/quotes/new">Nuovo preventivo</a>
      </div>
    </main>
  );
}
