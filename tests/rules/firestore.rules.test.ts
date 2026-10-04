import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createTestEnv, emptyQuoteContent, seedTwoCompanies } from '../helpers';

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
    ...emptyQuoteContent(),
    title: 'Quadro elettrico',
    notes: 'Sostituzione differenziale',
    customer: { name: 'Mario Verdi', siteAddress: 'Via Roma 1, Torino', contact: '333 0000000' },
    finalDiscountCents: 1_000,
    sections: [
      {
        id: 's1',
        title: 'Quadro',
        lines: [
          {
            id: 'l1',
            type: 'material',
            description: 'Differenziale',
            itemCode: '',
            unit: 'pz',
            quantityMilli: 1000,
            unitPriceTenThousandths: null,
            discountBp: 0,
            vatCode: 'VAT22',
            optional: false,
          },
        ],
      },
    ],
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

describe('validazione dei campi di I02', () => {
  const ref = () => userA().doc('companies/A/quotes/nuova');

  it('accetta una bozza completa di cliente, sezioni e righe', async () => {
    await assertSucceeds(ref().set(newQuote('userA')));
  });

  it('rifiuta valori fuori dagli elenchi ammessi', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), defaultVatCode: 'VAT4' }));
    await assertFails(ref().set({ ...newQuote('userA'), pdfDetail: 'tutto' }));
  });

  it('rifiuta sconto finale negativo, decimale o di tipo sbagliato', async () => {
    await assertFails(ref().set({ ...newQuote('userA'), finalDiscountCents: -1 }));
    await assertFails(ref().set({ ...newQuote('userA'), finalDiscountCents: 10.5 }));
    await assertFails(ref().set({ ...newQuote('userA'), finalDiscountCents: '100' }));
    await assertSucceeds(ref().set({ ...newQuote('userA'), finalDiscountCents: null }));
  });

  it('rifiuta un cliente con campi mancanti, extra o troppo lunghi', async () => {
    const base = newQuote('userA');
    await assertFails(ref().set({ ...base, customer: { name: 'X', siteAddress: '' } }));
    await assertFails(ref().set({ ...base, customer: { ...base.customer, taxCode: 'ABC' } }));
    await assertFails(ref().set({ ...base, customer: { ...base.customer, siteAddress: 'x'.repeat(301) } }));
  });

  it('rifiuta testi troppo lunghi e sezioni oltre il limite', async () => {
    const base = newQuote('userA');
    await assertFails(ref().set({ ...base, validityText: 'x'.repeat(501) }));
    await assertFails(ref().set({ ...base, paymentTermsText: 'x'.repeat(1001) }));
    await assertFails(ref().set({ ...base, sections: Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, title: '', lines: [] })) }));
    await assertFails(ref().set({ ...base, sections: 'nessuna' }));
  });

  it('rifiuta una bozza senza i campi nuovi (formato I01)', async () => {
    await assertFails(
      ref().set({
        title: 'Vecchio formato',
        notes: '',
        status: 'draft',
        version: 1,
        createdBy: 'userA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('impostazioni dell’azienda', () => {
  const settings = (over: Record<string, unknown> = {}) => ({
    taxRegime: 'ordinary',
    defaultVatCode: 'VAT22',
    hourlyRate: 320_000,
    defaultValidityText: '30 giorni',
    defaultPaymentTermsText: 'Bonifico',
    version: 1,
    ...over,
  });

  it('l’owner modifica le impostazioni, con versione crescente', async () => {
    const company = () => userA().doc('companies/A');
    await assertSucceeds(company().update({ settings: settings() }));
    await assertFails(company().update({ settings: settings({ version: 1 }) })); // versione non aggiornata
    await assertSucceeds(company().update({ settings: settings({ version: 2, hourlyRate: null }) }));
  });

  it('un membro non owner non può modificarle, ma può leggerle', async () => {
    const db = env.authenticatedContext('memberA').firestore();
    await assertFails(db.doc('companies/A').update({ settings: settings() }));
    await assertSucceeds(db.doc('companies/A').get());
  });

  it('l’utente A non modifica le impostazioni di B', async () => {
    await assertFails(userA().doc('companies/B').update({ settings: settings() }));
  });

  it('non si possono cambiare altri campi dell’azienda insieme alle impostazioni', async () => {
    await assertFails(userA().doc('companies/A').update({ settings: settings(), name: 'Altro' }));
  });

  it('rifiuta impostazioni non valide', async () => {
    const company = () => userA().doc('companies/A');
    await assertFails(company().update({ settings: settings({ taxRegime: 'misto' }) }));
    await assertFails(company().update({ settings: settings({ taxRegime: 'flat_rate', defaultVatCode: 'VAT22' }) }));
    await assertFails(company().update({ settings: settings({ defaultVatCode: 'FORF' }) }));
    await assertFails(company().update({ settings: settings({ hourlyRate: -1 }) }));
    await assertFails(company().update({ settings: settings({ hourlyRate: 32.5 }) }));
    await assertFails(company().update({ settings: settings({ defaultValidityText: 'x'.repeat(501) }) }));
    await assertFails(company().update({ settings: settings({ extra: true }) }));
    await assertSucceeds(company().update({ settings: settings({ taxRegime: 'flat_rate', defaultVatCode: 'FORF' }) }));
  });

  it('nessuno crea o cancella aziende dal client', async () => {
    await assertFails(userA().doc('companies/Nuova').set({ name: 'Nuova', createdAt: Timestamp.now() }));
    await assertFails(userA().doc('companies/A').delete());
  });
});
