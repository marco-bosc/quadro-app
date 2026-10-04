import './Button.css';

/** Classi per un link (<a>) con l'aspetto di un pulsante. */
export function buttonClass(variant: 'primary' | 'secondary' | 'pill' | 'text', extra?: string): string {
  return ['btn', `btn-${variant}`, extra].filter(Boolean).join(' ');
}
