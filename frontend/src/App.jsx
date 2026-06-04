import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './stores/auth';
import Layout from './components/ui/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Collection from './pages/Collection';
import Sets from './pages/Sets';
import SetDetail from './pages/SetDetail';

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
        <Route index element={<Collection />} />
        <Route path="sets" element={<Sets />} />
        <Route path="sets/:code" element={<SetDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
