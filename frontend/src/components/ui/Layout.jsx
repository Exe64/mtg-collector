import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, PlusCircle, Library, Star, Download } from 'lucide-react';
import { useAuth } from '../../stores/auth';
import CardModal from './CardModal';

const navItems = [
  { to: '/', label: 'Tableau de bord', short: 'Bord', Icon: LayoutDashboard, end: true },
  { to: '/collection', label: 'Collection', short: 'Collec', Icon: Boxes, end: false },
  { to: '/add', label: 'Ajouter', short: 'Ajouter', Icon: PlusCircle, end: false },
  { to: '/sets', label: 'Extensions', short: 'Sets', Icon: Library, end: false },
  { to: '/wishlist', label: 'Wishlist', short: 'Wishlist', Icon: Star, end: false },
  { to: '/import', label: 'Import/Export', short: 'Import', Icon: Download, end: false },
];

export default function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Bannière + titre */}
      <header>
        <div
          className="h-24 sm:h-36 bg-cover bg-center relative"
          style={{ backgroundImage: 'url(/banner.png)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 to-transparent flex items-end">
            <h1 className="px-4 pb-3 font-display text-xl sm:text-3xl font-bold text-gold-300 drop-shadow-lg tracking-wide">
              Magic Collection Manager
            </h1>
          </div>
          {/* Déconnexion (mobile) */}
          <button
            type="button"
            onClick={logout}
            aria-label="Se déconnecter"
            className="sm:hidden absolute top-2 right-2 bg-slate-900/60 rounded-full w-8 h-8 text-rose-300"
          >⎋</button>
        </div>

        {/* Menu horizontal (desktop / tablette) */}
        <nav className="hidden sm:flex items-stretch bg-slate-800 border-b border-slate-700 px-1 overflow-x-auto">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'border-gold-500 text-gold-300'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
            >
              <it.Icon size={16} />
              <span>{it.label}</span>
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 pr-3 pl-4">
            <span className="text-xs text-slate-400 hidden md:inline truncate max-w-[12rem]">
              {user?.display_name || user?.email}
            </span>
            <button type="button" onClick={logout} className="text-rose-400 hover:text-rose-300 text-sm whitespace-nowrap">
              Déconnexion
            </button>
          </div>
        </nav>
      </header>

      {/* Contenu (padding bas en mobile pour la bottom bar) */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto p-4 pb-24 sm:pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar (mobile uniquement) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-800 border-t border-slate-700 flex">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-gold-300' : 'text-slate-400'}`}
          >
            <it.Icon size={18} />
            {it.short}
          </NavLink>
        ))}
      </nav>

      <CardModal />
    </div>
  );
}
