import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { LOGO_MAX_BYTES, LOGO_TYPES, logoPath } from '../shared/storagePaths';
import { describeError } from './errors';
import { storage } from './firebase';
import { Button } from './ui/Button';
import './LogoBlock.css';

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'storage/object-not-found';
}

/**
 * Logo sul preventivo: lo carica, sostituisce o rimuove solo l'owner (le regole lo verificano).
 * Il file si legge con l'SDK e le credenziali dell'utente, senza link pubblici.
 */
export function LogoBlock({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const path = logoPath(companyId);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const show = (blob: Blob | null) =>
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return blob ? URL.createObjectURL(blob) : null;
    });

  useEffect(() => {
    getBlob(ref(storage, path))
      .then(show)
      .catch((e: unknown) => {
        if (!isNotFound(e)) setError(describeError(e));
        show(null);
      })
      .finally(() => setLoading(false));
  }, [path]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
      setError('Il logo deve essere un’immagine PNG o JPEG.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError('Il logo può pesare al massimo 1 MB.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadBytes(ref(storage, path), file, { contentType: file.type });
      show(file);
    } catch (e) {
      setError(`Logo non caricato: ${describeError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Rimuovere il logo? I preventivi già emessi restano con il logo che avevano.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteObject(ref(storage, path));
      show(null);
    } catch (e) {
      setError(`Logo non rimosso: ${describeError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="field-label">Logo (facoltativo)</p>
      <div className="logo-row">
        {preview ? (
          <img className="logo-preview" src={preview} alt="Logo attuale" />
        ) : (
          <div className="logo-placeholder">{loading ? 'Caricamento…' : 'Nessun logo'}</div>
        )}
        {isOwner && (
          <div className="stack logo-actions">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="visually-hidden" onChange={upload} tabIndex={-1} />
            <Button variant="pill" strong disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? 'Attendi…' : preview ? 'Sostituisci logo' : 'Carica logo'}
            </Button>
            {preview && (
              <Button variant="text" tone="warning" disabled={busy} onClick={remove}>Rimuovi</Button>
            )}
          </div>
        )}
      </div>
      <p className="muted small">PNG o JPEG, al massimo 1 MB. Vale per i nuovi preventivi.</p>
      {error && <p className="notice" role="alert">{error}</p>}
    </div>
  );
}
