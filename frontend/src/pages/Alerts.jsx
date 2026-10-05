import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';

const DIR_LABEL = { below: 'sous', above: 'au-dessus de' };

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Alerts() {
  const openCard = useCardModal((s) => s.open);
  const [alerts, setAlerts] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, n] = await Promise.all([
        api('/alerts'),
        api('/alerts/notifications'),
      ]);
      setAlerts(a.alerts || []);
      setNotifs(n.notifications || []);
      // Ouvrir la page = prendre connaissance des notifications
      if ((n.unread || 0) > 0) api('/alerts/notifications/read', { method: 'POST' }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    await api(`/alerts/${id}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="text-center text-slate-500 py-12">Chargement…</div>;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold">Alertes de prix</h1>

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Notifications récentes</h2>
        {notifs.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune notification. Les alertes déclenchées apparaîtront ici.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {notifs.map((n) => (
              <li key={n.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className={`shrink-0 w-2 h-2 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-indigo-400'}`} />
                {n.scryfall_id ? (
                  <button type="button" onClick={() => openCard(n.scryfall_id)} className="flex-1 text-left hover:text-indigo-300">{n.message}</button>
                ) : (
                  <span className="flex-1">{n.message}</span>
                )}
                <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Alertes définies</h2>
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucune alerte. Ouvre une carte et clique sur « 🔔 Alerte prix » pour en créer une.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1.5 text-sm">
                {a.image_uri_small && <img loading="lazy" src={a.image_uri_small} alt="" className="w-7 rounded-sm" />}
                <button type="button" onClick={() => openCard(a.scryfall_id)} className="flex-1 min-w-0 text-left hover:text-indigo-300">
                  <span className="block truncate">{a.name} <span className="text-xs text-slate-500 uppercase">{a.set_code}</span></span>
                  <span className="block text-xs text-slate-400">
                    Prix {DIR_LABEL[a.direction]} {Number(a.threshold_eur).toFixed(2)} €
                    {a.current_eur != null && <span className="text-slate-500"> · actuel {Number(a.current_eur).toFixed(2)} €</span>}
                  </span>
                </button>
                {a.active ? (
                  <span className="text-xs text-emerald-400 whitespace-nowrap">active</span>
                ) : (
                  <span className="text-xs text-slate-500 whitespace-nowrap" title={a.triggered_at ? fmtDate(a.triggered_at) : ''}>déclenchée</span>
                )}
                <button type="button" onClick={() => remove(a.id)} aria-label="Supprimer" className="text-rose-400 hover:text-rose-300 px-1">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
