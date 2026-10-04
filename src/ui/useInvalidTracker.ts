import { useCallback, useRef, useState } from 'react';

/**
 * Tiene traccia dei campi con testo non valido (es. "12,3,4" in un prezzo).
 * Finché ce n'è almeno uno, il salvataggio resta bloccato: il valore a schermo non è nei dati.
 */
export function useInvalidTracker() {
  const [keys, setKeys] = useState<ReadonlySet<string>>(new Set());
  const reporters = useRef(new Map<string, (invalid: boolean) => void>());

  const reporter = useCallback((key: string) => {
    let fn = reporters.current.get(key);
    if (!fn) {
      fn = (invalid: boolean) =>
        setKeys((prev) => {
          if (prev.has(key) === invalid) return prev;
          const next = new Set(prev);
          if (invalid) next.add(key);
          else next.delete(key);
          return next;
        });
      reporters.current.set(key, fn);
    }
    return fn;
  }, []);

  const hasInvalid = useCallback((prefix = '') => [...keys].some((k) => k.startsWith(prefix)), [keys]);

  return { reporter, hasInvalid };
}
