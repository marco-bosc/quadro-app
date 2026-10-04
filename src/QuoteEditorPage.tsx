import { FirebaseError } from 'firebase/app';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { calculateQuote, type IncompleteLine } from '../shared/calc';
import { formatEuro } from '../shared/format';
import {
  createQuoteContent,
  LIMITS,
  PDF_DETAILS,
  validateQuoteContent,
  type CompanySettings,
  type LineType,
  type PdfDetail,
  type QuoteContent,
  type QuoteLine,
} from '../shared/quote';
import { allowedVatCodes, VAT, type VatCode } from '../shared/vat';
import * as ops from './editor/contentOps';
import { LinePanel } from './editor/LinePanel';
import { SectionBlock } from './editor/SectionBlock';
import { missingAmountsLabel } from './editor/labels';
import { TotalsSummary } from './editor/TotalsSummary';
import { describeError } from './errors';
import { db } from './firebase';
import { formatSavedAt } from './format';
import { localDraftKey, readLocalDraft, removeLocalDraft, sameContent, writeLocalDraft, type LocalDraft } from './localDraft';
import { createQuote, getQuote, saveQuote, SaveError } from './quotes';
import { Button } from './ui/Button';
import { Field, SelectField, TextAreaField } from './ui/Field';
import { BackIcon, PlusIcon } from './ui/icons';
import { SaveBar } from './ui/SaveBar';
import { useInvalidTracker } from './ui/useInvalidTracker';
import './editor/editor.css';

interface Props {
  companyId: string;
  uid: string;
  settings: CompanySettings;
  /** null = nuova bozza non ancora salvata */
  quoteId: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onCreated: (id: string) => void;
}

type SaveProblem = { kind: 'conflict' | 'network' | 'permission' | 'error'; text: string };

const PDF_DETAIL_LABELS: Record<PdfDetail, string> = {
  lines: 'Prezzi per ogni riga',
  sections: 'Solo i totali delle sezioni',
  total: 'Solo il totale',
};

function classifyError(error: unknown): SaveProblem {
  if (error instanceof SaveError && error.reason === 'conflict') {
    return {
      kind: 'conflict',
      text: 'Questo preventivo è stato modificato altrove. Le tue modifiche sono ancora qui: copiale prima di ricaricare.',
    };
  }
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') return { kind: 'permission', text: 'Non hai i permessi per salvare questo documento.' };
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      return { kind: 'network', text: 'Non salvato: connessione assente. Riprova.' };
    }
  }
  return { kind: 'error', text: `Non salvato: ${describeError(error)}` };
}

export function QuoteEditorPage({ companyId, uid, settings, quoteId: initialId, onDirtyChange, onCreated }: Props) {
  const regime = settings.taxRegime;
  const [quoteId, setQuoteId] = useState(initialId);
  const [loading, setLoading] = useState(initialId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Ultima versione confermata dal server, e ciò che l'utente sta scrivendo.
  const [saved, setSaved] = useState<QuoteContent>(() => createQuoteContent(settings));
  const [draft, setDraft] = useState<QuoteContent>(saved);
  // Copia locale trovata all'apertura: finché l'utente non decide, l'editor resta bloccato.
  const [recovery, setRecovery] = useState<LocalDraft | null>(() => {
    if (initialId !== null) return null;
    const copy = readLocalDraft(localDraftKey(companyId, null));
    return copy && !sameContent(copy.content, saved) ? copy : null;
  });
  const [regimeNotice, setRegimeNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [openLine, setOpenLine] = useState<{ sectionId: string; lineId: string } | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { reporter, hasInvalid } = useInvalidTracker();

  const dirty = !sameContent(draft, saved);
  const totals = useMemo(() => calculateQuote(draft, regime), [draft, regime]);
  const issues = useMemo(() => validateQuoteContent(draft, regime), [draft, regime]);
  const blocked = issues.length > 0 || totals.errors.length > 0 || hasInvalid();
  const totalLines = draft.sections.reduce((n, s) => n + s.lines.length, 0);

  const load = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const quote = await getQuote(db, companyId, id);
      if (!quote) {
        setLoadError('Bozza non trovata.');
        return;
      }
      const normalized = ops.normalizeVatCodes(quote.content, regime, settings.defaultVatCode);
      setSaved(quote.content);
      setDraft(normalized.content);
      setRegimeNotice(normalized.changed);
      setVersion(quote.version);
      setSavedAt(quote.updatedAt);
      setProblem(null);
      setOpenLine(null);
      const key = localDraftKey(companyId, id);
      const copy = readLocalDraft(key);
      if (copy && !sameContent(copy.content, quote.content) && !sameContent(copy.content, normalized.content)) {
        setRecovery(copy);
      } else {
        setRecovery(null);
        removeLocalDraft(key);
      }
    } catch (e) {
      setLoadError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento iniziale dei dati
    if (initialId) void load(initialId);
    // Si carica una sola volta all'apertura: ricaricare cancellerebbe le modifiche a schermo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = 'Preventivo · Quadro';
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Avviso del browser se si chiude o ricarica la pagina con modifiche non salvate.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Copia locale delle modifiche non salvate; si cancella quando tutto è salvato.
  useEffect(() => {
    if (loading || recovery || loadError) return;
    const key = localDraftKey(companyId, quoteId);
    if (dirty) writeLocalDraft(key, { baseVersion: version, savedAt: new Date().toISOString(), content: draft });
    else removeLocalDraft(key);
  }, [draft, dirty, loading, recovery, loadError, quoteId, version, companyId]);

  // ---------- Modifiche ----------

  const update = (fn: (c: QuoteContent) => QuoteContent) => setDraft((c) => fn(c));

  const expand = (sectionId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });

  const addSection = () => {
    const { content, sectionId } = ops.addSection(draft);
    setDraft(content);
    expand(sectionId);
    requestAnimationFrame(() => document.getElementById(`section-${sectionId}`)?.querySelector('input')?.focus());
  };

  const addLine = (sectionId: string, type: LineType) => {
    const { content, lineId } = ops.addLine(draft, sectionId, type, settings);
    setDraft(content);
    setOpenLine({ sectionId, lineId });
  };

  const deleteSection = (sectionId: string) => {
    const n = draft.sections.find((s) => s.id === sectionId)?.lines.length ?? 0;
    const message =
      n === 0 ? 'Eliminare questa sezione?' : `Eliminare la sezione e ${n === 1 ? 'la sua riga' : `le sue ${n} righe`}?`;
    if (window.confirm(message)) update((c) => ops.deleteSection(c, sectionId));
  };

  const openIncomplete = (line: IncompleteLine) => {
    expand(line.sectionId);
    setOpenLine({ sectionId: line.sectionId, lineId: line.lineId });
  };

  const closePanel = () => {
    const id = openLine?.lineId;
    setOpenLine(null);
    if (id) requestAnimationFrame(() => document.getElementById(`line-${id}`)?.focus());
  };

  // ---------- Recupero, salvataggio, ricarica ----------

  const acceptRecovery = () => {
    if (!recovery) return;
    setDraft(ops.normalizeVatCodes(recovery.content, regime, settings.defaultVatCode).content);
    setRecovery(null);
  };

  const discardRecovery = () => {
    removeLocalDraft(localDraftKey(companyId, quoteId));
    setRecovery(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || blocked || recovery || !dirty) return;
    const submitted = draft;
    setSaving(true);
    setProblem(null);
    try {
      if (quoteId === null) {
        const created = await createQuote(db, companyId, uid, submitted, regime);
        removeLocalDraft(localDraftKey(companyId, null));
        setQuoteId(created.id);
        setVersion(created.version);
        onCreated(created.id);
      } else {
        setVersion(await saveQuote(db, companyId, quoteId, version ?? 0, submitted, regime));
      }
      // Solo dopo la conferma del server il contenuto inviato diventa "salvato".
      setSaved(submitted);
      setSavedAt(new Date());
      setRegimeNotice(false);
    } catch (e) {
      setProblem(classifyError(e));
    } finally {
      setSaving(false);
    }
  };

  const reloadLatest = () => {
    if (!quoteId) return;
    if (!window.confirm('Caricando la versione più recente perderai le modifiche a schermo. Continuare?')) return;
    removeLocalDraft(localDraftKey(companyId, quoteId));
    void load(quoteId);
  };

  // ---------- Vista ----------

  if (loading) return <main className="page"><p className="muted">Caricamento…</p></main>;

  if (loadError) {
    return (
      <main className="page">
        <p className="notice" role="alert">{loadError}</p>
        <a href="#/">Torna alle bozze</a>
      </main>
    );
  }

  const openSection = openLine ? draft.sections.find((s) => s.id === openLine.sectionId) : undefined;
  const openLineIndex = openSection ? openSection.lines.findIndex((l) => l.id === openLine?.lineId) : -1;
  const openLineData: QuoteLine | undefined = openSection?.lines[openLineIndex];
  const openSectionIndex = openSection ? draft.sections.indexOf(openSection) : -1;

  let status: string;
  let tone: 'normal' | 'warning' = 'normal';
  if (saving) status = 'Salvataggio…';
  else if (problem && problem.kind !== 'conflict' && dirty) [status, tone] = [problem.text, 'warning'];
  else if (dirty) [status, tone] = [blocked ? 'Non salvato · correggi i campi evidenziati' : 'Non salvato', 'warning'];
  else if (quoteId === null) status = 'Nuova bozza, non ancora salvata';
  else status = savedAt ? formatSavedAt(savedAt) : 'Salvato';

  return (
    <form
      onSubmit={save}
      noValidate
      // Il salvataggio è solo esplicito: Invio in un campo non invia il modulo.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <header className="detail-header">
        <a href="#/" className="back-link"><BackIcon /> Bozze</a>
        <span className="muted small">Preventivo · bozza</span>
      </header>

      <main className="page with-bottom-bar editor">
        {recovery && (
          <div className="notice info" role="alert">
            <p>
              <strong>Su questo dispositivo ci sono modifiche non salvate</strong>
              {recovery.savedAt &&
                ` del ${new Date(recovery.savedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}`}
              .
            </p>
            {recovery.baseVersion !== null && version !== null && recovery.baseVersion < version && (
              <p className="warning">
                Partivano da una versione precedente: recuperandole e salvando sostituirai le modifiche salvate dopo.
              </p>
            )}
            <div className="row-wrap">
              <Button variant="secondary" strong onClick={acceptRecovery}>Recupera le modifiche</Button>
              <Button variant="text" tone="warning" onClick={discardRecovery}>Scarta</Button>
            </div>
          </div>
        )}

        <fieldset disabled={recovery !== null} className="editor-fields">
          {regimeNotice && (
            <p className="notice" role="status">
              Il regime fiscale dell’azienda è cambiato: le aliquote IVA delle righe sono state adattate. Salva per confermare.
            </p>
          )}

          <Field
            label="Oggetto del preventivo"
            className="title-field"
            value={draft.title}
            maxLength={LIMITS.title}
            placeholder="Es. Rifacimento impianto cucina"
            onChange={(e) => update((c) => ({ ...c, title: e.target.value }))}
          />

          <section className="customer stack" aria-labelledby="cliente-title">
            <p id="cliente-title" className="group-label">Cliente</p>
            <div className="two-cols">
              <Field
                label="Nome"
                value={draft.customer.name}
                maxLength={LIMITS.customerName}
                autoComplete="off"
                onChange={(e) => update((c) => ({ ...c, customer: { ...c.customer, name: e.target.value } }))}
              />
              <Field
                label="Contatto"
                value={draft.customer.contact}
                maxLength={LIMITS.customerContact}
                autoComplete="off"
                placeholder="Telefono o email"
                onChange={(e) => update((c) => ({ ...c, customer: { ...c.customer, contact: e.target.value } }))}
              />
            </div>
            <Field
              label="Luogo dell’intervento"
              value={draft.customer.siteAddress}
              maxLength={LIMITS.customerSiteAddress}
              autoComplete="off"
              onChange={(e) => update((c) => ({ ...c, customer: { ...c.customer, siteAddress: e.target.value } }))}
            />
          </section>

          <section className="stack" aria-labelledby="lavorazioni-title">
            <h2 id="lavorazioni-title">Lavorazioni</h2>
            {draft.sections.length === 0 && (
              <p className="muted">Aggiungi una sezione (es. «Quadro elettrico», «Cucina») e poi le righe.</p>
            )}
            {draft.sections.map((section, index) => (
              <SectionBlock
                key={section.id}
                section={section}
                index={index}
                count={draft.sections.length}
                totals={totals}
                defaultVatCode={draft.defaultVatCode}
                showVat={regime === 'ordinary'}
                collapsed={collapsed.has(section.id)}
                canAddLine={totalLines < LIMITS.lines}
                onToggle={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(section.id)) next.delete(section.id);
                    else next.add(section.id);
                    return next;
                  })
                }
                onRename={(title) => update((c) => ops.renameSection(c, section.id, title))}
                onMove={(delta) => update((c) => ops.moveSection(c, section.id, delta))}
                onDelete={() => deleteSection(section.id)}
                onAddLine={(type) => addLine(section.id, type)}
                onOpenLine={(lineId) => setOpenLine({ sectionId: section.id, lineId })}
              />
            ))}
            <div>
              <Button variant="pill" strong disabled={draft.sections.length >= LIMITS.sections} onClick={addSection}>
                <PlusIcon /> Sezione
              </Button>
            </div>
          </section>

          <TotalsSummary
            content={draft}
            totals={totals}
            onFinalDiscount={(finalDiscountCents) => update((c) => ({ ...c, finalDiscountCents }))}
            onOpenLine={openIncomplete}
            reporter={reporter}
          />

          <section className="stack" aria-labelledby="condizioni-title">
            <h2 id="condizioni-title">Condizioni</h2>
            {regime === 'ordinary' ? (
              <SelectField
                label="Aliquota IVA predefinita"
                hint="Vale per le nuove righe; ogni riga può avere la sua."
                value={draft.defaultVatCode}
                onChange={(e) => update((c) => ({ ...c, defaultVatCode: e.target.value as VatCode }))}
              >
                {allowedVatCodes(regime).map((code) => (
                  <option key={code} value={code}>{VAT[code].label}</option>
                ))}
              </SelectField>
            ) : (
              <p className="muted small">Regime forfettario: le righe sono senza IVA.</p>
            )}
            <TextAreaField
              label="Validità dell’offerta"
              rows={2}
              maxLength={LIMITS.validityText}
              value={draft.validityText}
              onChange={(e) => update((c) => ({ ...c, validityText: e.target.value }))}
            />
            <TextAreaField
              label="Condizioni di pagamento"
              rows={2}
              maxLength={LIMITS.paymentTermsText}
              value={draft.paymentTermsText}
              onChange={(e) => update((c) => ({ ...c, paymentTermsText: e.target.value }))}
            />
            <SelectField
              label="Dettaglio dei prezzi nel PDF"
              hint="Il PDF sarà disponibile con l’emissione del preventivo."
              value={draft.pdfDetail}
              onChange={(e) => update((c) => ({ ...c, pdfDetail: e.target.value as PdfDetail }))}
            >
              {PDF_DETAILS.map((d) => (
                <option key={d} value={d}>{PDF_DETAIL_LABELS[d]}</option>
              ))}
            </SelectField>
            <TextAreaField
              label="Note"
              rows={4}
              maxLength={LIMITS.notes}
              value={draft.notes}
              onChange={(e) => update((c) => ({ ...c, notes: e.target.value }))}
            />
          </section>

          {issues.length > 0 && (
            <ul className="notice" role="alert">
              {issues.slice(0, 5).map((issue) => (
                <li key={issue.path}>{issue.message}</li>
              ))}
            </ul>
          )}
        </fieldset>

        {problem?.kind === 'conflict' && (
          <div className="notice" role="alert">
            <p>{problem.text}</p>
            <Button variant="secondary" strong onClick={reloadLatest}>Carica la versione più recente</Button>
          </div>
        )}
      </main>

      <SaveBar
        status={status}
        tone={tone}
        buttonLabel={saving ? 'Salvataggio…' : 'Salva bozza'}
        disabled={saving || !dirty || blocked || recovery !== null}
        top={
          <div className="savebar-total">
            <span>Totale</span>
            <span className="num">
              {totals.partial ? (
                <span className="missing">{missingAmountsLabel(totals)}</span>
              ) : (
                <strong>{formatEuro(totals.totalCents)}</strong>
              )}
            </span>
            <Button variant="text" onClick={() => document.getElementById('riepilogo')?.scrollIntoView({ behavior: 'smooth' })}>
              Riepilogo
            </Button>
          </div>
        }
      />

      {openLineData && openSection && (
        <LinePanel
          key={openLineData.id}
          line={openLineData}
          position={`${openSection.title.trim() || `Sezione ${openSectionIndex + 1}`} · riga ${openLineIndex + 1}`}
          regime={regime}
          isFirst={openLineIndex === 0}
          isLast={openLineIndex === openSection.lines.length - 1}
          onChange={(patch) => update((c) => ops.updateLine(c, openSection.id, openLineData.id, patch))}
          onChangeType={(type) => update((c) => ops.changeLineType(c, openSection.id, openLineData.id, type, settings))}
          onMove={(delta) => update((c) => ops.moveLine(c, openSection.id, openLineData.id, delta))}
          onDuplicate={() => {
            const { content, lineId } = ops.duplicateLine(draft, openSection.id, openLineData.id);
            setDraft(content);
            setOpenLine({ sectionId: openSection.id, lineId });
          }}
          onDelete={() => {
            if (!window.confirm('Eliminare questa riga?')) return;
            update((c) => ops.deleteLine(c, openSection.id, openLineData.id));
            setOpenLine(null);
          }}
          onClose={closePanel}
          reporter={reporter}
          hasInvalid={hasInvalid(`line:${openLineData.id}:`)}
        />
      )}
    </form>
  );
}
