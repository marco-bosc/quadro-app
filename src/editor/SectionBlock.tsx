import type { QuoteTotals } from '../../shared/calc';
import { formatEuro } from '../../shared/format';
import { LIMITS, type LineType, type QuoteSection } from '../../shared/quote';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { DownIcon, PlusIcon, UpIcon } from '../ui/icons';
import { LineRow } from './LineRow';

interface Props {
  section: QuoteSection;
  index: number;
  count: number;
  totals: QuoteTotals;
  defaultVatCode: string;
  showVat: boolean;
  collapsed: boolean;
  canAddLine: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onAddLine: (type: LineType) => void;
  onOpenLine: (lineId: string) => void;
}

const ADD_BUTTONS: { type: LineType; label: string }[] = [
  { type: 'material', label: 'Materiale' },
  { type: 'labor', label: 'Manodopera' },
  { type: 'lump_sum', label: 'A corpo' },
  { type: 'text', label: 'Commento' },
];

export function SectionBlock(props: Props) {
  const { section, index, count, totals, defaultVatCode, showVat, collapsed, canAddLine } = props;
  const subtotal = totals.sectionSubtotals.find((s) => s.sectionId === section.id);
  const contentId = `section-${section.id}`;
  const title = section.title.trim() || 'Sezione senza titolo';

  return (
    <section className="quote-section" aria-labelledby={`${contentId}-title`}>
      <div className="section-header">
        <button
          type="button"
          className="section-toggle"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={props.onToggle}
        >
          <span className="section-number">{index + 1}</span>
          <span id={`${contentId}-title`} className="section-title">{title}</span>
          <span className="section-subtotal num">
            {subtotal && !subtotal.complete ? <span className="warning">parziale</span> : null}{' '}
            {subtotal ? formatEuro(subtotal.amountCents) : ''}
          </span>
        </button>
      </div>

      {!collapsed && (
        <div id={contentId} className="stack">
          <Field
            label="Titolo della sezione"
            value={section.title}
            maxLength={LIMITS.sectionTitle}
            placeholder="Es. Quadro elettrico, Cucina"
            onChange={(e) => props.onRename(e.target.value)}
          />

          {section.lines.length === 0 ? (
            <p className="muted small">Nessuna riga in questa sezione.</p>
          ) : (
            <ul className="line-list">
              {section.lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  amountCents={totals.lineAmounts[line.id]}
                  vatCode={totals.lineVatCodes[line.id]}
                  showVat={showVat && totals.lineVatCodes[line.id] !== defaultVatCode}
                  onOpen={() => props.onOpenLine(line.id)}
                />
              ))}
            </ul>
          )}

          <div className="add-buttons" role="group" aria-label={`Aggiungi una riga alla sezione ${index + 1}`}>
            {ADD_BUTTONS.map(({ type, label }) => (
              <Button key={type} variant="pill" strong={type === 'material'} disabled={!canAddLine} onClick={() => props.onAddLine(type)}>
                <PlusIcon /> {label}
              </Button>
            ))}
          </div>

          <div className="section-actions">
            <Button variant="icon" aria-label={`Sposta la sezione ${index + 1} su`} disabled={index === 0} onClick={() => props.onMove(-1)}>
              <UpIcon />
            </Button>
            <Button variant="icon" aria-label={`Sposta la sezione ${index + 1} giù`} disabled={index === count - 1} onClick={() => props.onMove(1)}>
              <DownIcon />
            </Button>
            <Button variant="text" tone="warning" onClick={props.onDelete}>Elimina sezione</Button>
          </div>
        </div>
      )}
    </section>
  );
}
