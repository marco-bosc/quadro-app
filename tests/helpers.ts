import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'demo-quadro';

export function emulatorHost(): { host: string; port: number } {
  const value = process.env.FIRESTORE_EMULATOR_HOST;
  if (!value) throw new Error('FIRESTORE_EMULATOR_HOST mancante: avvia i test con "npm test" o "npm run test:rules".');
  const [host, port] = value.split(':');
  return { host, port: Number(port) };
}

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { ...emulatorHost(), rules: readFileSync('firestore.rules', 'utf8') },
  });
}

/** Due aziende, un utente ciascuna, una bozza ciascuna. Scritte senza regole, come farebbe l'amministrazione. */
export async function seedTwoCompanies(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    await db.doc('companies/A').set({ name: 'Elettrica Rossi', createdAt: now });
    await db.doc('companies/B').set({ name: 'Impianti Bianchi', createdAt: now });
    await db.doc('memberships/userA').set({ companyId: 'A', role: 'owner', createdAt: now });
    await db.doc('memberships/userB').set({ companyId: 'B', role: 'owner', createdAt: now });
    const quote = (createdBy: string) => ({
      title: 'Bozza',
      notes: '',
      status: 'draft',
      version: 1,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    await db.doc('companies/A/quotes/qA').set(quote('userA'));
    await db.doc('companies/B/quotes/qB').set(quote('userB'));
  });
}
