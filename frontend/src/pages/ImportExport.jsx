import { useState } from 'react';
import { api, apiDownload } from '../api/client';

export default function ImportExport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('merge');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  async function onFile(f) {
    setFile(f);
    setReport(null);
    setError(null);
    if (!f) { setPreview(null); return; }
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    setPreview({ header: lines[0], rows: lines.length - 1, sample: lines.slice(1, 4) });
  }

  async function doImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      if (location.trim()) fd.append('location', location.trim());
      const res = await api('/import/csv', { method: 'POST', body: fd });
      setReport(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(kind) {
    setError(null);
    try {
      await apiDownload(`/export/${kind}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Import / Export</h1>
      {error && <div className="text-sm text-rose-400 bg-rose-950/40 rounded p-2">{error}</div>}

      {/* IMPORT */}
      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Importer un CSV (Moxfield ou générique)</h2>

        <label className="block border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-slate-600"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
        >
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => onFile(e.target.files[0])} />
          <span className="text-sm text-slate-400">
            {file ? file.name : 'Glisse un fichier CSV ici, ou clique pour choisir'}
          </span>
        </label>

        {preview && (
          <div className="text-xs text-slate-400 bg-slate-900 rounded p-2 space-y-1">
            <div><span className="text-slate-500">Lignes :</span> {preview.rows}</div>
            <div className="truncate"><span className="text-slate-500">En-tête :</span> {preview.header}</div>
            {preview.sample.map((l, i) => <div key={i} className="truncate text-slate-500">{l}</div>)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            Fusionner (additionner les quantités)
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            Remplacer la collection
          </label>
        </div>

        <label className="block text-xs text-slate-400">
          Emplacement à appliquer à tout le lot (optionnel)
          <input
            type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="ex. Classeur Rares Bleues"
            className="block w-full max-w-sm mt-1 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm"
          />
        </label>

        <button type="button" onClick={doImport} disabled={!file || busy}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm">
          {busy ? 'Import en cours…' : 'Importer'}
        </button>

        {report && (
          <div className="text-sm bg-slate-900 rounded p-3 space-y-2">
            <div className="text-emerald-400">{report.imported} carte(s) importée(s)</div>
            {report.skipped > 0 && <div className="text-amber-400">{report.skipped} ligne(s) en erreur</div>}
            {report.errors?.length > 0 && (
              <ul className="text-xs text-slate-400 max-h-40 overflow-auto space-y-0.5">
                {report.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>Ligne {e.line}{e.name ? ` (${e.name})` : ''} : {e.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* EXPORT */}
      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Exporter</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => download('csv')}
            className="rounded-md bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm">
            CSV (Moxfield)
          </button>
          <button type="button" onClick={() => download('pdf')}
            className="rounded-md bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm">
            PDF
          </button>
        </div>
      </section>
    </div>
  );
}
