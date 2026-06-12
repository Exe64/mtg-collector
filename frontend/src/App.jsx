import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './stores/auth';
import Layout from './components/ui/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Collection from './pages/Collection';
import Add from './pages/Add';
import Dashboard from './pages/Dashboard';
import Sets from './pages/Sets';
import SetDetail from './pages/SetDetail';
import ImportExport from './pages/ImportExport';
import Wishlist from './pages/Wishlist';
import DeckCheck from './pages/DeckCheck';
import Accounts from './pages/Accounts';

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
      <Route path="/register" element={<Register />} />
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
        <Route path="accounts" element={<Accounts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
