import { useEffect, useState } from 'react';
import { displayQuoteNumber } from '../shared/numbering';
import { describeError } from './errors';
import { db, functions } from './firebase';
import { getNextNumber, setNextNumber } from './settings';
import { Button } from './ui/Button';
import { Field } from './ui/Field';

/** Prossimo numero dell'anno: mostrato a tutti, modificabile dall'owner solo oltre l'ultimo emesso. */
export function NextNumberBlock({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const [current, setCurrent] = useState<{ year: number; next: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNextNumber(db, companyId)
      .then(setCurrent)
      .catch((e: unknown) => setLoadError(describeError(e)));
  }, [companyId]);

  const submit = async () => {
    if (!current) return;
    const value = Number(text.trim());
    if (!/^\d+$/.test(text.trim()) || !Number.isSafeInteger(value) || value < 1) {
      setError('Inserisci un numero intero positivo.');
      return;
    }
    const label = displayQuoteNumber({ year: current.year, sequence: value, revision: 0 });
    if (!window.confirm(`Il prossimo preventivo emesso avrà il numero ${label}. Confermi?`)) return;
    setBusy(true);
    setError(null);
    try {
      setCurrent(await setNextNumber(functions, companyId, value));
      setEditing(false);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p className="notice">{loadError}</p>;
  if (!current) return <p className="muted small">Caricamento della numerazione…</p>;

  return (
    <div className="stack">
      <p>
        Prossimo preventivo: <strong className="num">{displayQuoteNumber({ year: current.year, sequence: current.next, revision: 0 })}</strong>
      </p>
      {isOwner && !editing && (
        <div>
          <Button variant="pill" onClick={() => { setText(String(current.next)); setEditing(true); }}>Cambia il prossimo numero</Button>
        </div>
      )}
      {isOwner && editing && (
        <div className="stack">
          <Field
            label={`Prossimo numero per il ${current.year}`}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            error={error}
            hint="Serve se continui una numerazione iniziata con un altro sistema. Si può solo andare oltre l’ultimo numero emesso."
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row-wrap">
            <Button variant="secondary" strong disabled={busy} onClick={submit}>{busy ? 'Salvataggio…' : 'Imposta'}</Button>
            <Button variant="text" onClick={() => { setEditing(false); setError(null); }}>Annulla</Button>
          </div>
        </div>
      )}
    </div>
  );
}
