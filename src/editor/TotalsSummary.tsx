import type { IncompleteLine, MissingField, QuoteTotals } from '../../shared/calc';
import { formatEuro } from '../../shared/format';
import { DECIMALS } from '../../shared/money';
import { LIMITS, type QuoteContent } from '../../shared/quote';
import { isPlaceholderLegend, PLACEHOLDER_PREFIX, VAT } from '../../shared/vat';
import { DecimalField } from '../ui/DecimalField';
import { missingAmountsLabel } from './labels';

const MISSING_LABELS: Record<MissingField, string> = {
  description: 'descrizione',
  quantity: 'quantità',
  price: 'prezzo',
};

interface Props {
  content: QuoteContent;
  totals: QuoteTotals;
  onFinalDiscount: (cents: number | null) => void;
  onOpenLine: (line: IncompleteLine) => void;
  reporter: (key: string) => (invalid: boolean) => void;
}

/** Riepilogo dei totali (DESIGN §5.2): mai una cifra parziale presentata come definitiva. */
export function TotalsSummary({ content, totals, onFinalDiscount, onOpenLine, reporter }: Props) {
  const discountError = totals.errors.includes('discount-exceeds-taxable')
    ? `Lo sconto supera l’imponibile${totals.partial ? ' parziale' : ''} (${formatEuro(totals.taxableCents)}).`
    : null;
  const optionalCount = content.sections.reduce((n, s) => n + s.lines.filter((l) => l.optional && l.type !== 'text').length, 0);
  const sectionName = (l: IncompleteLine) => content.sections[l.sectionIndex]?.title.trim() || `Sezione ${l.sectionIndex + 1}`;

  return (
    <section id="riepilogo" className="totals stack" aria-labelledby="riepilogo-title">
      <h2 id="riepilogo-title">Riepilogo</h2>

      <dl className="totals-table num">
        <div>
          <dt>{totals.partial ? 'Imponibile parziale' : 'Imponibile'}</dt>
          <dd>{formatEuro(totals.taxableCents)}</dd>
        </div>
        {totals.finalDiscountCents > 0 && (
          <>
            <div>
              <dt>Sconto finale</dt>
              <dd>−{formatEuro(totals.finalDiscountCents)}</dd>
            </div>
            <div>
              <dt>Imponibile scontato</dt>
              <dd>{formatEuro(totals.discountedTaxableCents)}</dd>
            </div>
          </>
        )}
        {totals.vatGroups.map((g) => (
          <div key={g.code}>
            <dt>
              {g.rateBp > 0 ? `${VAT[g.code].label} su ${formatEuro(g.discountedTaxableCents)}` : VAT[g.code].label}
            </dt>
            <dd>{g.rateBp > 0 ? formatEuro(g.vatCents) : 'senza IVA'}</dd>
          </div>
        ))}
        <div className="totals-total">
          <dt>Totale{totals.vatCents > 0 ? ' IVA inclusa' : ''}</dt>
          <dd>{totals.partial ? <span className="missing">{missingAmountsLabel(totals)}</span> : formatEuro(totals.totalCents)}</dd>
        </div>
      </dl>

      {optionalCount > 0 && (
        <p className="muted small">
          {optionalCount === 1 ? '1 voce opzionale esclusa' : `${optionalCount} voci opzionali escluse`} dal totale.
        </p>
      )}

      <DecimalField
        label="Sconto finale"
        suffix="€"
        value={content.finalDiscountCents}
        decimals={DECIMALS.cents}
        minDecimals={2}
        max={LIMITS.finalDiscountCents}
        placeholder="nessuno"
        hint="Si applica agli imponibili prima dell’IVA."
        onChange={onFinalDiscount}
        onValidityChange={reporter('finalDiscount')}
      />
      {discountError && <p className="notice" role="alert">{discountError}</p>}

      {totals.incompleteLines.length > 0 && (
        <div className="stack incomplete">
          <p className="group-label">Da completare</p>
          <ul>
            {totals.incompleteLines.map((l) => (
              <li key={l.lineId}>
                <button type="button" className="link-button" onClick={() => onOpenLine(l)}>
                  {sectionName(l)} · riga {l.lineIndex + 1}
                  {l.optional ? ' (opzionale)' : ''}: {l.missing.map((m) => MISSING_LABELS[m]).join(', ')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totals.legends.length > 0 && (
        <div className="legends stack">
          {totals.legends.map((legend) =>
            isPlaceholderLegend(legend) ? (
              <p key={legend} className="small">
                <span className="placeholder-legend">{PLACEHOLDER_PREFIX}</span>
                {legend.slice(PLACEHOLDER_PREFIX.length)}
              </p>
            ) : (
              <p key={legend} className="small">{legend}</p>
            ),
          )}
        </div>
      )}
    </section>
  );
}
