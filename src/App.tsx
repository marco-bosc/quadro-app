import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { CompanySettings } from '../shared/quote';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from './errors';
import { auth, db } from './firebase';
import { LoginPage } from './LoginPage';
import { QuoteEditorPage } from './QuoteEditorPage';
import { QuoteListPage } from './QuoteListPage';
import { getCompany } from './settings';

type Route = { name: 'list' } | { name: 'new' } | { name: 'edit'; id: string };

function parseRoute(hash: string): Route {
  if (hash === '#/quotes/new') return { name: 'new' };
  const match = /^#\/quotes\/([A-Za-z0-9_-]+)$/.exec(hash);
  if (match) return { name: 'edit', id: match[1] };
  return { name: 'list' };
}

interface Session {
  user: User;
  companyId: string;
  companyName: string;
  settings: CompanySettings;
}

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'no-membership'; user: User }
  | { status: 'error'; user: User; message: string }
  | { status: 'ready'; session: Session };

const LEAVE_MESSAGE = 'Ci sono modifiche non salvate. Se continui andranno perse. Vuoi continuare?';

export function App() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  // Cambia a ogni navigazione: rimonta l'editor solo quando si cambia pagina davvero.
  const [routeKey, setRouteKey] = useState(0);
  const dirtyRef = useRef(false);
  const hashRef = useRef(window.location.hash);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: 'signed-out' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const membership = await getDoc(doc(db, 'memberships', user.uid));
        const companyId = membership.data()?.companyId;
        if (typeof companyId !== 'string') {
          setState({ status: 'no-membership', user });
          return;
        }
        const company = await getCompany(db, companyId);
        setState({
          status: 'ready',
          session: { user, companyId, companyName: company.name, settings: company.settings },
        });
      } catch (error) {
        setState({ status: 'error', user, message: describeError(error) });
      }
    });
  }, []);

  // Navigazione con l'hash: se ci sono modifiche non salvate chiede conferma,
  // anche quando l'utente usa il tasto "indietro" del browser.
  useEffect(() => {
    const onHashChange = () => {
      if (dirtyRef.current && !window.confirm(LEAVE_MESSAGE)) {
        history.replaceState(null, '', hashRef.current || '#/');
        return;
      }
      dirtyRef.current = false;
      hashRef.current = window.location.hash;
      setRoute(parseRoute(window.location.hash));
      setRouteKey((k) => k + 1);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  // Dopo la creazione la bozza ha un ID: aggiorna l'indirizzo senza rimontare l'editor.
  const onCreated = useCallback((id: string) => {
    const hash = `#/quotes/${id}`;
    history.replaceState(null, '', hash);
    hashRef.current = hash;
    setRoute({ name: 'edit', id });
  }, []);

  const logout = async () => {
    if (dirtyRef.current && !window.confirm(LEAVE_MESSAGE)) return;
    dirtyRef.current = false;
    await signOut(auth);
  };

  if (state.status === 'loading') {
    return <main className="page"><p className="muted">Caricamento…</p></main>;
  }

  if (state.status === 'signed-out') {
    return <LoginPage />;
  }

  if (state.status === 'no-membership' || state.status === 'error') {
    return (
      <main className="page">
        <h1>Quadro</h1>
        <p className="alert alert-error" role="alert">
          {state.status === 'error'
            ? state.message
            : 'Il tuo account non è ancora collegato a un’azienda. Contatta l’assistenza per l’attivazione.'}
        </p>
        <button type="button" onClick={logout}>Esci</button>
      </main>
    );
  }

  const { session } = state;
  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">{session.companyName || 'Quadro'}</a>
        <button type="button" className="link" onClick={logout}>Esci</button>
      </header>
      <main className="page">
        {route.name === 'list' ? (
          <QuoteListPage companyId={session.companyId} />
        ) : (
          <QuoteEditorPage
            key={routeKey}
            companyId={session.companyId}
            uid={session.user.uid}
            settings={session.settings}
            quoteId={route.name === 'edit' ? route.id : null}
            onDirtyChange={setDirty}
            onCreated={onCreated}
          />
        )}
      </main>
    </>
  );
}
