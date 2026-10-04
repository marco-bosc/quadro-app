import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'pill' | 'text' | 'icon';

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
