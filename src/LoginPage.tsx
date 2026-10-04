import { signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { describeError } from './errors';
import { auth } from './firebase';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import './LoginPage.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Accesso · Quadro';
  }, []);

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
    <main className="page login">
      <div>
        <p className="brand">Quadro<span>.</span></p>
        <p className="tagline">Dalla richiesta al preventivo, dal telefono.</p>
      </div>
      <form onSubmit={submit} className="stack">
        <Field label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="password-row">
          <Field
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="text" aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? 'Nascondi' : 'Mostra'}
          </Button>
        </div>
        {error && <p className="notice" role="alert">{error}</p>}
        <Button type="submit" variant="primary" full disabled={busy}>{busy ? 'Accesso in corso…' : 'Accedi'}</Button>
      </form>
      <p className="login-footer muted small">L’accesso viene attivato da noi durante la prova.</p>
    </main>
  );
}
