import { FirebaseError } from 'firebase/app';
import { useEffect, useState, type FormEvent } from 'react';
import { DECIMALS } from '../shared/money';
import { LIMITS, validateSettings, type CompanySettings } from '../shared/quote';
import { allowedVatCodes, VAT, type TaxRegime, type VatCode } from '../shared/vat';
import { describeError } from './errors';
import { db } from './firebase';
import { formatSavedAt } from './format';
import { getCompany, saveSettings, type Company } from './settings';
import { SaveError } from './quotes';
import { Button } from './ui/Button';
import { DecimalField } from './ui/DecimalField';
import { SelectField, TextAreaField } from './ui/Field';
import { SaveBar } from './ui/SaveBar';
import { useInvalidTracker } from './ui/useInvalidTracker';

interface Props {
  companyId: string;
  email: string | null;
  isOwner: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (settings: CompanySettings) => void;
  onLogout: () => void;
}

const REGIME_LABELS: Record<TaxRegime, string> = {
  ordinary: 'Ordinario (con IVA)',
  flat_rate: 'Forfettario (senza IVA)',
};

function sameSettings(a: CompanySettings, b: CompanySettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Profilo: impostazioni dell'azienda usate dai nuovi preventivi, e uscita. */
export function SettingsPage({ companyId, email, isOwner, onDirtyChange, onSaved, onLogout }: Props) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { reporter, hasInvalid } = useInvalidTracker();

  useEffect(() => {
    document.title = 'Profilo · Quadro';
    getCompany(db, companyId)
      .then((c) => {
        setCompany(c);
        setDraft(c.settings);
      })
      .catch((e: unknown) => setLoadError(describeError(e)));
  }, [companyId]);

  const dirty = company !== null && draft !== null && !sameSettings(company.settings, draft);
  const issues = draft ? validateSettings(draft) : [];
  const blocked = issues.length > 0 || hasInvalid();

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!company || !draft || saving || blocked || !dirty) return;
    const submitted = draft;
    setSaving(true);
    setProblem(null);
    try {
      const version = await saveSettings(db, companyId, company.settingsVersion, submitted);
      setCompany({ ...company, settings: submitted, settingsVersion: version });
      setSavedAt(new Date());
      onSaved(submitted);
    } catch (e) {
      if (e instanceof SaveError) setProblem(e.message);
      else if (e instanceof FirebaseError && e.code === 'permission-denied') setProblem('Non hai i permessi per modificare le impostazioni.');
      else setProblem(`Non salvato: ${describeError(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const setRegime = (taxRegime: TaxRegime) => {
    if (!draft) return;
    const codes = allowedVatCodes(taxRegime);
    setDraft({ ...draft, taxRegime, defaultVatCode: codes.includes(draft.defaultVatCode) ? draft.defaultVatCode : codes[0] });
  };

  if (loadError) return <main className="page"><p className="notice" role="alert">{loadError}</p></main>;
  if (!company || !draft) return <main className="page"><p className="muted">Caricamento…</p></main>;

  let status: string;
  let tone: 'normal' | 'warning' = 'normal';
  if (saving) status = 'Salvataggio…';
  else if (problem && dirty) [status, tone] = [problem, 'warning'];
  else if (dirty) [status, tone] = [blocked ? 'Non salvato · correggi i campi evidenziati' : 'Non salvato', 'warning'];
  else status = savedAt ? formatSavedAt(savedAt) : 'Nessuna modifica';

  return (
    <form
      onSubmit={save}
      noValidate
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <main className="page with-bottom-bar">
        <h1>Profilo</h1>

        <fieldset disabled={!isOwner} className="stack plain-fieldset">
          <h2>Impostazioni dei preventivi</h2>
          {!isOwner && <p className="notice info">Solo il titolare dell’account può modificare queste impostazioni.</p>}

          <SelectField label="Regime fiscale" value={draft.taxRegime} onChange={(e) => setRegime(e.target.value as TaxRegime)}>
            {(Object.keys(REGIME_LABELS) as TaxRegime[]).map((r) => (
              <option key={r} value={r}>{REGIME_LABELS[r]}</option>
            ))}
          </SelectField>

          {draft.taxRegime === 'ordinary' ? (
            <SelectField
              label="Aliquota IVA predefinita"
              value={draft.defaultVatCode}
              onChange={(e) => setDraft({ ...draft, defaultVatCode: e.target.value as VatCode })}
            >
              {allowedVatCodes('ordinary').map((code) => (
                <option key={code} value={code}>{VAT[code].label}</option>
              ))}
            </SelectField>
          ) : (
            <p className="muted small">In regime forfettario i preventivi sono senza IVA.</p>
          )}

          <DecimalField
            label="Tariffa oraria della manodopera"
            suffix="€/h"
            value={draft.hourlyRate}
            decimals={DECIMALS.unitPrice}
            minDecimals={2}
            max={LIMITS.unitPriceTenThousandths}
            placeholder="non impostata"
            hint="Viene copiata sulle nuove righe di manodopera; puoi cambiarla riga per riga."
            onChange={(hourlyRate) => setDraft({ ...draft, hourlyRate })}
            onValidityChange={reporter('hourlyRate')}
          />

          <TextAreaField
            label="Validità dell’offerta predefinita"
            rows={2}
            maxLength={LIMITS.validityText}
            value={draft.defaultValidityText}
            placeholder="Es. Offerta valida 30 giorni"
            onChange={(e) => setDraft({ ...draft, defaultValidityText: e.target.value })}
          />
          <TextAreaField
            label="Condizioni di pagamento predefinite"
            rows={3}
            maxLength={LIMITS.paymentTermsText}
            value={draft.defaultPaymentTermsText}
            onChange={(e) => setDraft({ ...draft, defaultPaymentTermsText: e.target.value })}
          />
          <p className="muted small">
            Le modifiche valgono per i nuovi preventivi e le nuove righe. Le bozze esistenti non cambiano,
            tranne le aliquote se cambi il regime fiscale (te lo segnaliamo all’apertura).
          </p>
        </fieldset>

        <section className="stack">
          <h2>Account</h2>
          <p className="muted small">Email di accesso: {email ?? '—'}</p>
          <div>
            <Button variant="text" tone="warning" onClick={onLogout}>Esci</Button>
          </div>
        </section>
      </main>

      {isOwner && (
        <SaveBar aboveNav status={status} tone={tone} buttonLabel={saving ? 'Salvataggio…' : 'Salva'} disabled={saving || !dirty || blocked} />
      )}
    </form>
  );
}
