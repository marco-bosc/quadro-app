// Ambiente per testare la logica delle Functions sull'emulatore Firestore, con l'SDK admin.

import { getApps, getFirestore, initializeApp, Timestamp, type Firestore } from '../../functions/test-support/admin';
import { EMPTY_PROFILE } from '../../shared/company';
import { createLine, createQuoteContent, createSection, DEFAULT_SETTINGS, type CompanySettings, type QuoteContent } from '../../shared/quote';
import { PROJECT_ID } from '../helpers';

export function adminDb(): Firestore {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST mancante: usa "npm test".');
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  return getFirestore(app);
}

export const COMPLETE_SETTINGS: CompanySettings = {
  ...DEFAULT_SETTINGS,
  ...EMPTY_PROFILE,
  legalName: 'Elettrica Rossi di Mario Rossi',
  vatNumber: '01234567897',
  address: 'Via dei Mille 5, 10123 Torino',
  signerName: 'Mario Rossi',
  taxRegime: 'ordinary',
  defaultVatCode: 'VAT22',
  hourlyRate: 320_000,
};

/** Bozza completa: 2 righe al 22% (100,00 € + 50,00 €). */
export function completeContent(over: Partial<QuoteContent> = {}): QuoteContent {
  const c = createQuoteContent(COMPLETE_SETTINGS);
  c.title = 'Quadro elettrico';
  c.customer = { name: 'Giulia Verdi', siteAddress: 'Via Po 1, Torino', contact: '' };
  const s = createSection('Quadro');
  s.lines.push(
    { ...createLine('material', 'VAT22', COMPLETE_SETTINGS), description: 'Differenziale', quantityMilli: 1_000, unitPriceTenThousandths: 1_000_000 },
    { ...createLine('labor', 'VAT22', COMPLETE_SETTINGS), description: 'Posa', quantityMilli: 1_000, unitPriceTenThousandths: 500_000 },
  );
  c.sections.push(s);
  return { ...c, ...over };
}

/** Azienda con impostazioni, owner, un membro non owner e un'altra azienda. */
export async function seedCompanies(db: Firestore, settings: CompanySettings = COMPLETE_SETTINGS) {
  const now = Timestamp.now();
  await db.doc('companies/A').set({ name: 'Elettrica Rossi', createdAt: now, settings: { ...settings, version: 1 } });
  await db.doc('companies/B').set({ name: 'Impianti Bianchi', createdAt: now, settings: { ...settings, version: 1 } });
  await db.doc('memberships/ownerA').set({ companyId: 'A', role: 'owner', createdAt: now });
  await db.doc('memberships/memberA').set({ companyId: 'A', role: 'member', createdAt: now });
  await db.doc('memberships/ownerB').set({ companyId: 'B', role: 'owner', createdAt: now });
}

export async function seedDraft(db: Firestore, companyId: string, quoteId: string, content: QuoteContent = completeContent(), version = 1) {
  const now = Timestamp.now();
  await db.doc(`companies/${companyId}/quotes/${quoteId}`).set({
    ...content,
    status: 'draft',
    version,
    createdBy: 'ownerA',
    createdAt: now,
    updatedAt: now,
  });
}

/** Svuota il database dell'emulatore (API dell'emulatore Firestore). */
export async function clearAll() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
}
