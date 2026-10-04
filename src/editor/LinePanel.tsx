import { useEffect, useRef, useState } from 'react';
import { lineAmountCents } from '../../shared/calc';
import { formatEuro } from '../../shared/format';
import { DECIMALS } from '../../shared/money';
import { LIMITS, LINE_TYPES, UNITS, type LineType, type QuoteLine } from '../../shared/quote';
import { allowedVatCodes, VAT, type TaxRegime } from '../../shared/vat';
import { Button } from '../ui/Button';
import { DecimalField } from '../ui/DecimalField';
import { Field, SelectField, TextAreaField } from '../ui/Field';
import { DownIcon, UpIcon } from '../ui/icons';
import { LINE_TYPE_LABELS } from './labels';

interface Props {
  line: QuoteLine;
  /** Posizione per il titolo del pannello, es. "Cucina · riga 3". */
  position: string;
  regime: TaxRegime;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<QuoteLine>) => void;
  onChangeType: (type: LineType) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  reporter: (key: string) => (invalid: boolean) => void;
  hasInvalid: boolean;
}

/** Modifica di una riga in un pannello a tutto schermo, comodo da telefono. */
export function LinePanel(props: Props) {
  const { line, position, regime, isFirst, isLast, onChange, onChangeType, onMove, onDuplicate, onDelete, onClose, reporter, hasInvalid } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const isText = line.type === 'text';
  const key = (field: string) => `line:${line.id}:${field}`;
  const amount = lineAmountCents(line);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const tryClose = () => {
    if (hasInvalid) {
      setCloseBlocked(true);
      return;
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="line-panel"
      aria-labelledby="line-panel-title"
      onCancel={(e) => {
        e.preventDefault();
        tryClose();
      }}
    >
      <div className="line-panel-header">
        <div>
          <p className="group-label">{position}</p>
          <h2 id="line-panel-title">{LINE_TYPE_LABELS[line.type]}</h2>
        </div>
        <Button variant="primary" onClick={tryClose}>Fatto</Button>
      </div>

      <div className="line-panel-body stack">
        {closeBlocked && hasInvalid && (
          <p className="notice" role="alert">Correggi i campi evidenziati prima di chiudere.</p>
        )}

        <SelectField label="Tipo" value={line.type} onChange={(e) => onChangeType(e.target.value as LineType)}>
          {LINE_TYPES.map((t) => (
            <option key={t} value={t}>{LINE_TYPE_LABELS[t]}</option>
          ))}
        </SelectField>

        <TextAreaField
          label={isText ? 'Testo del commento' : 'Descrizione'}
          rows={3}
          maxLength={LIMITS.description}
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />

        {!isText && (
          <>
            <div className="two-cols">
              <DecimalField
                label="Quantità"
                value={line.quantityMilli}
                decimals={DECIMALS.quantity}
                max={LIMITS.quantityMilli}
                onChange={(quantityMilli) => onChange({ quantityMilli })}
                onValidityChange={reporter(key('quantity'))}
              />
              <SelectField label="Unità" value={line.unit} onChange={(e) => onChange({ unit: e.target.value as QuoteLine['unit'] })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </SelectField>
            </div>

            <div className="two-cols">
              <DecimalField
                label="Prezzo unitario"
                suffix="€"
                value={line.unitPriceTenThousandths}
                decimals={DECIMALS.unitPrice}
                minDecimals={2}
                max={LIMITS.unitPriceTenThousandths}
                placeholder="da inserire"
                onChange={(unitPriceTenThousandths) => onChange({ unitPriceTenThousandths })}
                onValidityChange={reporter(key('price'))}
              />
              <DecimalField
                label="Sconto"
                suffix="%"
                value={line.discountBp}
                decimals={DECIMALS.percent}
                max={LIMITS.discountBp}
                emptyValue={0}
                placeholder="0"
                onChange={(discountBp) => onChange({ discountBp: discountBp ?? 0 })}
                onValidityChange={reporter(key('discount'))}
              />
            </div>

            <p className="line-panel-amount">
              Importo riga:{' '}
              {amount === null ? (
                <span className="missing">
                  {line.unitPriceTenThousandths === null ? 'prezzo da inserire' : 'quantità da inserire'}
                </span>
              ) : (
                <strong className="num">{formatEuro(amount)}</strong>
              )}
            </p>

            {regime === 'ordinary' && (
              <SelectField label="IVA" value={line.vatCode} onChange={(e) => onChange({ vatCode: e.target.value as QuoteLine['vatCode'] })}>
                {allowedVatCodes(regime).map((code) => (
                  <option key={code} value={code}>{VAT[code].label}</option>
                ))}
              </SelectField>
            )}

            <Field
              label="Codice articolo (facoltativo)"
              value={line.itemCode}
              maxLength={LIMITS.itemCode}
              autoComplete="off"
              onChange={(e) => onChange({ itemCode: e.target.value })}
            />

            <label className="checkbox">
              <input type="checkbox" checked={line.optional} onChange={(e) => onChange({ optional: e.target.checked })} />
              <span>
                Voce opzionale
                <span className="muted small"> — compare nel preventivo ma è esclusa dai totali</span>
              </span>
            </label>
          </>
        )}

        <div className="line-panel-actions">
          <Button variant="icon" aria-label="Sposta la riga su" disabled={isFirst} onClick={() => onMove(-1)}>
            <UpIcon />
          </Button>
          <Button variant="icon" aria-label="Sposta la riga giù" disabled={isLast} onClick={() => onMove(1)}>
            <DownIcon />
          </Button>
          <Button variant="pill" onClick={onDuplicate}>Duplica</Button>
          <Button variant="text" tone="warning" onClick={onDelete}>Elimina riga</Button>
        </div>
      </div>
    </dialog>
  );
}
