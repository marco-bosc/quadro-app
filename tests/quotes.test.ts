import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createQuote, getQuote, listQuotes, saveQuote, SaveError } from '../src/quotes';
import { createTestEnv, emulatorHost, PROJECT_ID, seedTwoCompanies } from './helpers';

// Questi test usano le stesse funzioni dell'interfaccia (src/quotes.ts), con l'SDK web
// collegato all'emulatore e le regole attive.

let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [];

/** Un "browser" separato, autenticato come uid. */
function clientFor(uid: string): Firestore {
  const app = initializeApp({ projectId: PROJECT_ID }, `client-${uid}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  const { host, port } = emulatorHost();
  connectFirestoreEmulator(db, host, port, { mockUserToken: { sub: uid, user_id: uid } });
  return db;
}

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedTwoCompanies(env);
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => deleteApp(app)));
});

describe('creazione e riapertura', () => {
  it('crea una bozza, la ritrova identica e la vede in cima all’elenco', async () => {
    const db = clientFor('userA');
    const { id, version } = await createQuote(db, 'A', 'userA', { title: 'Impianto cucina', notes: 'Tre prese' });
    expect(version).toBe(1);

    // Riapertura da un altro client, come dopo un ricaricamento della pagina.
    const reopened = await getQuote(clientFor('userA'), 'A', id);
    expect(reopened).toMatchObject({ title: 'Impianto cucina', notes: 'Tre prese', status: 'draft', version: 1 });
    expect(reopened?.createdBy).toBe('userA');

    const list = await listQuotes(db, 'A');
    expect(list[0].id).toBe(id);
  });

  it('l’utente di B non vede le bozze di A', async () => {
    const dbA = clientFor('userA');
    await createQuote(dbA, 'A', 'userA', { title: 'Riservata', notes: '' });
    await expect(listQuotes(clientFor('userB'), 'A')).rejects.toMatchObject({ code: 'permission-denied' });
    const ownList = await listQuotes(clientFor('userB'), 'B');
    expect(ownList.map((q) => q.title)).toEqual(['Bozza']);
  });

  it('rifiuta una bozza troppo lunga prima di inviarla', async () => {
    await expect(createQuote(clientFor('userA'), 'A', 'userA', { title: 'x'.repeat(201), notes: '' })).rejects.toBeInstanceOf(
      SaveError,
    );
  });
});

describe('conflitto di versione', () => {
  it('due salvataggi dalla stessa versione: il secondo fallisce e non sovrascrive', async () => {
    const first = clientFor('userA');
    const second = clientFor('userA');

    const newVersion = await saveQuote(first, 'A', 'qA', 1, { title: 'Prima modifica', notes: 'da telefono' });
    expect(newVersion).toBe(2);

    const error = await saveQuote(second, 'A', 'qA', 1, { title: 'Seconda modifica', notes: 'da computer' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SaveError);
    expect((error as SaveError).reason).toBe('conflict');

    const stored = await getQuote(first, 'A', 'qA');
    expect(stored).toMatchObject({ title: 'Prima modifica', notes: 'da telefono', version: 2 });
  });

  it('due salvataggi lanciati in contemporanea: uno solo riesce, l’altro è un conflitto', async () => {
    const results = await Promise.allSettled([
      saveQuote(clientFor('userA'), 'A', 'qA', 1, { title: 'Contemporaneo 1', notes: '' }),
      saveQuote(clientFor('userA'), 'A', 'qA', 1, { title: 'Contemporaneo 2', notes: '' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ reason: 'conflict' });

    const winner = results[0].status === 'fulfilled' ? 'Contemporaneo 1' : 'Contemporaneo 2';
    const stored = await getQuote(clientFor('userA'), 'A', 'qA');
    expect(stored).toMatchObject({ title: winner, version: 2 });
  });

  it('salvataggi successivi dalla versione aggiornata riescono', async () => {
    const db = clientFor('userA');
    const v2 = await saveQuote(db, 'A', 'qA', 1, { title: 'v2', notes: '' });
    const v3 = await saveQuote(db, 'A', 'qA', v2, { title: 'v3', notes: '' });
    expect(v3).toBe(3);
  });
});
