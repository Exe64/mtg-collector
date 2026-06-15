import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Boxes, PlusCircle, Library, Star, Download, Users,
  ListChecks, History, Bell, TrendingUp, Wrench, ChevronDown, Menu,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../stores/auth';
import CardModal from './CardModal';
import ScrollToTop from './ScrollToTop';

// 1er niveau (toujours visible : barre desktop + bottom bar mobile)
const primaryNav = [
  { to: '/', label: 'Tableau de bord', short: 'Bord', Icon: LayoutDashboard, end: true },
  { to: '/collection', label: 'Collection', short: 'Collec', Icon: Boxes, end: false },
  { to: '/add', label: 'Ajouter', short: 'Ajouter', Icon: PlusCircle, end: false },
  { to: '/sets', label: 'Extensions', short: 'Sets', Icon: Library, end: false },
];
// 2e niveau (desktop : « Outils ▾ » ; mobile : feuille « Plus »)
const toolsNav = [
  { to: '/movements', label: 'Mouvements', Icon: TrendingUp },
  { to: '/wishlist', label: 'Wishlist', Icon: Star },
  { to: '/deck', label: 'Vérif deck', Icon: ListChecks },
  { to: '/journal', label: 'Journal', Icon: History },
  { to: '/alerts', label: 'Alertes', Icon: Bell },
  { to: '/import', label: 'Import/Export', Icon: Download },
];
const adminNav = { to: '/accounts', label: 'Administration', Icon: Users };

export default function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);

  const tools = user?.is_admin ? [...toolsNav, adminNav] : toolsNav;
  const inTools = tools.some((t) => t.to === location.pathname);

  useEffect(() => {
    api('/alerts/notifications').then((d) => setUnread(d.unread || 0)).catch(() => {});
  }, []);

  // Ferme les menus à chaque navigation + sur Échap
  useEffect(() => { setToolsOpen(false); setPlusOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setToolsOpen(false); setPlusOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const Badge = () => (unread > 0 ? (
    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] leading-none rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">{unread}</span>
  ) : null);

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
              MTG Collection Manager
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
        <nav className="hidden sm:flex items-stretch bg-slate-800 border-b border-slate-700 px-1">
          {primaryNav.map((it) => (
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

          {/* Outils ▾ */}
          <div className="relative flex items-stretch">
            <button
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              aria-expanded={toolsOpen}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm whitespace-nowrap border-b-2 ${
                inTools ? 'border-gold-500 text-gold-300' : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span className="relative"><Wrench size={16} /><Badge /></span>
              <span>Outils</span>
              <ChevronDown size={14} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {toolsOpen && (
              <>
                <button type="button" aria-hidden className="fixed inset-0 z-30 cursor-default" onClick={() => setToolsOpen(false)} />
                <div className="absolute top-full left-0 z-40 w-52 bg-slate-800 border border-slate-700 rounded-b-md shadow-xl py-1">
                  {tools.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      onClick={() => setToolsOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 text-sm ${isActive ? 'text-gold-300 bg-slate-700/50' : 'text-slate-300 hover:bg-slate-700/50'}`}
                    >
                      <span className="relative"><it.Icon size={16} />{it.to === '/alerts' && <Badge />}</span>
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>

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

      {/* Bottom tab bar (mobile uniquement) : 4 onglets + Plus */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-800 border-t border-slate-700 flex">
        {primaryNav.map((it) => (
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
        <button
          type="button"
          onClick={() => setPlusOpen(true)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] ${inTools ? 'text-gold-300' : 'text-slate-400'}`}
        >
          <span className="relative"><Menu size={18} /><Badge /></span>
          Plus
        </button>
      </nav>

      {/* Feuille « Plus » (mobile) */}
      {plusOpen && (
        <div className="sm:hidden fixed inset-0 z-40">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/50" onClick={() => setPlusOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 rounded-t-2xl p-3 pb-6">
            <div className="w-10 h-1 rounded-full bg-slate-600 mx-auto mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {tools.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={() => setPlusOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-lg py-3 text-[11px] text-center ${isActive ? 'bg-slate-700 text-gold-300' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                  <span className="relative"><it.Icon size={20} />{it.to === '/alerts' && <Badge />}</span>
                  {it.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <CardModal />
      <ScrollToTop />
    </div>
  );
}
