import { useState, useEffect, Suspense } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Boxes, PlusCircle, Library, Star, Download, Users,
  ListChecks, History, Bell, TrendingUp, ChevronDown, Menu, ShieldCheck, LogOut,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../stores/auth';
import CardModal from './CardModal';
import Modal from './Modal';
import ScrollToTop from './ScrollToTop';
import ErrorBoundary from './ErrorBoundary';

// 1er niveau (toujours visible : barre desktop + bottom bar mobile)
const primaryNav = [
  { to: '/', label: 'Tableau de bord', short: 'Bord', Icon: LayoutDashboard, end: true },
  { to: '/collection', label: 'Collection', short: 'Collec', Icon: Boxes, end: false },
  { to: '/add', label: 'Ajouter', short: 'Ajouter', Icon: PlusCircle, end: false },
  { to: '/sets', label: 'Extensions', short: 'Sets', Icon: Library, end: false },
  { to: '/movements', label: 'Mouvements', short: 'Prix', Icon: TrendingUp, end: false },
  { to: '/wishlist', label: 'Wishlist', short: 'Wishlist', Icon: Star, end: false },
  { to: '/deck', label: 'Vérif deck', short: 'Deck', Icon: ListChecks, end: false },
];
// Barre desktop : groupes séparés par un filet (inventaire | valeur et complétion)
const navGroups = [primaryNav.slice(0, 3), primaryNav.slice(3)];

const tabClass = (active) =>
  `relative flex items-center px-2 lg:px-3 text-sm whitespace-nowrap after:absolute after:inset-x-2 lg:after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full ${
    active ? 'text-slate-50 after:bg-gold-400' : 'text-slate-400 hover:text-slate-100 after:bg-transparent'
  }`;

// 2e niveau (desktop : « Outils ▾ » ; mobile : feuille « Plus »)
const toolsNav = [
  { to: '/journal', label: 'Journal', Icon: History },
  { to: '/alerts', label: 'Alertes', Icon: Bell },
  { to: '/import', label: 'Import/Export', Icon: Download },
  { to: '/security', label: 'Sécurité', Icon: ShieldCheck },
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
    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-slate-900 text-[9px] leading-none rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">{unread}</span>
  ) : null);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col overflow-x-clip">
      {/* Barre fine en verre : logotype, liens groupés, utilisateur */}
      <header className="glass sticky top-0 z-30 border-b border-white/[0.06]">
        <div className="flex items-stretch h-12 sm:h-14 px-4">
          <NavLink to="/" end className="flex items-center gap-2 pr-4 sm:pr-5 sm:mr-1 sm:border-r border-white/10 font-display text-xl sm:text-[1.375rem] font-semibold tracking-[0.04em] text-slate-50 whitespace-nowrap">
            <span className="text-gold-300">MTG</span>
            <span className="sm:hidden xl:inline">Collector</span>
          </NavLink>

          {/* Menu horizontal (desktop / tablette) */}
          <nav aria-label="Navigation principale" className="hidden sm:flex items-stretch min-w-0">
            {navGroups.map((group, gi) => (
              <div key={gi} className={`flex items-stretch pr-1 ${gi ? 'relative pl-1 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-px before:bg-white/10' : ''}`}>
                {group.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => tabClass(isActive)}>
                    <span className="lg:hidden">{it.short}</span>
                    <span className="hidden lg:inline">{it.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}

            {/* Outils ▾ */}
            <div className="flex items-stretch relative pl-1 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-px before:bg-white/10">
              <button
                type="button"
                onClick={() => setToolsOpen((o) => !o)}
                aria-expanded={toolsOpen}
                className={`${tabClass(inTools)} gap-1`}
              >
                Outils
                {unread > 0 && <span className="ml-1 rounded-full bg-rose-500 text-slate-900 text-[10px] font-semibold leading-4 min-w-4 px-1 text-center">{unread}</span>}
                <ChevronDown size={14} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>
              {toolsOpen && (
                <>
                  <button type="button" aria-hidden className="fixed inset-0 z-30 cursor-default" onClick={() => setToolsOpen(false)} />
                  <div className="glass bg-slate-900/90 absolute top-full left-1 z-40 w-56 border border-white/10 rounded-lg shadow-2xl shadow-black/50 p-1">
                    {tools.map((it) => (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        onClick={() => setToolsOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${isActive ? 'text-gold-300 bg-gold-500/10' : 'text-slate-300 hover:text-slate-50 hover:bg-white/5'}`}
                      >
                        <span className="relative"><it.Icon size={16} />{it.to === '/alerts' && <Badge />}</span>
                        {it.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-3 pl-4">
            <span className="text-xs text-slate-400 hidden 2xl:inline truncate max-w-[12rem]">
              {user?.display_name || user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Se déconnecter"
              className="flex items-center gap-1.5 rounded-md border border-white/10 h-9 px-2.5 sm:px-3 text-sm text-slate-300 hover:text-rose-300 hover:border-rose-400/40 whitespace-nowrap"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu (padding bas en mobile pour la bottom bar) */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 pt-6 sm:px-6 sm:pt-8 pb-24 sm:pb-10">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<div className="text-center text-slate-500 py-12">Chargement…</div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Bottom tab bar (mobile uniquement) : 4 onglets + Plus */}
      <nav aria-label="Navigation principale" className="glass sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.06] flex pb-[env(safe-area-inset-bottom)]">
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
          aria-haspopup="dialog"
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] ${inTools ? 'text-gold-300' : 'text-slate-400'}`}
        >
          <span className="relative"><Menu size={18} /><Badge /></span>
          Plus
        </button>
      </nav>

      {/* Feuille « Plus » (mobile) */}
      {plusOpen && (
        <Modal
          onClose={() => setPlusOpen(false)}
          label="Plus d'outils"
          className="mt-auto mb-0 mx-0 w-full max-w-full border-t border-white/10 rounded-t-2xl p-3 pb-6"
        >
            <div className="w-10 h-1 rounded-full bg-slate-600 mx-auto mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {tools.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={() => setPlusOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-lg py-3 text-[11px] text-center ${isActive ? 'bg-gold-500/10 text-gold-300 ring-1 ring-inset ring-gold-500/30' : 'text-slate-300 hover:bg-white/5'}`}
                >
                  <span className="relative"><it.Icon size={20} />{it.to === '/alerts' && <Badge />}</span>
                  {it.label}
                </NavLink>
              ))}
            </div>
        </Modal>
      )}

      <CardModal />
      <ScrollToTop />
    </div>
  );
}
