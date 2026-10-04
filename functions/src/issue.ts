import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { calculateQuote } from '../../shared/calc';
import { missingForIssue, type CompanyProfile } from '../../shared/company';
import { displayQuoteNumber, nextSequence, quoteFileName, romeDate, type QuoteNumber } from '../../shared/numbering';
import { normalizeVatCodes, parseQuoteContent, parseSettings, validateQuoteContent } from '../../shared/quote';
import { SNAPSHOT_SCHEMA_VERSION, type QuoteSnapshot } from '../../shared/snapshot';
import { isPlaceholderLegend, VAT } from '../../shared/vat';
import { precondition, requireInt, requireMember, requireString } from './access';
import { counterPath } from './numbering';

export interface IssueDeps {
  db: Firestore;
  now: () => Date;
  /** true nel progetto di test: si emette anche con diciture IVA non confermate (segnaposto visibili). */
  allowUnconfirmedVatTexts: boolean;
}

const PROFILE_LABELS: Record<keyof CompanyProfile, string> = {
  legalName: 'ragione sociale',
  vatNumber: 'partita IVA',
  taxCode: 'codice fiscale',
  address: 'indirizzo',
  phone: 'telefono',
  email: 'email',
  website: 'sito',
  signerName: 'nome di chi firma',
};

/**
 * Emette una bozza: verifica, ricalcola i totali sul server e, in un'unica transazione,
 * assegna il numero, congela l'istantanea e porta lo stato a "issued" con pdfStatus "pending".
 */
export async function issueQuoteHandler(deps: IssueDeps, uid: string, data: unknown) {
  const input = (data ?? {}) as Record<string, unknown>;
  const companyId = requireString(input.companyId, 'companyId');
  const quoteId = requireString(input.quoteId, 'quoteId');
  const version = requireInt(input.version, 'version');
  await requireMember(deps.db, uid, companyId);

  const companyRef = deps.db.doc(`companies/${companyId}`);
  const quoteRef = deps.db.doc(`companies/${companyId}/quotes/${quoteId}`);
  const now = deps.now();
  const { year, isoDate } = romeDate(now);
  const counterRef = deps.db.doc(counterPath(companyId, year));

  return deps.db.runTransaction(async (tx) => {
    const [quoteSnap, companySnap, counterSnap] = await Promise.all([tx.get(quoteRef), tx.get(companyRef), tx.get(counterRef)]);
    const quote = quoteSnap.data();
    if (!quote) throw new HttpsError('not-found', 'Preventivo non trovato.');
    if (quote.status !== 'draft') throw precondition('not-draft', 'Il preventivo è già stato emesso.');
    if (quote.version !== version) {
      throw precondition('version-conflict', 'Il preventivo è stato modificato dopo l’apertura: ricaricalo e riprova.');
    }

    const settings = parseSettings(companySnap.data()?.settings);
    const missing = missingForIssue(settings);
    if (missing.length > 0) {
      throw precondition(
        'missing-company-profile',
        `Prima di emettere completa i dati dell’azienda nel Profilo: ${missing.map((f) => PROFILE_LABELS[f]).join(', ')}.`,
      );
    }

    // Il server non si fida di nulla di calcolato dal client: rilegge il contenuto e ricalcola tutto.
    const content = normalizeVatCodes(parseQuoteContent(quote), settings.taxRegime, settings.defaultVatCode).content;
    const issues = validateQuoteContent(content, settings.taxRegime);
    if (issues.length > 0) throw precondition('invalid', `Il preventivo contiene dati non validi: ${issues[0].message}`);
    const totals = calculateQuote(content, settings.taxRegime);
    if (totals.errors.includes('discount-exceeds-taxable')) {
      throw precondition('invalid', 'Lo sconto finale supera l’imponibile.');
    }
    if (!totals.complete) {
      throw precondition(
        'incomplete',
        `Il preventivo è incompleto: ${totals.incompleteLines.length === 1 ? '1 riga da completare' : `${totals.incompleteLines.length} righe da completare`}.`,
      );
    }

    const unconfirmed = totals.usedVatCodes.filter((code) => isPlaceholderLegend(VAT[code].legend));
    if (unconfirmed.length > 0 && !deps.allowUnconfirmedVatTexts) {
      throw precondition(
        'unconfirmed-vat-texts',
        `Non si può ancora emettere: le diciture di ${unconfirmed.map((c) => VAT[c].label).join(', ')} non sono state confermate.`,
      );
    }

    const sequence = nextSequence(counterSnap.data());
    const number: QuoteNumber = { year, sequence, revision: 0 };
    const snapshot: QuoteSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      number: { ...number, display: displayQuoteNumber(number), fileName: quoteFileName(number) },
      issueDate: isoDate,
      issuedBy: uid,
      company: {
        legalName: settings.legalName,
        vatNumber: settings.vatNumber,
        taxCode: settings.taxCode,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        signerName: settings.signerName,
        taxRegime: settings.taxRegime,
        logoPath: null, // il logo arriva in I02b-B2
      },
      content,
      totals: {
        lineAmounts: totals.lineAmounts,
        lineVatCodes: totals.lineVatCodes,
        sectionSubtotals: totals.sectionSubtotals,
        vatGroups: totals.vatGroups,
        taxableCents: totals.taxableCents,
        finalDiscountCents: totals.finalDiscountCents,
        discountedTaxableCents: totals.discountedTaxableCents,
        vatCents: totals.vatCents,
        totalCents: totals.totalCents,
      },
      vatTexts: totals.usedVatCodes.map((code) => ({
        code,
        rateBp: VAT[code].rateBp,
        label: VAT[code].label,
        legend: VAT[code].legend,
      })),
    };

    tx.set(counterRef, { year, lastIssued: sequence, next: sequence + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.update(quoteRef, {
      status: 'issued',
      number: { year, sequence },
      revision: 0,
      displayNumber: snapshot.number.display,
      issuedAt: Timestamp.fromDate(now),
      issuedBy: uid,
      snapshot,
      pdfStatus: 'pending',
      pdfPath: null,
      version: version + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { displayNumber: snapshot.number.display, totalCents: totals.totalCents };
  });
}
