import { FirebaseError } from 'firebase/app';
import { SaveError } from './quotes';

/** Messaggio in italiano per l'utente. Non include mai dati personali. */
export function describeError(error: unknown): string {
  if (error instanceof SaveError) return error.message;
  if (error instanceof FirebaseError) {
    // Errori delle Functions: il server manda già un messaggio in italiano, tranne per quelli imprevisti.
    if (error.code.startsWith('functions/')) {
      if (error.code === 'functions/unavailable' || error.code === 'functions/deadline-exceeded') {
        return 'Servizio non raggiungibile: controlla la connessione e riprova.';
      }
      if (error.code === 'functions/internal' && error.message === 'internal') return 'Errore imprevisto sul server. Riprova tra poco.';
      // L'SDK aggiunge il codice HTTP in fondo al messaggio ("… [400]"): non serve all'utente.
      return error.message.replace(/\s*\[\d{3}\]$/, '');
    }
    if (error.code === 'storage/unauthorized') return 'Non hai i permessi per questo file.';
    if (error.code === 'storage/retry-limit-exceeded') return 'Connessione assente: controlla la rete e riprova.';
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
