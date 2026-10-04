// Ambiente per testare la logica delle Functions sull'emulatore Firestore, con l'SDK admin.

import { getApps, getFirestore, getStorage, initializeApp, Timestamp, type Firestore } from '../../functions/test-support/admin';
import type { Bucket } from '../../functions/src/pdf/generate';
import { EMPTY_PROFILE } from '../../shared/company';
import { createLine, createQuoteContent, createSection, DEFAULT_SETTINGS, type CompanySettings, type QuoteContent } from '../../shared/quote';
import { PROJECT_ID } from '../helpers';

export const TEST_BUCKET = `${PROJECT_ID}.appspot.com`;

function adminApp() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error('Emulatori Firestore e Storage mancanti: usa "npm test".');
  }
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, storageBucket: TEST_BUCKET });
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminBucket(): Bucket {
  return getStorage(adminApp()).bucket(TEST_BUCKET);
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

/** Svuota database e bucket degli emulatori. */
export async function clearAll() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await adminBucket().deleteFiles({ force: true });
}
