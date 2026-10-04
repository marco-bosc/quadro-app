import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import './Field.css';

interface Common {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
}

function useFieldIds(error?: string | null, hint?: ReactNode) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return { id, errorId, hintId, describedBy };
}

function Wrapper({ label, error, hint, className, ids, children }: Common & { ids: ReturnType<typeof useFieldIds>; children: ReactNode }) {
  return (
    <div className={['field', error && 'invalid', className].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={ids.id}>{label}</label>
      {children}
      {error && <p id={ids.errorId} className="field-error">{error}</p>}
      {hint && !error && <p id={ids.hintId} className="field-hint">{hint}</p>}
    </div>
  );
}

export function Field({ label, error, hint, className, ...input }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const ids = useFieldIds(error, hint);
  return (
    <Wrapper label={label} error={error} hint={hint} className={className} ids={ids}>
      <input
        id={ids.id}
        className={['field-input', input.inputMode === 'decimal' && 'num'].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        {...input}
      />
    </Wrapper>
  );
}

export function TextAreaField({ label, error, hint, className, ...input }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ids = useFieldIds(error, hint);
  return (
    <Wrapper label={label} error={error} hint={hint} className={className} ids={ids}>
      <textarea id={ids.id} className="field-input" aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} {...input} />
    </Wrapper>
  );
}

export function SelectField({ label, error, hint, className, children, ...input }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const ids = useFieldIds(error, hint);
  return (
    <Wrapper label={label} error={error} hint={hint} className={className} ids={ids}>
      <select id={ids.id} className="field-input" aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} {...input}>
        {children}
      </select>
    </Wrapper>
  );
}
