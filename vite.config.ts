import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In Codespaces aperto dal browser, "localhost" è il computer dell'utente:
// il browser raggiunge solo la porta di Vite (5173, inoltrata e privata).
// Vite inoltra quindi al codespace le chiamate verso gli emulatori.
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['.app.github.dev', 'localhost', '127.0.0.1'],
    proxy: {
      '/identitytoolkit.googleapis.com': AUTH_EMULATOR,
      '/securetoken.googleapis.com': AUTH_EMULATOR,
      '/emulator': AUTH_EMULATOR,
      '/google.firestore.v1.Firestore': FIRESTORE_EMULATOR,
      '/v1/projects': FIRESTORE_EMULATOR,
    },
  },
});
