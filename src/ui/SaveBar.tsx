import type { ReactNode } from 'react';
import { Button } from './Button';
import './SaveBar.css';

interface Props {
  status: ReactNode;
  tone?: 'normal' | 'warning';
  buttonLabel: string;
  disabled?: boolean;
  /** Contenuto sopra la riga di stato (es. totale del preventivo). */
  top?: ReactNode;
  /** Nelle schermate con la navigazione principale, la barra sta sopra di essa. */
  aboveNav?: boolean;
}

/** Barra azioni fissa in basso: stato del salvataggio a sinistra, pulsante primario a destra (DESIGN §5.3). */
export function SaveBar({ status, tone = 'normal', buttonLabel, disabled, top, aboveNav }: Props) {
  return (
    <div className={`savebar${aboveNav ? ' above-nav' : ''}`}>
      <div className="savebar-inner">
        {top}
        <div className="savebar-row">
          <p className={`savebar-status${tone === 'warning' ? ' warning' : ''}`} role="status" aria-live="polite">
            {status}
          </p>
          <Button type="submit" variant="primary" disabled={disabled}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
