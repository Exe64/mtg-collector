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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Bannière + titre */}
      <header>
        <div
          className="h-28 sm:h-36 bg-cover bg-center relative"
          style={{ backgroundImage: 'url(/banner.png)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end">
            <h1 className="px-4 pb-3 text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
              Magic Collection Manager
            </h1>
          </div>
        </div>

        {/* Menu horizontal */}
        <nav className="bg-slate-800 border-b border-slate-700 flex items-stretch px-1 overflow-x-auto">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
            >
              <span>{it.icon}</span>
              <span>{it.label}</span>
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 pr-3 pl-4">
            <span className="text-xs text-slate-400 hidden md:inline truncate max-w-[12rem]">
              {user?.display_name || user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-rose-400 hover:text-rose-300 text-sm whitespace-nowrap"
            >
              Déconnexion
            </button>
          </div>
        </nav>
      </header>

      {/* Contenu */}
      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <CardModal />
    </div>
  );
}
