import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { formatEuro, formatPercent, formatQuantity, formatUnitPrice } from '../shared/format';
import { describeError } from './errors';
import { db } from './firebase';
import { formatLongDate, formatTime } from './format';
import { downloadPdf, errorDetails, regenerateQuotePdf, startRevision } from './issuing';
import { toQuote, type Quote } from './quotes';
import { Button } from './ui/Button';
import { BackIcon } from './ui/icons';
import './IssuedQuotePage.css';

interface Props {
  companyId: string;
  quoteId: string;
}

/** "2026-10-04" → data locale senza problemi di fuso. */
/** Un'istantanea emessa è completa; se mancasse un valore si mostra "—", mai uno zero. */
const euro = (cents: number | null | undefined) => (cents == null ? '—' : formatEuro(cents));

function issueDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatLongDate(new Date(y, m - 1, d));
}

/**
 * Preventivo emesso o sostituito: sola lettura, dati dall'istantanea.
 * Condividere non significa inviato: l'app non lo registra come invio (DESIGN §5.5).
 */
export function IssuedQuotePage({ companyId, quoteId }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedAt, setSharedAt] = useState<Date | null>(null);

  // Ascolto del documento: lo stato del PDF passa da "pending" a "ready" senza ricaricare.
  useEffect(() => {
    document.title = 'Preventivo emesso · Quadro';
    return onSnapshot(
      doc(db, 'companies', companyId, 'quotes', quoteId),
      (snap) => (snap.exists() ? setQuote(toQuote(snap.id, snap.data())) : setLoadError('Preventivo non trovato.')),
      (e) => setLoadError(describeError(e)),
    );
  }, [companyId, quoteId]);

  // Il PDF si scarica appena pronto: così "Condividi" parte subito dal tocco dell'utente.
  const pdfPath = quote?.pdfStatus === 'ready' ? quote.pdfPath : null;
  const fileName = quote?.snapshot?.number.fileName ?? 'Preventivo.pdf';
  useEffect(() => {
    if (!pdfPath) return;
    let cancelled = false;
    downloadPdf(pdfPath, fileName)
      .then((file) => !cancelled && setPdfFile(file))
      .catch((e: unknown) => !cancelled && setError(`PDF non scaricato: ${describeError(e)}`));
    return () => {
      cancelled = true;
    };
  }, [pdfPath, fileName]);

  if (loadError) {
    return (
      <main className="page">
        <p className="notice" role="alert">{loadError}</p>
        <a href="#/">Torna ai preventivi</a>
      </main>
    );
  }
  if (!quote?.snapshot) return <main className="page"><p className="muted">Caricamento…</p></main>;

  const { snapshot } = quote;
  const { content, totals, company } = snapshot;
  const display = snapshot.number.display;
  const canShare = pdfFile !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdfFile] });
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.customer.contact.trim()) ? content.customer.contact.trim() : '';
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Preventivo ${display}`)}&body=${encodeURIComponent(
    `Buongiorno,\nle invio il preventivo ${display}${content.title ? ` («${content.title}»)` : ''}.\n\nCordiali saluti\n${company.signerName || company.legalName}`,
  )}`;

  const save = () => {
    if (!pdfFile) return;
    const url = URL.createObjectURL(pdfFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const share = async () => {
    if (!pdfFile) return;
    try {
      await navigator.share({ files: [pdfFile], title: `Preventivo ${display}` });
      setSharedAt(new Date());
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setError('Condivisione non riuscita. Scarica il PDF e allegalo a mano.');
    }
  };

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await regenerateQuotePdf({ companyId, quoteId });
      if (result.pdfStatus !== 'ready') setError('Il PDF non è stato generato. Riprova tra poco.');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const correct = async () => {
    if (!window.confirm(`Creare una versione corretta di ${display}? L’originale resta valido finché non emetti la correzione.`)) return;
    setBusy(true);
    setError(null);
    try {
      const { quoteId: revisionId } = await startRevision({ companyId, quoteId });
      window.location.hash = `#/quotes/${revisionId}`;
    } catch (e) {
      const revisionId = errorDetails(e).revisionId;
      if (typeof revisionId === 'string') window.location.hash = `#/quotes/${revisionId}`;
      else setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const optional = content.sections.flatMap((s) => s.lines.filter((l) => l.optional && l.type !== 'text'));

  return (
    <>
      <header className="detail-header">
        <a href="#/" className="back-link"><BackIcon /> Preventivi</a>
        <span className="muted small">Preventivo · {quote.status === 'superseded' ? 'sostituito' : 'emesso'}</span>
      </header>

      <main className="page issued">
        <div className="stack issued-head">
          <p className="issued-number">N. {display} · {issueDate(snapshot.issueDate)}</p>
          <h1 className="issued-title">{content.title.trim() || 'Preventivo'}</h1>
          <p className="muted">
            {content.customer.name || 'Cliente non indicato'}
            {content.customer.siteAddress ? ` · ${content.customer.siteAddress}` : ''}
          </p>
          <p className="issued-total num">
            {formatEuro(totals.totalCents)} <span className="muted small">{totals.vatCents > 0 ? 'IVA inclusa' : ''}</span>
          </p>
        </div>

        {quote.status === 'superseded' && (
          <p className="notice info">
            Questo preventivo è stato sostituito da{' '}
            {quote.supersededBy ? <a href={`#/quotes/${quote.supersededBy}`}>una versione corretta</a> : 'una versione corretta'}.
            Resta consultabile così com’è stato emesso.
          </p>
        )}

        <section className="stack" aria-labelledby="pdf-title">
          <h2 id="pdf-title">Invia al cliente</h2>
          {quote.pdfStatus === 'pending' && <p className="muted">PDF in preparazione…</p>}
          {quote.pdfStatus === 'error' && (
            <div className="notice">
              <p>Il PDF non è stato generato. Il preventivo è comunque emesso con il numero {display}.</p>
              <Button variant="secondary" strong disabled={busy} onClick={regenerate}>{busy ? 'Generazione…' : 'Genera di nuovo il PDF'}</Button>
            </div>
          )}
          {quote.pdfStatus === 'ready' && (
            <>
              <p className="muted small">{fileName}{pdfFile ? '' : ' · preparazione del download…'}</p>
              <div className="row-wrap">
                {canShare && <Button variant="primary" onClick={share}>Condividi</Button>}
                <Button variant="secondary" strong disabled={!pdfFile} onClick={save}>Scarica PDF</Button>
                {!canShare && (
                  <a className="btn btn-secondary" href={mailto}>Apri email</a>
                )}
              </div>
              {!canShare && <p className="muted small">Con «Apri email» allega il PDF scaricato.</p>}
              {sharedAt && (
                <p className="muted small">
                  Ultima condivisione aperta oggi alle {formatTime(sharedAt)}. Questo non conferma che il cliente l’abbia ricevuto.
                </p>
              )}
            </>
          )}
          {error && <p className="notice" role="alert">{error}</p>}
        </section>

        {quote.status === 'issued' && (
          <section className="stack">
            {quote.openRevisionId ? (
              <a href={`#/quotes/${quote.openRevisionId}`}>Apri la versione corretta in preparazione</a>
            ) : (
              <div>
                <Button variant="text" disabled={busy} onClick={correct}>Crea una versione corretta</Button>
              </div>
            )}
          </section>
        )}

        <section className="stack" aria-labelledby="contenuto-title">
          <h2 id="contenuto-title">Contenuto</h2>
          {content.sections.map((section, i) => (
            <div key={section.id} className="stack issued-section">
              <p className="section-title"><span className="section-number">{i + 1}</span> {section.title || `Sezione ${i + 1}`}</p>
              <ul className="issued-lines">
                {section.lines
                  .filter((l) => !l.optional)
                  .map((l) =>
                    l.type === 'text' ? (
                      <li key={l.id} className="issued-comment">{l.description}</li>
                    ) : (
                      <li key={l.id}>
                        <span>{l.description}</span>
                        <span className="issued-line-detail num">
                          <span className="muted">
                            {l.quantityMilli == null ? '—' : `${formatQuantity(l.quantityMilli)} ${l.unit}`} ×{' '}
                            {l.unitPriceTenThousandths == null ? '—' : `${formatUnitPrice(l.unitPriceTenThousandths)} €`}
                            {l.discountBp > 0 ? ` −${formatPercent(l.discountBp)}` : ''}
                          </span>
                          <strong>{euro(totals.lineAmounts[l.id])}</strong>
                        </span>
                      </li>
                    ),
                  )}
              </ul>
            </div>
          ))}
          {optional.length > 0 && (
            <div className="stack issued-section">
              <p className="group-label">Voci opzionali (non incluse nel totale)</p>
              <ul className="issued-lines">
                {optional.map((l) => (
                  <li key={l.id}>
                    <span>{l.description}</span>
                    <strong className="num">{euro(totals.lineAmounts[l.id])}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="totals-table num">
            <div><dt>Imponibile</dt><dd>{formatEuro(totals.taxableCents)}</dd></div>
            {totals.finalDiscountCents > 0 && <div><dt>Sconto finale</dt><dd>−{formatEuro(totals.finalDiscountCents)}</dd></div>}
            {totals.vatGroups.map((g) => {
              const label = snapshot.vatTexts.find((t) => t.code === g.code)?.label ?? g.code;
              return (
                <div key={g.code}>
                  <dt>{g.rateBp > 0 ? `${label} su ${formatEuro(g.discountedTaxableCents)}` : label}</dt>
                  <dd>{g.rateBp > 0 ? formatEuro(g.vatCents) : 'senza IVA'}</dd>
                </div>
              );
            })}
            <div className="totals-total"><dt>Totale{totals.vatCents > 0 ? ' IVA inclusa' : ''}</dt><dd>{formatEuro(totals.totalCents)}</dd></div>
          </dl>
        </section>
      </main>
    </>
  );
}
