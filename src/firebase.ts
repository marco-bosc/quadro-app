import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const env = import.meta.env;
const useEmulators = env.VITE_USE_EMULATORS === 'true';

// In sviluppo l'app non deve mai toccare i servizi reali.
if (env.DEV && !useEmulators) {
  throw new Error('In sviluppo imposta VITE_USE_EMULATORS=true in .env.local (vedi .env.example).');
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

// Con gli emulatori, Auth e Firestore puntano allo stesso indirizzo della pagina:
// è il proxy di Vite (vite.config.ts) a inoltrare le chiamate agli emulatori nel codespace.
// Così funziona sia da VS Code desktop (http://localhost:5173) sia dal browser
// (https://<codespace>-5173.app.github.dev) senza rendere pubbliche altre porte.
if (useEmulators) {
  connectAuthEmulator(auth, window.location.origin);
}

export const db = useEmulators
  ? initializeFirestore(app, {
      host: window.location.host,
      ssl: window.location.protocol === 'https:',
      experimentalForceLongPolling: true,
    })
  : getFirestore(app);
