import { FirebaseError } from 'firebase/app';
import { SaveError } from './quotes';

/** Messaggio in italiano per l'utente. Non include mai dati personali. */
export function describeError(error: unknown): string {
  if (error instanceof SaveError) return error.message;
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/invalid-email':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email o password non corretti.';
      case 'auth/too-many-requests':
        return 'Troppi tentativi. Attendi qualche minuto e riprova.';
      case 'auth/user-disabled':
        return 'Questo account è disattivato.';
      case 'auth/network-request-failed':
        return 'Connessione assente: controlla la rete e riprova.';
      case 'permission-denied':
        return 'Non hai i permessi per questa operazione.';
      case 'unauthenticated':
        return 'Sessione scaduta: esci e accedi di nuovo.';
      case 'not-found':
        return 'Documento non trovato.';
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Servizio non raggiungibile: controlla la connessione e riprova.';
    }
  }
  return 'Si è verificato un errore imprevisto. Riprova.';
}
