import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { describeError } from './errors';
import { auth } from './firebase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Quadro</h1>
      <form onSubmit={submit} className="stack">
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>{busy ? 'Accesso in corso…' : 'Accedi'}</button>
      </form>
    </main>
  );
}
