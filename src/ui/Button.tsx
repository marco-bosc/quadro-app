import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

/** `confirm` (blu) è riservato all'unica azione irreversibile: «Conferma ed emetti» (DESIGN §1). */
type Variant = 'primary' | 'confirm' | 'secondary' | 'pill' | 'text' | 'icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Bordo in inchiostro per l'alternativa principale (secondary, pill). */
  strong?: boolean;
  full?: boolean;
  tone?: 'warning';
}

export function Button({ variant = 'secondary', strong, full, tone, className, type = 'button', ...rest }: Props) {
  const classes = ['btn', `btn-${variant}`, strong && 'strong', full && 'full', tone, className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
