import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { emulatorHost, PROJECT_ID } from '../helpers';

let env: RulesTestEnvironment;

function storageHost() {
  const [host, port] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '').split(':');
  if (!port) throw new Error('FIREBASE_STORAGE_EMULATOR_HOST mancante: usa "npm test".');
  return { host, port: Number(port) };
}

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode('%PDF-1.7 prova');

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { ...emulatorHost(), rules: readFileSync('firestore.rules', 'utf8') },
    storage: { ...storageHost(), rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const now = Timestamp.now();
    const db = ctx.firestore();
    await db.doc('memberships/userA').set({ companyId: 'A', role: 'owner', createdAt: now });
    await db.doc('memberships/memberA').set({ companyId: 'A', role: 'member', createdAt: now });
    await db.doc('memberships/userB').set({ companyId: 'B', role: 'owner', createdAt: now });
    const storage = ctx.storage();
    await storage.ref('companies/A/quotes/q1/Preventivo_2026-001.pdf').put(PDF, { contentType: 'application/pdf' });
    await storage.ref('companies/A/branding/logo').put(PNG, { contentType: 'image/png' });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).storage();
const anonymous = () => env.unauthenticatedContext().storage();

describe('PDF dei preventivi', () => {
  const pdf = 'companies/A/quotes/q1/Preventivo_2026-001.pdf';

  it('i membri dell’azienda li leggono', async () => {
    await assertSucceeds(as('userA').ref(pdf).getMetadata());
    await assertSucceeds(as('memberA').ref(pdf).getMetadata());
  });

  it('un membro di B non legge né elenca i PDF di A', async () => {
    await assertFails(as('userB').ref(pdf).getMetadata());
    await assertFails(as('userB').ref('companies/A/quotes/q1').listAll());
  });

  it('nessun client scrive o cancella PDF, nemmeno l’owner', async () => {
    await assertFails(as('userA').ref(pdf).put(PDF, { contentType: 'application/pdf' }).then());
    await assertFails(as('userA').ref('companies/A/quotes/q2/falso.pdf').put(PDF, { contentType: 'application/pdf' }).then());
    await assertFails(as('userA').ref(pdf).delete());
    await assertFails(as('userA').ref('companies/A/quotes/q1/logo').put(PNG, { contentType: 'image/png' }).then());
  });

  it('un utente non autenticato non legge nulla', async () => {
    await assertFails(anonymous().ref(pdf).getMetadata());
    await assertFails(anonymous().ref('companies/A/branding/logo').getMetadata());
  });
});

describe('logo', () => {
  const logo = 'companies/A/branding/logo';

  it('l’owner carica PNG o JPEG fino a 1 MB, lo sostituisce e lo rimuove', async () => {
    await assertSucceeds(as('userA').ref(logo).put(PNG, { contentType: 'image/png' }).then());
    await assertSucceeds(as('userA').ref(logo).put(PNG, { contentType: 'image/jpeg' }).then());
    await assertSucceeds(as('userA').ref(logo).put(new Uint8Array(1024 * 1024), { contentType: 'image/png' }).then());
    await assertSucceeds(as('userA').ref(logo).delete());
  });

  it('rifiuta altri formati e file oltre 1 MB', async () => {
    await assertFails(as('userA').ref(logo).put(PNG, { contentType: 'image/svg+xml' }).then());
    await assertFails(as('userA').ref(logo).put(PDF, { contentType: 'application/pdf' }).then());
    await assertFails(as('userA').ref(logo).put(new Uint8Array(1024 * 1024 + 1), { contentType: 'image/png' }).then());
  });

  it('un membro non owner lo legge ma non lo cambia', async () => {
    await assertSucceeds(as('memberA').ref(logo).getMetadata());
    await assertFails(as('memberA').ref(logo).put(PNG, { contentType: 'image/png' }).then());
    await assertFails(as('memberA').ref(logo).delete());
  });

  it('l’utente di B non legge né scrive il logo di A', async () => {
    await assertFails(as('userB').ref(logo).getMetadata());
    await assertFails(as('userB').ref(logo).put(PNG, { contentType: 'image/png' }).then());
  });

  it('nessun file fuori dai percorsi previsti', async () => {
    await assertFails(as('userA').ref('companies/A/altro/file.png').put(PNG, { contentType: 'image/png' }).then());
    await assertFails(as('userA').ref('pubblico/file.png').put(PNG, { contentType: 'image/png' }).then());
  });
});
