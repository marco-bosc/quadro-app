// Configurazione dei codici IVA: unico punto per aliquote, etichette e diciture.
// Le diciture non ancora confermate dal commercialista hanno il prefisso PLACEHOLDER_PREFIX,
// che l'interfaccia deve rendere ben visibile.

export const PLACEHOLDER_PREFIX = '[DA CONFERMARE]';

/** Ordine fisso: usato per raggruppare i totali e per risolvere le parità nella ripartizione dello sconto. */
export const VAT_CODES = ['VAT22', 'VAT10', 'RC_ATER', 'RC_A', 'FORF'] as const;
export type VatCode = (typeof VAT_CODES)[number];

export type TaxRegime = 'ordinary' | 'flat_rate';
export const TAX_REGIMES: readonly TaxRegime[] = ['ordinary', 'flat_rate'];

export interface VatCodeInfo {
  code: VatCode;
  /** Aliquota in centesimi di punto percentuale (22% = 2200). */
  rateBp: number;
  label: string;
  /** Dicitura da riportare sul documento, oppure null se non serve. */
  legend: string | null;
}

export const VAT: Record<VatCode, VatCodeInfo> = {
  VAT22: { code: 'VAT22', rateBp: 2200, label: 'IVA 22%', legend: null },
  VAT10: {
    code: 'VAT10',
    rateBp: 1000,
    label: 'IVA 10%',
    legend: `${PLACEHOLDER_PREFIX} IVA agevolata 10% per interventi di manutenzione o ristrutturazione su abitazioni.`,
  },
  RC_ATER: {
    code: 'RC_ATER',
    rateBp: 0,
    label: 'Inversione contabile (impianti)',
    legend: `${PLACEHOLDER_PREFIX} Operazione soggetta a inversione contabile ai sensi dell’art. 17, comma 6, lett. a-ter, DPR 633/72.`,
  },
  RC_A: {
    code: 'RC_A',
    rateBp: 0,
    label: 'Inversione contabile (subappalto edile)',
    legend: `${PLACEHOLDER_PREFIX} Operazione soggetta a inversione contabile ai sensi dell’art. 17, comma 6, lett. a, DPR 633/72.`,
  },
  FORF: {
    code: 'FORF',
    rateBp: 0,
    label: 'Senza IVA (regime forfettario)',
    legend: `${PLACEHOLDER_PREFIX} Operazione effettuata ai sensi dell’art. 1, commi 54-89, L. 190/2014 (regime forfettario), senza applicazione dell’IVA.`,
  },
};

export function isVatCode(value: unknown): value is VatCode {
  return typeof value === 'string' && (VAT_CODES as readonly string[]).includes(value);
}

export function isTaxRegime(value: unknown): value is TaxRegime {
  return value === 'ordinary' || value === 'flat_rate';
}

/** Codici selezionabili: l'azienda forfettaria ha solo FORF, quella ordinaria tutti gli altri. */
export function allowedVatCodes(regime: TaxRegime): VatCode[] {
  return regime === 'flat_rate' ? ['FORF'] : VAT_CODES.filter((c) => c !== 'FORF');
}

export function isVatCodeAllowed(code: VatCode, regime: TaxRegime): boolean {
  return allowedVatCodes(regime).includes(code);
}

/**
 * Codice effettivo di una riga secondo il regime attuale dell'azienda:
 * - forfettario: sempre FORF;
 * - ordinario: un FORF rimasto da un regime precedente diventa l'aliquota predefinita
 *   (o VAT22 se anche quella è FORF).
 */
export function effectiveVatCode(code: VatCode, regime: TaxRegime, fallback: VatCode): VatCode {
  if (regime === 'flat_rate') return 'FORF';
  if (code !== 'FORF') return code;
  return fallback !== 'FORF' ? fallback : 'VAT22';
}

export function isPlaceholderLegend(legend: string | null): boolean {
  return legend !== null && legend.startsWith(PLACEHOLDER_PREFIX);
}
