import { useState } from 'react';
import { api } from '../api/client';

export default function DeckCheck() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [onlyMissing, setOnlyMissing] = useState(true);

  async function check() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const body = url.trim() ? { url: url.trim() } : { text };
      setResult(await api('/decks/check', { method: 'POST', body }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result)); setUrl(''); };
    reader.readAsText(f);
  }

  const canCheck = Boolean(url.trim() || text.trim());
  const rows = result
    ? (onlyMissing ? result.cards.filter((c) => c.missing > 0 && !c.basic) : result.cards)
    : [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-display text-xl font-bold mb-1">Vérifier un deck</h1>
      <p className="text-sm text-slate-400 mb-4">
        Colle une liste (format Moxfield / MTGO), importe un <code className="text-slate-300">.txt</code>, ou indique l'URL d'un deck
        Moxfield public. La comparaison se fait <span className="text-slate-200">sur le nom de la carte</span>, toutes versions confondues.
      </p>

      <div className="space-y-3 mb-4">
        <input
          value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.moxfield.com/decks/…"
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
        />
        <div className="text-center text-xs text-slate-500">— ou —</div>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={8}
          placeholder={'4 Lightning Bolt\n2 Counterspell\n1 Sol Ring\n…'}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-mono"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-slate-400">
            Importer un .txt
            <input type="file" accept=".txt,text/plain" onChange={onFile} className="block mt-1 text-xs" />
          </label>
          <button
            type="button" onClick={check} disabled={!canCheck || loading}
            className="ml-auto rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm"
          >
            {loading ? 'Vérification…' : 'Vérifier'}
          </button>
        </div>
        {url.trim() && text.trim() && (
          <div className="text-xs text-gold-400">L'URL sera utilisée (la liste collée est ignorée).</div>
        )}
      </div>

      {error && <div className="text-sm text-rose-400 mb-3">{error}</div>}

      {result && (
        <>
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 mb-3 text-sm">
            {result.summary.missingDistinct === 0 ? (
              <span className="text-emerald-400 font-semibold">
                ✓ Deck complet — tu possèdes toutes les cartes ({result.summary.distinct} différentes).
              </span>
            ) : (
              <span>
                <span className="text-rose-400 font-semibold">{result.summary.missingDistinct} carte(s) manquante(s)</span>
                {' '}({result.summary.missingTotal} exemplaire(s)) sur {result.summary.distinct} différentes.
              </span>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Afficher seulement les manquantes
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Carte</th>
                  <th className="text-right p-2">Besoin</th>
                  <th className="text-right p-2">Possédé</th>
                  <th className="text-right p-2">Manque</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const lacking = c.missing > 0 && !c.basic;
                  return (
                    <tr key={c.name} className={`border-t border-slate-800 ${lacking ? 'bg-rose-500/5' : ''}`}>
                      <td className="p-2">
                        <div>
                          {c.name}
                          {c.basic && <span className="ml-1 text-[10px] text-slate-500">(terrain de base)</span>}
                        </div>
                        {c.versions?.length > 0 && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {c.versions.map((v, i) => (
                              <span key={`${v.set_code}-${v.collector_number}-${v.finish}-${i}`} className="mr-2 whitespace-nowrap">
                                {(v.set_code || '').toUpperCase()} #{v.collector_number}
                                {v.finish !== 'nonfoil' && <span className="text-gold-400"> ✦</span>}
                                {' '}×{v.qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-right text-slate-400">{c.needed}</td>
                      <td className="p-2 text-right text-slate-300">{c.owned}</td>
                      <td className={`p-2 text-right font-semibold ${lacking ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {lacking ? c.missing : '✓'}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-500">
                    {onlyMissing ? 'Aucune carte manquante 🎉' : 'Aucune carte.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
