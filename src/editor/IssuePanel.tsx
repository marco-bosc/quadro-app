import { useEffect, useRef, useState } from 'react';
import type { IncompleteLine, QuoteTotals } from '../../shared/calc';
import { missingForIssue, type CompanyProfile } from '../../shared/company';
import { formatEuro } from '../../shared/format';
import { displayQuoteNumber } from '../../shared/numbering';
import type { QuoteContent } from '../../shared/quote';
import { describeError } from '../errors';
import { db } from '../firebase';
import { issueQuote } from '../issuing';
import { getNextNumber } from '../settings';
import { Button } from '../ui/Button';

const PROFILE_LABELS: Partial<Record<keyof CompanyProfile, string>> = {
  legalName: 'ragione sociale',
  vatNumber: 'partita IVA valida',
  address: 'indirizzo',
};

interface Props {
  companyId: string;
  quoteId: string | null;
  version: number | null;
  content: QuoteContent;
  totals: QuoteTotals;
  profile: CompanyProfile;
  /** Modifiche non salvate, salvataggio in corso o campi non validi. */
  unsaved: boolean;
  /** Per le revisioni: numero che riceverà (es. "2026/001 rev. 1"). */
  revisionNumber: string | null;
  onOpenIncomplete: (line: IncompleteLine) => void;
  onIssued: () => void;
}

/** Emissione: disponibile solo con bozza salvata, completa e dati dell'azienda presenti (DESIGN §5.2). */
export function IssuePanel(props: Props) {
  const { companyId, quoteId, version, content, totals, profile, unsaved, revisionNumber } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [nextNumber, setNextNumber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missingProfile = missingForIssue(profile);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const openConfirm = async () => {
    setError(null);
    setNextNumber(revisionNumber);
    setOpen(true);
    if (!revisionNumber) {
      try {
        const { year, next } = await getNextNumber(db, companyId);
        setNextNumber(displayQuoteNumber({ year, sequence: next, revision: 0 }));
      } catch {
        setNextNumber(null);
      }
    }
  };

  const confirm = async () => {
    if (busy || quoteId === null || version === null) return;
    setBusy(true);
    setError(null);
    try {
      await issueQuote({ companyId, quoteId, version });
      setOpen(false);
      props.onIssued();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (quoteId === null || unsaved) {
    body = <p className="muted">Salva la bozza prima di emetterla.</p>;
  } else if (!totals.complete) {
    const first = totals.incompleteLines[0];
    body = (
      <>
        <p className="warning">
          Per emettere il preventivo{' '}
          {totals.errors.includes('discount-exceeds-taxable')
            ? 'correggi lo sconto finale'
            : `completa ${totals.incompleteLines.length === 1 ? '1 riga' : `${totals.incompleteLines.length} righe`}`}
          .
        </p>
        {first && (
          <div>
            <Button variant="secondary" strong onClick={() => props.onOpenIncomplete(first)}>Vai alla prima riga da completare</Button>
          </div>
        )}
      </>
    );
  } else if (missingProfile.length > 0) {
    body = (
      <p className="warning">
        Per emettere servono i dati dell’azienda: {missingProfile.map((f) => PROFILE_LABELS[f]).join(', ')}.{' '}
        <a href="#/settings">Completa il Profilo</a>
      </p>
    );
  } else {
    body = (
      <div>
        <Button variant="confirm" onClick={openConfirm}>Emetti{revisionNumber ? ' la revisione' : ''}</Button>
      </div>
    );
  }

  return (
    <section className="stack issue-panel" aria-labelledby="emissione-title">
      <h2 id="emissione-title">Emissione</h2>
      {body}

      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby="confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setOpen(false);
        }}
      >
        <div className="stack">
          <h2 id="confirm-title">Emettere il preventivo?</h2>
          <dl className="confirm-summary">
            <div><dt>Numero</dt><dd>{nextNumber ?? 'assegnato all’emissione'}</dd></div>
            <div><dt>Oggetto</dt><dd>{content.title.trim() || '—'}</dd></div>
            <div><dt>Cliente</dt><dd>{content.customer.name.trim() || '—'}</dd></div>
            <div><dt>Totale</dt><dd className="num"><strong>{formatEuro(totals.totalCents)}</strong>{totals.vatCents > 0 ? ' IVA inclusa' : ''}</dd></div>
          </dl>
          <p>
            Dopo l’emissione il preventivo non sarà più modificabile. Per correggerlo crei una nuova versione collegata,
            con lo stesso numero.
          </p>
          {error && <p className="notice" role="alert">{error}</p>}
          <div className="confirm-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Annulla</Button>
            <Button variant="confirm" disabled={busy} onClick={confirm}>{busy ? 'Emissione…' : 'Conferma ed emetti'}</Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
