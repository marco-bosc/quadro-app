import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompanySettings } from '../shared/quote';
import { describeError } from './errors';
import { auth, db } from './firebase';
import { LoginPage } from './LoginPage';
import { QuoteEditorPage } from './QuoteEditorPage';
import { QuoteListPage } from './QuoteListPage';
import { getCompany } from './settings';
import { SettingsPage } from './SettingsPage';
import { BottomNav } from './ui/BottomNav';
import { Button } from './ui/Button';

type Route = { name: 'list' } | { name: 'settings' } | { name: 'new' } | { name: 'edit'; id: string };

function parseRoute(hash: string): Route {
  if (hash === '#/quotes/new') return { name: 'new' };
  if (hash === '#/settings') return { name: 'settings' };
  const match = /^#\/quotes\/([A-Za-z0-9_-]+)$/.exec(hash);
  if (match) return { name: 'edit', id: match[1] };
  return { name: 'list' };
}

interface Session {
  user: User;
  companyId: string;
  role: string;
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
  // Cambia a ogni navigazione: rimonta la pagina solo quando si cambia pagina davvero.
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
        const role = membership.data()?.role;
        if (typeof companyId !== 'string') {
          setState({ status: 'no-membership', user });
          return;
        }
        const company = await getCompany(db, companyId);
        setState({
          status: 'ready',
          session: {
            user,
            companyId,
            role: typeof role === 'string' ? role : '',
            companyName: company.name,
            settings: company.settings,
          },
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
      window.scrollTo(0, 0);
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

  const onSettingsSaved = useCallback((settings: CompanySettings) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', session: { ...s.session, settings } } : s));
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
        <p className="notice" role="alert">
          {state.status === 'error'
            ? state.message
            : 'Il tuo account non è ancora collegato a un’azienda. Contatta l’assistenza per l’attivazione.'}
        </p>
        <div>
          <Button variant="secondary" strong onClick={logout}>Esci</Button>
        </div>
      </main>
    );
  }

  const { session } = state;

  if (route.name === 'new' || route.name === 'edit') {
    return (
      <QuoteEditorPage
        key={routeKey}
        companyId={session.companyId}
        uid={session.user.uid}
        settings={session.settings}
        quoteId={route.name === 'edit' ? route.id : null}
        onDirtyChange={setDirty}
        onCreated={onCreated}
      />
    );
  }

  return (
    <>
      {route.name === 'settings' ? (
        <SettingsPage
          key={routeKey}
          companyId={session.companyId}
          email={session.user.email}
          isOwner={session.role === 'owner'}
          onDirtyChange={setDirty}
          onSaved={onSettingsSaved}
          onLogout={logout}
        />
      ) : (
        <QuoteListPage
          key={routeKey}
          companyId={session.companyId}
          companyName={session.companyName}
          regime={session.settings.taxRegime}
        />
      )}
      <BottomNav
        items={[
          { href: '#/', label: 'Oggi', active: route.name === 'list' },
          { href: '#/settings', label: 'Profilo', active: route.name === 'settings' },
        ]}
      />
    </>
  );
}
