import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnv, seedTwoCompanies } from '../helpers';

let env: RulesTestEnvironment;

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

const userA = () => env.authenticatedContext('userA').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

function newQuote(createdBy: string) {
  return {
    title: 'Quadro elettrico',
    notes: 'Sostituzione differenziale',
    status: 'draft',
    version: 1,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

describe('isolamento tra aziende: l’utente A non può', () => {
  it('leggere una bozza di B conoscendone l’ID', async () => {
    await assertFails(userA().doc('companies/B/quotes/qB').get());
  });

  it('elencare le bozze di B', async () => {
    await assertFails(userA().collection('companies/B/quotes').get());
  });

  it('leggere il documento dell’azienda B', async () => {
    await assertFails(userA().doc('companies/B').get());
  });

  it('creare una bozza in B', async () => {
    await assertFails(userA().doc('companies/B/quotes/nuova').set(newQuote('userA')));
  });

  it('modificare una bozza di B', async () => {
    await assertFails(
      userA().doc('companies/B/quotes/qB').update({ title: 'Modificata', version: 2, updatedAt: serverTimestamp() }),
    );
  });

  it('cancellare una bozza di B', async () => {
    await assertFails(userA().doc('companies/B/quotes/qB').delete());
  });

  it('leggere la membership di B', async () => {
    await assertFails(userA().doc('memberships/userB').get());
  });

  it('elencare le membership', async () => {
    await assertFails(userA().collection('memberships').get());
  });

  it('creare una membership (per sé o per altri)', async () => {
    const membership = { companyId: 'B', role: 'owner', createdAt: Timestamp.now() };
    await assertFails(userA().doc('memberships/userNuovo').set(membership));
    await assertFails(env.authenticatedContext('userNuovo').firestore().doc('memberships/userNuovo').set(membership));
  });

  it('modificare la propria membership per spostarsi in B', async () => {
    await assertFails(userA().doc('memberships/userA').update({ companyId: 'B' }));
  });

  it('cancellare la propria membership', async () => {
    await assertFails(userA().doc('memberships/userA').delete());
  });
});

describe('utente non autenticato', () => {
  it('non legge nulla', async () => {
    await assertFails(anonymous().doc('companies/A').get());
    await assertFails(anonymous().doc('companies/A/quotes/qA').get());
    await assertFails(anonymous().collection('companies/A/quotes').get());
    await assertFails(anonymous().doc('memberships/userA').get());
  });

  it('non scrive nulla', async () => {
    await assertFails(anonymous().doc('companies/A/quotes/nuova').set(newQuote('anonimo')));
    await assertFails(anonymous().doc('companies/A/quotes/qA').update({ title: 'x' }));
    await assertFails(anonymous().doc('memberships/x').set({ companyId: 'A', role: 'owner' }));
    await assertFails(anonymous().doc('companies/Z').set({ name: 'Nuova' }));
  });
});

describe('utente senza membership', () => {
  it('non accede a nessuna azienda', async () => {
    const db = env.authenticatedContext('userSenzaAzienda').firestore();
    await assertFails(db.doc('companies/A/quotes/qA').get());
    await assertFails(db.collection('companies/A/quotes').get());
    await assertFails(db.doc('companies/A/quotes/nuova').set(newQuote('userSenzaAzienda')));
  });
});

describe('accessi consentiti all’utente A nella propria azienda', () => {
  it('legge la propria membership e la propria azienda', async () => {
    await assertSucceeds(userA().doc('memberships/userA').get());
    await assertSucceeds(userA().doc('companies/A').get());
  });

  it('elenca e legge le bozze', async () => {
    await assertSucceeds(userA().collection('companies/A/quotes').orderBy('updatedAt', 'desc').get());
    await assertSucceeds(userA().doc('companies/A/quotes/qA').get());
  });

  it('crea una bozza valida', async () => {
    await assertSucceeds(userA().doc('companies/A/quotes/nuova').set(newQuote('userA')));
  });

  it('aggiorna una bozza incrementando la versione di 1', async () => {
    await assertSucceeds(
      userA().doc('companies/A/quotes/qA').update({ title: 'Nuovo titolo', version: 2, updatedAt: serverTimestamp() }),
    );
  });

  it('non modifica il documento dell’azienda', async () => {
    await assertFails(userA().doc('companies/A').update({ name: 'Altro nome' }));
  });

  it('non cancella le bozze', async () => {
    await assertFails(userA().doc('companies/A/quotes/qA').delete());
  });
});

describe('validazione della bozza', () => {
  const ref = () => userA().doc('companies/A/quotes/nuova');

  it('rifiuta uno stato diverso da "draft"', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), status: 'issued' }));
  });

  it('rifiuta titolo o note troppo lunghi', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), title: 'x'.repeat(201) }));
    await assertFails(ref().set({ ...newQuote('userA'), notes: 'x'.repeat(5001) }));
  });

  it('rifiuta tipi sbagliati', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), title: 42 }));
    await assertFails(ref().set({ ...newQuote('userA'), version: '1' }));
  });

  it('rifiuta campi extra o mancanti', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), total: 100 }));
    const withoutNotes: Record<string, unknown> = newQuote('userA');
    delete withoutNotes.notes;
    await assertFails(ref().set(withoutNotes));
  });

  it('rifiuta un autore diverso dall’utente, una versione iniziale diversa da 1, date non del server', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), createdBy: 'userB' }));
    await assertFails(ref().set({ ...newQuote('userA'), version: 5 }));
    await assertFails(ref().set({ ...newQuote('userA'), createdAt: Timestamp.fromDate(new Date('2020-01-01')) }));
  });

  it('rifiuta un aggiornamento che non incrementa la versione (sovrascrittura cieca)', async () => {
    const qA = () => userA().doc('companies/A/quotes/qA');
    await assertFails(qA().update({ title: 'Stessa versione', updatedAt: serverTimestamp() }));
    await assertFails(qA().update({ title: 'Salto di versione', version: 3, updatedAt: serverTimestamp() }));
    await assertFails(qA().update({ title: 'Indietro', version: 0, updatedAt: serverTimestamp() }));
  });

  it('rifiuta la modifica di autore o data di creazione', async () => {
    const qA = () => userA().doc('companies/A/quotes/qA');
    await assertFails(qA().update({ createdBy: 'altro', version: 2, updatedAt: serverTimestamp() }));
    await assertFails(qA().update({ createdAt: serverTimestamp(), version: 2, updatedAt: serverTimestamp() }));
  });
});
