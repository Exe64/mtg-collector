import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import CardModal from './CardModal';

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: '📊', end: true },
  { to: '/collection', label: 'Collection', icon: '🗂️', end: false },
  { to: '/sets', label: 'Extensions', icon: '📚', end: false },
  { to: '/import', label: 'Import/Export', icon: '📥', end: false },
];

export default function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r border-slate-800 p-4">
        <h1 className="text-lg font-bold mb-6">MTG Collection</h1>
        <nav className="flex flex-col gap-1">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
            >
              <span className="mr-2">{it.icon}</span>{it.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-4 text-sm text-slate-400">
          <div className="truncate mb-2">{user?.display_name || user?.email}</div>
          <button type="button" onClick={logout} className="text-rose-400 hover:text-rose-300">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 p-4 pb-20 md:pb-4 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 flex">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs ${isActive ? 'text-white' : 'text-slate-400'}`}
          >
            <div className="text-lg">{it.icon}</div>
            {it.label}
          </NavLink>
        ))}
        <button type="button" onClick={logout} className="flex-1 py-3 text-center text-xs text-rose-400">
          <div className="text-lg">⎋</div>
          Quitter
        </button>
      </nav>

      <CardModal />
    </div>
  );
}
