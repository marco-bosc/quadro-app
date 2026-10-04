// Crea dati fittizi NEGLI EMULATORI: due aziende, un utente ciascuna, membership e una bozza.
// Uso: con `npm run dev` attivo, in un altro terminale `npm run seed`.
// Lo script imposta da solo gli indirizzi degli emulatori, quindi non può scrivere sui servizi reali.

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const AUTH_HOST = '127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

// Stesso progetto usato da `npm run dev` (alias "test" in .firebaserc).
const projectId: string = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.test;

// Credenziali FITTIZIE, valide solo negli emulatori locali.
const PASSWORD = 'quadro-demo';
const COMPANIES = [
  {
    id: 'elettrica-rossi',
    name: 'Elettrica Rossi',
    user: { uid: 'user-rossi', email: 'rossi@example.test', displayName: 'Mario Rossi' },
    quote: { id: 'esempio-rossi', title: 'Rifacimento impianto cucina', notes: 'Sopralluogo fatto. Da definire numero prese.' },
  },
  {
    id: 'impianti-bianchi',
    name: 'Impianti Bianchi',
    user: { uid: 'user-bianchi', email: 'bianchi@example.test', displayName: 'Luca Bianchi' },
    quote: { id: 'esempio-bianchi', title: 'Quadro elettrico garage', notes: 'Cliente chiede anche punto luce esterno.' },
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

    const now = FieldValue.serverTimestamp();
    await db.doc(`companies/${company.id}`).set({ name: company.name, createdAt: now });
    await db.doc(`memberships/${user.uid}`).set({ companyId: company.id, role: 'owner', createdAt: now });
    await db.doc(`companies/${company.id}/quotes/${company.quote.id}`).set({
      title: company.quote.title,
      notes: company.quote.notes,
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
