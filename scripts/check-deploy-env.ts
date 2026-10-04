// Controllo prima del deploy sul progetto di test: la build deve usare il progetto vero, non gli emulatori.
// Legge .env.firebase-test.local (escluso da git), usato da `vite build --mode firebase-test`.

import { existsSync, readFileSync } from 'node:fs';

const FILE = '.env.firebase-test.local';
const projectId: string = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.test;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(FILE)) fail(`${FILE} mancante: copia .env.example e inserisci la configurazione web del progetto ${projectId}.`);
const env = Object.fromEntries(
  readFileSync(FILE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

if (env.VITE_USE_EMULATORS !== 'false') fail(`${FILE}: VITE_USE_EMULATORS deve essere "false".`);
if (env.VITE_FIREBASE_PROJECT_ID !== projectId) fail(`${FILE}: VITE_FIREBASE_PROJECT_ID deve essere "${projectId}".`);
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_STORAGE_BUCKET']) {
  if (!env[key] || env[key].startsWith('fake')) fail(`${FILE}: ${key} mancante o fittizio.`);
}
const fnEnv = readFileSync(`functions/.env.${projectId}`, 'utf8');
if (!fnEnv.includes(`STORAGE_BUCKET=${env.VITE_FIREBASE_STORAGE_BUCKET}`)) {
  fail(`Il bucket di ${FILE} e quello di functions/.env.${projectId} non coincidono.`);
}
console.log(`✓ Configurazione di deploy per ${projectId} corretta (bucket ${env.VITE_FIREBASE_STORAGE_BUCKET}).`);
