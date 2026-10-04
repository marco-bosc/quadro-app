// Istantanea immutabile di un preventivo emesso: tutto ciò che serve a riprodurre il documento,
// copiato al momento dell'emissione. Modifiche successive a impostazioni, logo o tariffe non la toccano.

import type { QuoteTotals } from './calc';
import type { CompanyProfile } from './company';
import type { QuoteNumber } from './numbering';
import type { QuoteContent } from './quote';
import type { TaxRegime, VatCode } from './vat';

export const SNAPSHOT_SCHEMA_VERSION = 1;

export type QuoteStatus = 'draft' | 'issued' | 'superseded';
export type PdfStatus = 'pending' | 'ready' | 'error';

export interface SnapshotVatText {
  code: VatCode;
  rateBp: number;
  label: string;
  legend: string | null;
}

export interface QuoteSnapshot {
  schemaVersion: number;
  number: QuoteNumber & { display: string; fileName: string };
  /** Data di emissione nel fuso Europe/Rome, "AAAA-MM-GG". */
  issueDate: string;
  issuedBy: string;
  company: CompanyProfile & { taxRegime: TaxRegime; logoPath: string | null };
  /** Contenuto con i codici IVA già adattati al regime. */
  content: QuoteContent;
  totals: Pick<
    QuoteTotals,
    | 'lineAmounts'
    | 'lineVatCodes'
    | 'sectionSubtotals'
    | 'vatGroups'
    | 'taxableCents'
    | 'finalDiscountCents'
    | 'discountedTaxableCents'
    | 'vatCents'
    | 'totalCents'
  >;
  vatTexts: SnapshotVatText[];
}
