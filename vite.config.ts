import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { FUNCTIONS_REGION } from './shared/region';

// In Codespaces aperto dal browser, "localhost" è il computer dell'utente:
// il browser raggiunge solo la porta di Vite (5173, inoltrata e privata).
// Vite inoltra quindi al codespace le chiamate verso gli emulatori.
// `firebase emulators:exec` passa gli indirizzi degli emulatori nelle variabili d'ambiente.
const AUTH_EMULATOR = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const FIRESTORE_EMULATOR = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}`;
const STORAGE_EMULATOR = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'}`;
const FUNCTIONS_EMULATOR = `http://${process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001'}`;
// Le callable nell'emulatore rispondono su /<progetto>/<regione>/<nome>.
const PROJECT_ID = process.env.GCLOUD_PROJECT || JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.test;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true,
    allowedHosts: ['.app.github.dev', 'localhost', '127.0.0.1'],
    proxy: {
      '/identitytoolkit.googleapis.com': AUTH_EMULATOR,
      '/securetoken.googleapis.com': AUTH_EMULATOR,
      '/emulator': AUTH_EMULATOR,
      '/google.firestore.v1.Firestore': FIRESTORE_EMULATOR,
      '/v1/projects': FIRESTORE_EMULATOR,
      '/v0': STORAGE_EMULATOR,
      '/__functions': {
        target: FUNCTIONS_EMULATOR,
        rewrite: (path) => path.replace(/^\/__functions/, `/${PROJECT_ID}/${FUNCTIONS_REGION}`),
      },
    },
  },
});
