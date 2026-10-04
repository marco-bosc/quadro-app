import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { createLine, createSection, type QuoteContent } from '../shared/quote';
import { createQuote, getQuote, listQuotes, saveQuote, SaveError } from '../src/quotes';
import { getCompany, saveSettings } from '../src/settings';
import { createTestEnv, emptyQuoteContent, emulatorHost, PROJECT_ID, seedTwoCompanies } from './helpers';

/** Contenuto con titolo e note, e il resto vuoto. */
function content(title: string, notes = ''): QuoteContent {
  return { ...emptyQuoteContent(), title, notes };
}

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
    const { id, version } = await createQuote(db, 'A', 'userA', content('Impianto cucina', 'Tre prese'), 'ordinary');
    expect(version).toBe(1);

    // Riapertura da un altro client, come dopo un ricaricamento della pagina.
    const reopened = await getQuote(clientFor('userA'), 'A', id);
    expect(reopened).toMatchObject({ status: 'draft', version: 1 });
    expect(reopened?.content).toEqual(content('Impianto cucina', 'Tre prese'));
    expect(reopened?.createdBy).toBe('userA');

    const list = await listQuotes(db, 'A');
    expect(list[0].id).toBe(id);
  });

  it('l’utente di B non vede le bozze di A', async () => {
    const dbA = clientFor('userA');
    await createQuote(dbA, 'A', 'userA', content('Riservata'), 'ordinary');
    await expect(listQuotes(clientFor('userB'), 'A')).rejects.toMatchObject({ code: 'permission-denied' });
    const ownList = await listQuotes(clientFor('userB'), 'B');
    expect(ownList.map((q) => q.content.title)).toEqual(['Bozza']);
  });

  it('rifiuta una bozza troppo lunga prima di inviarla', async () => {
    await expect(createQuote(clientFor('userA'), 'A', 'userA', content('x'.repeat(201)), 'ordinary')).rejects.toBeInstanceOf(
      SaveError,
    );
  });
});

describe('conflitto di versione', () => {
  it('due salvataggi dalla stessa versione: il secondo fallisce e non sovrascrive', async () => {
    const first = clientFor('userA');
    const second = clientFor('userA');

    const newVersion = await saveQuote(first, 'A', 'qA', 1, content('Prima modifica', 'da telefono'), 'ordinary');
    expect(newVersion).toBe(2);

    const error = await saveQuote(second, 'A', 'qA', 1, content('Seconda modifica', 'da computer'), 'ordinary').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SaveError);
    expect((error as SaveError).reason).toBe('conflict');

    const stored = await getQuote(first, 'A', 'qA');
    expect(stored?.version).toBe(2);
    expect(stored?.content).toMatchObject({ title: 'Prima modifica', notes: 'da telefono' });
  });

  it('due salvataggi lanciati in contemporanea: uno solo riesce, l’altro è un conflitto', async () => {
    const results = await Promise.allSettled([
      saveQuote(clientFor('userA'), 'A', 'qA', 1, content('Contemporaneo 1', ''), 'ordinary'),
      saveQuote(clientFor('userA'), 'A', 'qA', 1, content('Contemporaneo 2', ''), 'ordinary'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ reason: 'conflict' });

    const winner = results[0].status === 'fulfilled' ? 'Contemporaneo 1' : 'Contemporaneo 2';
    const stored = await getQuote(clientFor('userA'), 'A', 'qA');
    expect(stored?.version).toBe(2);
    expect(stored?.content.title).toBe(winner);
  });

  it('salvataggi successivi dalla versione aggiornata riescono', async () => {
    const db = clientFor('userA');
    const v2 = await saveQuote(db, 'A', 'qA', 1, content('v2', ''), 'ordinary');
    const v3 = await saveQuote(db, 'A', 'qA', v2, content('v3', ''), 'ordinary');
    expect(v3).toBe(3);
  });
});

describe('preventivo completo', () => {
  it('sezioni e righe salvate e riaperte identiche; prezzo vuoto resta null', async () => {
    const db = clientFor('userA');
    const settings = (await getCompany(db, 'A')).settings;
    const c = content('Impianto bagno');
    c.customer = { name: 'Anna Neri', siteAddress: 'Via Po 3', contact: 'anna@example.test' };
    c.finalDiscountCents = 500;
    const section = createSection('Bagno');
    section.lines.push(
      { ...createLine('material', 'VAT10', settings), description: 'Faretto', quantityMilli: 2_000, unitPriceTenThousandths: null },
      { ...createLine('lump_sum', 'VAT22', settings), description: 'Assistenza', unitPriceTenThousandths: 800_000, optional: true },
    );
    c.sections.push(section);

    const { id } = await createQuote(db, 'A', 'userA', c, 'ordinary');
    const reopened = await getQuote(clientFor('userA'), 'A', id);
    expect(reopened?.content).toEqual(c);
    expect(reopened?.content.sections[0].lines[0].unitPriceTenThousandths).toBeNull();
  });

  it('rifiuta prima di inviare un codice IVA non ammesso dal regime', async () => {
    const c = content('Forfettario');
    c.defaultVatCode = 'VAT22';
    await expect(createQuote(clientFor('userA'), 'A', 'userA', c, 'flat_rate')).rejects.toMatchObject({ reason: 'invalid' });
  });

  it('una bozza nel formato di I01 si apre e al salvataggio passa al formato nuovo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const now = Timestamp.now();
      await ctx.firestore().doc('companies/A/quotes/vecchia').set({
        title: 'Formato I01',
        notes: 'Solo titolo e note',
        status: 'draft',
        version: 4,
        createdBy: 'userA',
        createdAt: now,
        updatedAt: now,
      });
    });
    const db = clientFor('userA');
    const old = await getQuote(db, 'A', 'vecchia');
    expect(old?.content).toEqual(content('Formato I01', 'Solo titolo e note'));
    expect(await saveQuote(db, 'A', 'vecchia', 4, old!.content, 'ordinary')).toBe(5);
  });
});

describe('impostazioni dell’azienda', () => {
  it('l’owner salva le impostazioni; un salvataggio da una versione vecchia è un conflitto', async () => {
    const db = clientFor('userA');
    const company = await getCompany(db, 'A');
    expect(company.settingsVersion).toBe(0);
    const updated = { ...company.settings, hourlyRate: 350_000, defaultValidityText: '30 giorni' };
    expect(await saveSettings(db, 'A', 0, updated)).toBe(1);
    expect((await getCompany(clientFor('userA'), 'A')).settings).toEqual(updated);
    await expect(saveSettings(clientFor('userA'), 'A', 0, updated)).rejects.toMatchObject({ reason: 'conflict' });
  });

  it('un membro non owner non può salvarle', async () => {
    await expect(saveSettings(clientFor('memberA'), 'A', 0, (await getCompany(clientFor('memberA'), 'A')).settings)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});
