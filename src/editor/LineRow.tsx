import { formatEuro, formatPercent, formatQuantity, formatUnitPrice } from '../../shared/format';
import type { QuoteLine } from '../../shared/quote';
import { VAT, type VatCode } from '../../shared/vat';

interface Props {
  line: QuoteLine;
  amountCents: number | null | undefined;
  /** Codice IVA effettivo, mostrato solo se diverso dall'aliquota predefinita del preventivo. */
  vatCode: VatCode | undefined;
  showVat: boolean;
  onOpen: () => void;
}

function Missing({ children }: { children: string }) {
  return <span className="missing">{children}</span>;
}

/** Riga del preventivo come apparirà sul documento; toccandola si apre la modifica. */
export function LineRow({ line, amountCents, vatCode, showVat, onOpen }: Props) {
  const description = line.description.trim();

  if (line.type === 'text') {
    return (
      <li>
        <button type="button" id={`line-${line.id}`} className="line-row comment" onClick={onOpen}>
          {description ? <span>{line.description}</span> : <Missing>commento da scrivere</Missing>}
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        id={`line-${line.id}`}
        className={`line-row${line.optional ? ' optional' : ''}`}
        onClick={onOpen}
      >
        {line.optional && <span className="line-flag">Opzionale · esclusa dal totale</span>}
        <span className="line-description">{description ? line.description : <Missing>descrizione da inserire</Missing>}</span>
        <span className="line-detail">
          <span className="line-calc num">
            {line.quantityMilli === null ? <Missing>quantità da inserire</Missing> : `${formatQuantity(line.quantityMilli)} ${line.unit}`}
            {' × '}
            {line.unitPriceTenThousandths === null ? (
              <Missing>prezzo da inserire</Missing>
            ) : (
              `${formatUnitPrice(line.unitPriceTenThousandths)} €`
            )}
            {line.discountBp > 0 && ` −${formatPercent(line.discountBp)}`}
            {showVat && vatCode && <span className="line-vat"> · {VAT[vatCode].label}</span>}
          </span>
          <span className="line-amount num">{amountCents == null ? '—' : formatEuro(amountCents)}</span>
        </span>
      </button>
    </li>
  );
}
