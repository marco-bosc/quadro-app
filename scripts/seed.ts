// Crea dati fittizi NEGLI EMULATORI: due aziende, un utente ciascuna, membership e una bozza.
// Uso: con `npm run dev` attivo, in un altro terminale `npm run seed`.
// Lo script imposta da solo gli indirizzi degli emulatori, quindi non può scrivere sui servizi reali.

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { validateQuoteContent, validateSettings, type CompanySettings, type QuoteContent, type QuoteLine } from '../shared/quote';

// Se lo script gira dentro `firebase emulators:exec`, gli indirizzi arrivano dalle variabili d'ambiente;
// altrimenti valgono le porte di firebase.json. In entrambi i casi sono emulatori locali.
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
for (const host of [AUTH_HOST, FIRESTORE_HOST]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error(`Il seed scrive solo su emulatori locali, non su ${host}.`);
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

// Stesso progetto usato da `npm run dev` (alias "test" in .firebaserc).
const projectId: string = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.test;

// Credenziali FITTIZIE, valide solo negli emulatori locali.
const PASSWORD = 'quadro-demo';

let lineSeq = 0;
function line(over: Partial<QuoteLine> & Pick<QuoteLine, 'description'>): QuoteLine {
  lineSeq += 1;
  return {
    id: `riga-${lineSeq}`,
    type: 'material',
    itemCode: '',
    unit: 'pz',
    quantityMilli: 1_000,
    unitPriceTenThousandths: null,
    discountBp: 0,
    vatCode: 'VAT22',
    optional: false,
    ...over,
  };
}

interface SeedCompany {
  id: string;
  name: string;
  settings: CompanySettings;
  user: { uid: string; email: string; displayName: string };
  quoteId: string;
  quote: QuoteContent;
}

const COMPANIES: SeedCompany[] = [
  {
    id: 'elettrica-rossi',
    name: 'Elettrica Rossi',
    settings: {
      taxRegime: 'ordinary',
      defaultVatCode: 'VAT10',
      hourlyRate: 320_000, // 32,00 €/h
      defaultValidityText: 'Offerta valida 30 giorni dalla data del preventivo.',
      defaultPaymentTermsText: '30% all’accettazione, saldo a fine lavori con bonifico.',
    },
    user: { uid: 'user-rossi', email: 'rossi@example.test', displayName: 'Mario Rossi' },
    quoteId: 'esempio-rossi',
    quote: {
      title: 'Rifacimento impianto cucina',
      notes: 'Sopralluogo fatto il 2 ottobre.',
      customer: { name: 'Giulia Verdi', siteAddress: 'Via Garibaldi 12, Torino', contact: '333 000 0000' },
      validityText: 'Offerta valida 30 giorni dalla data del preventivo.',
      paymentTermsText: '30% all’accettazione, saldo a fine lavori con bonifico.',
      defaultVatCode: 'VAT10',
      finalDiscountCents: 2_000,
      pdfDetail: 'lines',
      sections: [
        {
          id: 'sezione-quadro',
          title: 'Quadro elettrico',
          lines: [
            line({ description: 'Interruttore differenziale 2P 40A 30mA', itemCode: 'DIF2P40', unitPriceTenThousandths: 854_000, vatCode: 'VAT10' }),
            line({ description: 'Magnetotermico 1P+N 16A', quantityMilli: 4_000, unitPriceTenThousandths: 123_750, discountBp: 1_000, vatCode: 'VAT10' }),
            line({ type: 'labor', unit: 'h', description: 'Cablaggio quadro', quantityMilli: 3_500, unitPriceTenThousandths: 320_000, vatCode: 'VAT10' }),
          ],
        },
        {
          id: 'sezione-cucina',
          title: 'Cucina',
          lines: [
            line({ unit: 'm', description: 'Cavo FS17 3G1,5', quantityMilli: 37_500, unitPriceTenThousandths: 4_567 }),
            line({ description: 'Presa Schuko 16A', quantityMilli: 6_000, unitPriceTenThousandths: 78_500, discountBp: 500 }),
            // Prezzo ancora da chiedere al fornitore: resta vuoto, il totale risulta parziale.
            line({ description: 'Punto presa piano cottura 32A', unitPriceTenThousandths: null }),
            line({ type: 'text', description: 'I prezzi non comprendono opere murarie.', quantityMilli: null }),
            line({ description: 'Punto luce esterno sul balcone', unitPriceTenThousandths: 450_000, optional: true }),
          ],
        },
      ],
    },
  },
  {
    id: 'impianti-bianchi',
    name: 'Impianti Bianchi',
    settings: {
      taxRegime: 'flat_rate',
      defaultVatCode: 'FORF',
      hourlyRate: 280_000, // 28,00 €/h
      defaultValidityText: 'Offerta valida 15 giorni.',
      defaultPaymentTermsText: 'Pagamento a fine lavori.',
    },
    user: { uid: 'user-bianchi', email: 'bianchi@example.test', displayName: 'Luca Bianchi' },
    quoteId: 'esempio-bianchi',
    quote: {
      title: 'Quadro elettrico garage',
      notes: 'Il cliente chiede anche un punto luce esterno.',
      customer: { name: 'Paolo Neri', siteAddress: 'Strada del Mulino 4, Chieri', contact: 'paolo.neri@example.test' },
      validityText: 'Offerta valida 15 giorni.',
      paymentTermsText: 'Pagamento a fine lavori.',
      defaultVatCode: 'FORF',
      finalDiscountCents: null,
      pdfDetail: 'sections',
      sections: [
        {
          id: 'sezione-garage',
          title: 'Garage',
          lines: [
            line({ type: 'lump_sum', unit: 'corpo', description: 'Fornitura e posa quadro 12 moduli', unitPriceTenThousandths: 3_200_000, vatCode: 'FORF' }),
            line({ type: 'labor', unit: 'h', description: 'Collegamenti e collaudo', quantityMilli: 2_000, unitPriceTenThousandths: 280_000, vatCode: 'FORF' }),
          ],
        },
        {
          id: 'sezione-esterno',
          title: 'Esterno',
          lines: [
            line({ description: 'Plafoniera LED IP65', unitPriceTenThousandths: null, vatCode: 'FORF' }),
            line({ description: 'Sensore crepuscolare', unitPriceTenThousandths: 250_000, vatCode: 'FORF', optional: true }),
          ],
        },
      ],
    },
  },
];

async function checkEmulators() {
  for (const [name, url] of [
    ['Auth', `http://${AUTH_HOST}/`],
    ['Firestore', `http://${FIRESTORE_HOST}/`],
  ]) {
    try {
      await fetch(url);
    } catch {
      throw new Error(`Emulatore ${name} non raggiungibile su ${url}. Avvia prima "npm run dev".`);
    }
  }
}

async function main() {
  await checkEmulators();
  initializeApp({ projectId });
  const auth = getAuth();
  const db = getFirestore();

  for (const company of COMPANIES) {
    const { user } = company;
    try {
      await auth.getUser(user.uid);
      await auth.updateUser(user.uid, { email: user.email, password: PASSWORD, displayName: user.displayName });
    } catch {
      await auth.createUser({ ...user, password: PASSWORD, emailVerified: true });
    }

    // I dati di esempio devono essere validi quanto quelli creati dall'app.
    const issues = [...validateSettings(company.settings), ...validateQuoteContent(company.quote, company.settings.taxRegime)];
    if (issues.length > 0) throw new Error(`Dati di esempio non validi per ${company.name}: ${issues.map((i) => i.path).join(', ')}`);

    const now = FieldValue.serverTimestamp();
    await db.doc(`companies/${company.id}`).set({ name: company.name, createdAt: now, settings: { ...company.settings, version: 1 } });
    await db.doc(`memberships/${user.uid}`).set({ companyId: company.id, role: 'owner', createdAt: now });
    await db.doc(`companies/${company.id}/quotes/${company.quoteId}`).set({
      ...company.quote,
      status: 'draft',
      version: 1,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`✓ ${company.name}: ${user.email} / ${PASSWORD}`);
  }
  console.log(`Dati fittizi creati negli emulatori (progetto ${projectId}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
