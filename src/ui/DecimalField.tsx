import { useEffect, useState, type ReactNode } from 'react';
import { formatDecimalInput, parseDecimal } from '../../shared/money';
import { Field } from './Field';

interface Props {
  label: ReactNode;
  /** Valore intero (centesimi, decimillesimi, millesimi…) oppure null se vuoto. */
  value: number | null;
  decimals: number;
  /** Decimali minimi mostrati (es. 2 per i prezzi: "12,00"). */
  minDecimals?: number;
  max: number;
  onChange: (value: number | null) => void;
  /** Segnala al genitore se il testo scritto non è valido, così il salvataggio resta bloccato. */
  onValidityChange?: (invalid: boolean) => void;
  /** Se presente, un campo vuoto vale questo numero (es. sconto vuoto = 0). Per i prezzi non si usa mai. */
  emptyValue?: number;
  hint?: ReactNode;
  placeholder?: string;
  suffix?: string;
  className?: string;
}

/**
 * Campo numerico con virgola italiana. Il testo dell'utente resta com'è:
 * - testo valido → onChange con l'intero corrispondente (vuoto → null);
 * - testo non valido → messaggio di errore, il valore non cambia e il genitore viene avvisato.
 */
export function DecimalField({
  label,
  value,
  decimals,
  minDecimals = 0,
  max,
  onChange,
  onValidityChange,
  emptyValue,
  hint,
  placeholder,
  suffix,
  className,
}: Props) {
  const format = (v: number | null) => (v === null || v === emptyValue ? '' : formatDecimalInput(v, decimals, minDecimals));
  const [text, setText] = useState(() => format(value));
  const [error, setError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);

  // Se il valore cambia dall'esterno (es. cambio di tipo della riga), il testo si aggiorna.
  if (value !== lastValue) {
    setLastValue(value);
    const parsed = parseDecimal(text, decimals, max);
    const current = parsed.ok ? (parsed.value ?? emptyValue ?? null) : undefined;
    if (current !== value) {
      setText(format(value));
      setError(null);
    }
  }

  useEffect(() => {
    onValidityChange?.(error !== null);
  }, [error, onValidityChange]);

  // Un campo che sparisce con un errore non deve lasciare il salvataggio bloccato per sempre.
  useEffect(() => () => onValidityChange?.(false), [onValidityChange]);

  const handle = (next: string) => {
    setText(next);
    const parsed = parseDecimal(next, decimals, max);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const nextValue = parsed.value ?? emptyValue ?? null;
    setLastValue(nextValue);
    if (nextValue !== value) onChange(nextValue);
  };

  return (
    <Field
      label={suffix ? <>{label} <span className="muted">({suffix})</span></> : label}
      value={text}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      error={error}
      hint={hint}
      className={className}
      onChange={(e) => handle(e.target.value)}
    />
  );
}
