// Modello della bozza di preventivo e delle impostazioni dell'azienda: tipi, limiti, validazione.
// I limiti dei campi di primo livello devono restare allineati a firestore.rules.

import { EMPTY_PROFILE, validateProfile, type CompanyProfile } from './company';
import { DECIMALS, formatDecimalInput } from './money';
import {
  allowedVatCodes,
  effectiveVatCode,
  isTaxRegime,
  isVatCode,
  isVatCodeAllowed,
  type TaxRegime,
  type VatCode,
} from './vat';

export const LIMITS = {
  title: 200,
  notes: 5000,
  customerName: 200,
  customerSiteAddress: 300,
  customerContact: 200,
  validityText: 500,
  paymentTermsText: 1000,
  sectionTitle: 200,
  description: 1000,
  itemCode: 50,
  id: 64,
  sections: 30,
  lines: 300,
  /**
   * 99.999,999. Con il prezzo massimo, una riga vale al più 10^13 centesimi e 300 righe 3·10^15,
   * sotto Number.MAX_SAFE_INTEGER (≈ 9·10^15): i totali restano interi sicuri per costruzione.
   */
  quantityMilli: 99_999_999,
  /** 999.999,9999 € */
  unitPriceTenThousandths: 9_999_999_999,
  /** 100% */
  discountBp: 10_000,
  /** 9.999.999.999,99 € — il limite vero è l'imponibile, verificato nel calcolo */
  finalDiscountCents: 999_999_999_999,
} as const;

/** Compatibilità con I01. */
export const QUOTE_TITLE_MAX = LIMITS.title;
export const QUOTE_NOTES_MAX = LIMITS.notes;

export type QuoteStatus = 'draft';
export type LineType = 'material' | 'labor' | 'lump_sum' | 'text';
export const LINE_TYPES: readonly LineType[] = ['material', 'labor', 'lump_sum', 'text'];
export const UNITS = ['pz', 'm', 'h', 'corpo'] as const;
export type Unit = (typeof UNITS)[number];
export type PdfDetail = 'lines' | 'sections' | 'total';
export const PDF_DETAILS: readonly PdfDetail[] = ['lines', 'sections', 'total'];

export interface QuoteLine {
  id: string;
  type: LineType;
  description: string;
  itemCode: string;
  unit: Unit;
  /** null = quantità non inserita (riga incompleta), mai 0 per default */
  quantityMilli: number | null;
  /** null = prezzo da inserire (riga incompleta), mai 0 per default */
  unitPriceTenThousandths: number | null;
  discountBp: number;
  vatCode: VatCode;
  optional: boolean;
}

export interface QuoteSection {
  id: string;
  title: string;
  lines: QuoteLine[];
}

export interface Customer {
  name: string;
  siteAddress: string;
  contact: string;
}

/** Contenuto modificabile dall'utente (senza status, versione, autore e date). */
export interface QuoteContent {
  title: string;
  notes: string;
  customer: Customer;
  validityText: string;
  paymentTermsText: string;
  defaultVatCode: VatCode;
  finalDiscountCents: number | null;
  pdfDetail: PdfDetail;
  sections: QuoteSection[];
}

/** Impostazioni dell'azienda: dati di intestazione (CompanyProfile) e valori predefiniti dei preventivi. */
export interface CompanySettings extends CompanyProfile {
  taxRegime: TaxRegime;
  defaultVatCode: VatCode;
  /** Tariffa oraria in decimillesimi di euro, oppure null se non impostata. */
  hourlyRate: number | null;
  defaultValidityText: string;
  defaultPaymentTermsText: string;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  ...EMPTY_PROFILE,
  taxRegime: 'ordinary',
  defaultVatCode: 'VAT22',
  hourlyRate: null,
  defaultValidityText: '',
  defaultPaymentTermsText: '',
};

// ---------- Creazione ----------

export function newId(): string {
  return crypto.randomUUID();
}

export function createQuoteContent(settings: CompanySettings): QuoteContent {
  return {
    title: '',
    notes: '',
    customer: { name: '', siteAddress: '', contact: '' },
    validityText: settings.defaultValidityText,
    paymentTermsText: settings.defaultPaymentTermsText,
    defaultVatCode: settings.taxRegime === 'flat_rate' ? 'FORF' : settings.defaultVatCode,
    finalDiscountCents: null,
    pdfDetail: 'lines',
    sections: [],
  };
}

export function createSection(title = ''): QuoteSection {
  return { id: newId(), title, lines: [] };
}

/**
 * Nuova riga del tipo indicato. Quantità e prezzo restano vuoti se non c'è un valore sensato:
 * - manodopera: unità h e tariffa oraria copiata dalle impostazioni (se presente);
 * - a corpo: quantità 1 e unità "corpo";
 * - testo: nessun importo.
 */
export function createLine(type: LineType, vatCode: VatCode, settings: CompanySettings): QuoteLine {
  const base: QuoteLine = {
    id: newId(),
    type,
    description: '',
    itemCode: '',
    unit: 'pz',
    quantityMilli: null,
    unitPriceTenThousandths: null,
    discountBp: 0,
    vatCode,
    optional: false,
  };
  switch (type) {
    case 'labor':
      return { ...base, unit: 'h', unitPriceTenThousandths: settings.hourlyRate };
    case 'lump_sum':
      return { ...base, unit: 'corpo', quantityMilli: 1000 };
    default:
      return base;
  }
}

// ---------- Lettura tollerante (dati da Firestore o da copie locali) ----------

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function intOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function parseLine(value: unknown, fallbackVat: VatCode): QuoteLine | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const type = LINE_TYPES.includes(v.type as LineType) ? (v.type as LineType) : 'material';
  return {
    id: str(v.id) || newId(),
    type,
    description: str(v.description),
    itemCode: str(v.itemCode),
    unit: UNITS.includes(v.unit as Unit) ? (v.unit as Unit) : 'pz',
    quantityMilli: intOrNull(v.quantityMilli),
    unitPriceTenThousandths: intOrNull(v.unitPriceTenThousandths),
    discountBp: intOrNull(v.discountBp) ?? 0,
    vatCode: isVatCode(v.vatCode) ? v.vatCode : fallbackVat,
    optional: v.optional === true,
  };
}

/**
 * Ricostruisce il contenuto di una bozza da dati non verificati.
 * Le bozze di I01 (solo titolo e note) diventano bozze valide con i campi nuovi vuoti.
 * I valori numerici non validi diventano null (da inserire), mai 0.
 */
export function parseQuoteContent(data: Record<string, unknown>): QuoteContent {
  const defaultVatCode = isVatCode(data.defaultVatCode) ? data.defaultVatCode : 'VAT22';
  const customer = (typeof data.customer === 'object' && data.customer !== null ? data.customer : {}) as Record<
    string,
    unknown
  >;
  const sections = Array.isArray(data.sections) ? data.sections : [];
  return {
    title: str(data.title),
    notes: str(data.notes),
    customer: { name: str(customer.name), siteAddress: str(customer.siteAddress), contact: str(customer.contact) },
    validityText: str(data.validityText),
    paymentTermsText: str(data.paymentTermsText),
    defaultVatCode,
    finalDiscountCents: intOrNull(data.finalDiscountCents),
    pdfDetail: PDF_DETAILS.includes(data.pdfDetail as PdfDetail) ? (data.pdfDetail as PdfDetail) : 'lines',
    sections: sections
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        id: str(s.id) || newId(),
        title: str(s.title),
        lines: (Array.isArray(s.lines) ? s.lines : [])
          .map((l) => parseLine(l, defaultVatCode))
          .filter((l): l is QuoteLine => l !== null),
      })),
  };
}

export function parseSettings(data: unknown): CompanySettings {
  if (typeof data !== 'object' || data === null) return { ...DEFAULT_SETTINGS };
  const v = data as Record<string, unknown>;
  const taxRegime = isTaxRegime(v.taxRegime) ? v.taxRegime : DEFAULT_SETTINGS.taxRegime;
  const vat = isVatCode(v.defaultVatCode) ? v.defaultVatCode : DEFAULT_SETTINGS.defaultVatCode;
  return {
    legalName: str(v.legalName),
    vatNumber: str(v.vatNumber),
    taxCode: str(v.taxCode),
    address: str(v.address),
    phone: str(v.phone),
    email: str(v.email),
    website: str(v.website),
    signerName: str(v.signerName),
    taxRegime,
    defaultVatCode: isVatCodeAllowed(vat, taxRegime) ? vat : allowedVatCodes(taxRegime)[0],
    hourlyRate: intOrNull(v.hourlyRate),
    defaultValidityText: str(v.defaultValidityText),
    defaultPaymentTermsText: str(v.defaultPaymentTermsText),
  };
}

// ---------- Validazione ----------

/** Problema che impedisce il salvataggio. `path` indica il campo (es. "sections.2.lines.0.quantityMilli"). */
export interface ValidationIssue {
  path: string;
  message: string;
}

function checkLength(issues: ValidationIssue[], path: string, value: string, max: number, label: string) {
  if (value.length > max) issues.push({ path, message: `${label}: al massimo ${max} caratteri.` });
}

function checkInt(
  issues: ValidationIssue[],
  path: string,
  value: number | null,
  max: number,
  label: string,
  decimals: number,
) {
  if (value === null) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.push({ path, message: `${label}: valore non valido.` });
  } else if (value > max) {
    issues.push({ path, message: `${label}: il massimo è ${formatDecimalInput(max, decimals)}.` });
  }
}

/**
 * Controlli strutturali che bloccano il salvataggio: lunghezze, numeri, valori ammessi, codici IVA del regime.
 * Righe incomplete (prezzo, quantità o descrizione mancanti) NON bloccano il salvataggio:
 * le elenca il calcolo (calc.ts) e bloccheranno solo l'emissione.
 */
export function validateQuoteContent(content: QuoteContent, regime: TaxRegime): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkLength(issues, 'title', content.title, LIMITS.title, 'Oggetto');
  checkLength(issues, 'notes', content.notes, LIMITS.notes, 'Note');
  checkLength(issues, 'customer.name', content.customer.name, LIMITS.customerName, 'Cliente');
  checkLength(issues, 'customer.siteAddress', content.customer.siteAddress, LIMITS.customerSiteAddress, 'Luogo dell’intervento');
  checkLength(issues, 'customer.contact', content.customer.contact, LIMITS.customerContact, 'Contatto');
  checkLength(issues, 'validityText', content.validityText, LIMITS.validityText, 'Validità');
  checkLength(issues, 'paymentTermsText', content.paymentTermsText, LIMITS.paymentTermsText, 'Condizioni di pagamento');
  checkInt(issues, 'finalDiscountCents', content.finalDiscountCents, LIMITS.finalDiscountCents, 'Sconto finale', DECIMALS.cents);
  if (!isVatCode(content.defaultVatCode) || !isVatCodeAllowed(content.defaultVatCode, regime)) {
    issues.push({ path: 'defaultVatCode', message: 'Aliquota predefinita non ammessa per il regime fiscale.' });
  }
  if (!PDF_DETAILS.includes(content.pdfDetail)) {
    issues.push({ path: 'pdfDetail', message: 'Livello di dettaglio non valido.' });
  }

  if (content.sections.length > LIMITS.sections) {
    issues.push({ path: 'sections', message: `Al massimo ${LIMITS.sections} sezioni.` });
  }
  const totalLines = content.sections.reduce((n, s) => n + s.lines.length, 0);
  if (totalLines > LIMITS.lines) {
    issues.push({ path: 'sections', message: `Al massimo ${LIMITS.lines} righe in tutto il preventivo.` });
  }

  const ids = new Set<string>();
  const checkId = (path: string, id: string) => {
    if (!id || id.length > LIMITS.id || ids.has(id)) issues.push({ path, message: 'Identificativo non valido.' });
    ids.add(id);
  };

  content.sections.forEach((section, si) => {
    const sp = `sections.${si}`;
    checkId(`${sp}.id`, section.id);
    checkLength(issues, `${sp}.title`, section.title, LIMITS.sectionTitle, 'Titolo della sezione');
    section.lines.forEach((line, li) => {
      const lp = `${sp}.lines.${li}`;
      checkId(`${lp}.id`, line.id);
      if (!LINE_TYPES.includes(line.type)) issues.push({ path: `${lp}.type`, message: 'Tipo di riga non valido.' });
      if (!UNITS.includes(line.unit)) issues.push({ path: `${lp}.unit`, message: 'Unità di misura non valida.' });
      checkLength(issues, `${lp}.description`, line.description, LIMITS.description, 'Descrizione');
      checkLength(issues, `${lp}.itemCode`, line.itemCode, LIMITS.itemCode, 'Codice articolo');
      checkInt(issues, `${lp}.quantityMilli`, line.quantityMilli, LIMITS.quantityMilli, 'Quantità', DECIMALS.quantity);
      checkInt(
        issues,
        `${lp}.unitPriceTenThousandths`,
        line.unitPriceTenThousandths,
        LIMITS.unitPriceTenThousandths,
        'Prezzo unitario',
        DECIMALS.unitPrice,
      );
      checkInt(issues, `${lp}.discountBp`, line.discountBp, LIMITS.discountBp, 'Sconto', DECIMALS.percent);
      if (!isVatCode(line.vatCode) || !isVatCodeAllowed(line.vatCode, regime)) {
        issues.push({ path: `${lp}.vatCode`, message: 'Codice IVA non ammesso per il regime fiscale.' });
      }
      if (typeof line.optional !== 'boolean') issues.push({ path: `${lp}.optional`, message: 'Valore non valido.' });
    });
  });
  return issues;
}

export function validateSettings(settings: CompanySettings): ValidationIssue[] {
  const issues: ValidationIssue[] = validateProfile(settings).map((i) => ({ path: i.field, message: i.message }));
  if (!isTaxRegime(settings.taxRegime)) issues.push({ path: 'taxRegime', message: 'Regime fiscale non valido.' });
  if (!isVatCode(settings.defaultVatCode) || !isVatCodeAllowed(settings.defaultVatCode, settings.taxRegime)) {
    issues.push({ path: 'defaultVatCode', message: 'Aliquota predefinita non ammessa per il regime fiscale.' });
  }
  checkInt(issues, 'hourlyRate', settings.hourlyRate, LIMITS.unitPriceTenThousandths, 'Tariffa oraria', DECIMALS.unitPrice);
  checkLength(issues, 'defaultValidityText', settings.defaultValidityText, LIMITS.validityText, 'Validità');
  checkLength(
    issues,
    'defaultPaymentTermsText',
    settings.defaultPaymentTermsText,
    LIMITS.paymentTermsText,
    'Condizioni di pagamento',
  );
  return issues;
}

/**
 * Adatta i codici IVA al regime attuale dell'azienda (es. dopo un cambio di regime).
 * `changed` indica se qualcosa è cambiato: l'interfaccia lo segnala e la modifica vale solo dopo il salvataggio.
 * Lo usa anche il server all'emissione, così l'istantanea è coerente con il regime.
 */
export function normalizeVatCodes(
  content: QuoteContent,
  regime: TaxRegime,
  companyDefault: VatCode,
): { content: QuoteContent; changed: boolean } {
  const fallback = regime === 'flat_rate' ? 'FORF' : companyDefault === 'FORF' ? 'VAT22' : companyDefault;
  const defaultVatCode = effectiveVatCode(content.defaultVatCode, regime, fallback);
  let changed = defaultVatCode !== content.defaultVatCode;
  const sections = content.sections.map((s) => ({
    ...s,
    lines: s.lines.map((l) => {
      const vatCode = effectiveVatCode(l.vatCode, regime, defaultVatCode);
      if (vatCode === l.vatCode) return l;
      changed = true;
      return { ...l, vatCode };
    }),
  }));
  return { content: changed ? { ...content, defaultVatCode, sections } : content, changed };
}
