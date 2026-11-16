import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

const fmtDate = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

const STEPS = {
  preflight: 'Préparation',
  stop: 'Arrêt du service',
  backup: 'Sauvegarde de la base',
  checkout: 'Récupération de la version',
  build: 'Construction et redémarrage',
  verify: 'Vérification',
  rollback: 'Retour à la version précédente',
  done: 'Terminé',
};

// GitHub release notes, minimal markdown: headings, bullets, bold markers, links.
// Everything goes through React text nodes (escaped); only http(s) URLs become links.
function inline(text) {
  return text.replace(/\*\*/g, '').split(/(https?:\/\/[^\s)]*[^\s).,;:!?])/g).map((part, i) => (i % 2
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-gold-300 hover:underline break-all">{part.replace(/^https:\/\/github\.com\//, '')}</a>
    : part));
}

// After an update the old service worker still serves the old build: let the new one
// take over (autoUpdate = skipWaiting + clientsClaim) before reloading.
async function reloadToNewBuild() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      const changed = new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
      await reg.update();
      if (reg.installing || reg.waiting) await changed;
    }
  } catch { /* reload anyway */ }
  window.location.reload();
}

const PENDING_HINT_MS = 2 * 60 * 1000;
export function ReleaseNotes({ text }) {
  const blocks = [];
  let items = [];
  const flush = (key) => {
    if (items.length) blocks.push(<ul key={`ul${key}`} className="list-disc pl-5 space-y-0.5">{items}</ul>);
    items = [];
  };
  (text || '').split(/\r?\n/).forEach((line, i) => {
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) { items.push(<li key={i}>{inline(li[1])}</li>); return; }
    flush(i);
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) blocks.push(<p key={i} className="font-semibold text-slate-200 pt-1">{inline(h[1])}</p>);
    else if (line.trim()) blocks.push(<p key={i}>{inline(line)}</p>);
  });
  flush('end');
  return blocks.length ? <div className="space-y-1.5 text-xs text-slate-300">{blocks}</div>
    : <p className="text-xs text-slate-500">Aucune note de version.</p>;
}

function RunResult({ status }) {
  if (!status || status.state === 'running') return null;
  const tone = { succeeded: 'text-emerald-400', rolled_back: 'text-gold-300', failed: 'text-rose-400' }[status.state] || 'text-slate-400';
  const icon = { succeeded: '✓', rolled_back: '↺', failed: '✗' }[status.state] || '•';
  return (
    <p className={`text-xs ${tone}`}>
      {icon} Dernière mise à jour ({fmtDate(status.finishedAt)}) : {status.message}
    </p>
  );
}

export default function UpdateCard() {
  const [info, setInfo] = useState(null);         // GET /admin/updates
  const [agent, setAgent] = useState(null);       // GET /admin/updates/progress
  const [unreachable, setUnreachable] = useState(false);
  const [watching, setWatching] = useState(null);  // requestedAt (server time) of the request sent from this page
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadInfo = useCallback(async (force = false) => {
    const r = force ? await api('/admin/updates/check', { method: 'POST' }) : await api('/admin/updates');
    setInfo(r);
    return r;
  }, []);
  const tryLoadInfo = useCallback(() => loadInfo().catch(() => setUnreachable(true)), [loadInfo]);

  const loadAgent = useCallback(async () => {
    try {
      const a = await api('/admin/updates/progress');
      setAgent(a);
      setUnreachable(false);
      return a;
    } catch {
      setUnreachable(true); // backend stopped/restarting during the update
      return null;
    }
  }, []);

  useEffect(() => { tryLoadInfo(); loadAgent(); }, [tryLoadInfo, loadAgent]);

  const inProgress = Boolean(agent?.pending || agent?.running);

  // Poll while a request is pending/running, while our request isn't finished, or while the
  // backend is unreachable (stopped by the agent mid-update, e.g. page opened during a run).
  useEffect(() => {
    if (!inProgress && !watching && !unreachable) return undefined;
    const t = setInterval(async () => {
      const a = await loadAgent();
      if (!a || a.pending || a.running) return;
      // Run over (or nothing running): refresh versions; our watch ends with a run newer than our request.
      const r = await loadInfo().catch(() => null);
      if (r && (!watching || (a.status?.finishedAt && a.status.finishedAt > watching))) setWatching(null);
    }, 3000);
    return () => clearInterval(t);
  }, [inProgress, watching, unreachable, loadAgent, loadInfo]);

  async function check() {
    setBusy(true); setMsg(null);
    try {
      const r = await loadInfo(true);
      if (!r.error && !r.updateAvailable) setMsg('Aucune nouvelle version.');
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function apply() {
    const to = info.latest.version;
    if (!window.confirm(
      `Mettre à jour vers v${to} ?\n\n`
      + "• Une sauvegarde de la base est faite d'abord.\n"
      + "• L'application est indisponible 1 à 3 minutes.\n"
      + '• En cas d\'échec, la version et les données actuelles sont restaurées automatiquement.',
    )) return;
    setBusy(true); setMsg(null);
    try {
      const { requestedAt } = await api('/admin/updates/apply', { method: 'POST' });
      setWatching(requestedAt); // server clock: compared with the agent's finishedAt
      await loadAgent();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  const progressText = (inProgress || (watching && unreachable) || (!info && unreachable))
    ? `Mise à jour en cours — ${unreachable ? "le service redémarre, la page se reconnectera d'elle-même…"
      : agent?.running ? `${STEPS[agent.status.step] || agent.status.step}…`
      : "demande transmise, en attente de l'agent…"}`
    : '';
  const agentSilent = agent?.pending && Date.now() - Date.parse(agent.pending.requestedAt) > PENDING_HINT_MS;
  // Always mounted: screen readers announce changes, not regions inserted already filled.
  const live = <p role="status" className="sr-only">{progressText}</p>;

  if (!info) {
    if (!unreachable) return live;
    return (
      <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Version</h2>
        <p className="text-sm text-gold-200" aria-hidden>⏳ Service indisponible (mise à jour en cours ?) — nouvel essai automatique…</p>
        {live}
      </section>
    );
  }
  const { current, latest, updateAvailable, checkedAt } = info;
  // The last run installed the version the backend now runs, but this page is an older build.
  const finishedNewer = !inProgress && agent?.status?.state === 'succeeded'
    && agent.status.to === current && current !== __APP_VERSION__;

  return (
    <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">Version</h2>
        <button type="button" onClick={check} disabled={busy || inProgress}
          className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-1.5 text-xs">
          Vérifier
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-400">Version installée</span><span className="font-mono">v{current}</span></div>
        <div className="flex justify-between">
          <span className="text-slate-400">Dernière version</span>
          <span className="font-mono">{latest ? <a href={latest.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{latest.tag}</a> : '—'}</span>
        </div>
        <div className="flex justify-between sm:col-span-2 text-xs"><span className="text-slate-500">Dernière vérification</span><span className="text-slate-500">{fmtDate(checkedAt)}</span></div>
      </div>

      {info.error && <p className="text-xs text-rose-400">Vérification impossible : {info.error}</p>}
      {msg && <p className="text-xs text-slate-400">{msg}</p>}

      {live}
      {progressText && (
        <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 p-3 text-sm text-gold-200 space-y-1" aria-hidden>
          <p>⏳ {progressText}</p>
          {agentSilent && (
            <p className="text-xs text-slate-400">
              L&apos;agent n&apos;a pas pris la demande en charge : vérifier sur le serveur <code>systemctl status mtg-updater.path</code>.
            </p>
          )}
        </div>
      )}

      {!inProgress && !watching && <RunResult status={agent?.status} />}

      {finishedNewer && !watching && (
        <p className="text-xs text-emerald-400">
          Nouvelle version installée.{' '}
          <button type="button" onClick={reloadToNewBuild} className="underline">Recharger la page</button>
        </p>
      )}

      {updateAvailable && !inProgress && !watching && (
        <div className="space-y-3 border-t border-slate-800 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gold-200">
              Nouvelle version disponible : <span className="font-mono">{latest.tag}</span>
              <span className="text-xs text-slate-500"> · publiée le {fmtDate(latest.publishedAt)}</span>
            </p>
            <button type="button" onClick={apply} disabled={busy || agent?.available === false} className="btn-outline disabled:opacity-50">
              Mettre à jour vers {latest.tag}
            </button>
          </div>
          {agent?.available === false && (
            <p className="text-xs text-slate-500">
              Agent de mise à jour non installé sur le serveur : mise à jour manuelle ou installation de l&apos;agent (voir doc/updating.md).
            </p>
          )}
          <details className="rounded-lg bg-slate-900/50 p-3" open>
            <summary className="text-xs text-slate-400 cursor-pointer">Notes de version</summary>
            <div className="mt-2"><ReleaseNotes text={latest.notes} /></div>
          </details>
        </div>
      )}

      {agent?.log?.length > 0 && !watching && (
        <details className="rounded-lg bg-slate-900/50 p-3">
          <summary className="text-xs text-slate-400 cursor-pointer">Journal de la dernière mise à jour</summary>
          <pre className="mt-2 text-[11px] leading-snug text-slate-400 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">{agent.log.join('\n')}</pre>
        </details>
      )}
    </section>
  );
}
