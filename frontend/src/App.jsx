import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './stores/auth';
import Layout from './components/ui/Layout';
import Login from './pages/Login';

const Collection = lazy(() => import('./pages/Collection'));
const Add = lazy(() => import('./pages/Add'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sets = lazy(() => import('./pages/Sets'));
const SetDetail = lazy(() => import('./pages/SetDetail'));
const ImportExport = lazy(() => import('./pages/ImportExport'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const DeckCheck = lazy(() => import('./pages/DeckCheck'));
const Decks = lazy(() => import('./pages/Decks'));
const DeckDetail = lazy(() => import('./pages/DeckDetail'));
const Commanders = lazy(() => import('./pages/Commanders'));
const CommanderDetail = lazy(() => import('./pages/CommanderDetail'));
const Movements = lazy(() => import('./pages/Movements'));
const Journal = lazy(() => import('./pages/Journal'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Security = lazy(() => import('./pages/Security'));
const Register = lazy(() => import('./pages/Register'));

function Protected({ children }) {
  const status = useAuth((s) => s.status);
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">
        Chargement…
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => { bootstrap(); }, [bootstrap]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Suspense fallback={null}><Register /></Suspense>} />
      <Route
        path="/"
        element={(
          <Protected>
            <Layout />
          </Protected>
        )}
      >
        <Route index element={<Dashboard />} />
        <Route path="collection" element={<Collection />} />
        <Route path="add" element={<Add />} />
        <Route path="sets" element={<Sets />} />
        <Route path="sets/:code" element={<SetDetail />} />
        <Route path="import" element={<ImportExport />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="deck" element={<DeckCheck />} />
        <Route path="decks" element={<Decks />} />
        <Route path="decks/:id" element={<DeckDetail />} />
        <Route path="commanders" element={<Commanders />} />
        <Route path="commanders/:id" element={<CommanderDetail />} />
        <Route path="movements" element={<Movements />} />
        <Route path="journal" element={<Journal />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="security" element={<Security />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
