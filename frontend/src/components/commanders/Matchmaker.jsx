import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
import {
  COLORS, BUDGETS, POWERS, ORIGINS, EMPTY_ANSWERS, matchmake,
} from './logic';
import { CommanderTile } from './parts';

const COLOR_NAME = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' };
const field = 'rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm';
const chip = (on) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-gold-500/15 text-gold-200 ring-1 ring-inset ring-gold-500/40' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`;

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {COLORS.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c} type="button" aria-pressed={on} aria-label={COLOR_NAME[c]}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
            className={`w-11 h-11 rounded-full flex items-center justify-center ${on ? 'ring-2 ring-gold-400 bg-slate-700' : 'opacity-50 hover:opacity-90'}`}
          >
            <i className={`ms ms-${c.toLowerCase()} ms-cost ms-2x`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function Choices({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={chip(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Matchmaker({ catalog, owned, starred, onStar, onOpen }) {
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [step, setStep] = useState(0);
  const [themes, setThemes] = useState([]);
  const [themeSet, setThemeSet] = useState(null);

  useEffect(() => {
    api('/commanders/themes').then((r) => setThemes(r.themes.slice(0, 40))).catch(() => setThemes([]));
  }, []);

  useEffect(() => {
    setThemeSet(null);
    if (!answers.theme) return undefined;
    let cancelled = false;
    api(`/commanders/themes/${answers.theme}`)
      .then((r) => { if (!cancelled) setThemeSet(new Set(r.commanders.map((c) => c.oracle_id))); })
      .catch(() => { if (!cancelled) setThemeSet(new Set()); });
    return () => { cancelled = true; };
  }, [answers.theme]);

  const set = (patch) => setAnswers((a) => ({ ...a, ...patch }));
  const themeOptions = [...themes.map((t) => ({ value: t.slug, label: t.name })), { value: '', label: 'Peu importe' }];

  const questions = [
    { title: 'Quelles couleurs te tentent ?', hint: 'Aucune sélection : peu importe.', body: <ColorPicker value={answers.colors} onChange={(colors) => set({ colors })} /> },
    { title: 'Quel style de jeu ?', hint: 'Thèmes les plus joués sur EDHREC.', body: <Choices options={themeOptions} value={answers.theme} onChange={(theme) => set({ theme })} /> },
    { title: 'Quel budget pour le commandant ?', body: <Choices options={BUDGETS} value={answers.budget} onChange={(budget) => set({ budget })} /> },
    { title: 'Quel niveau de puissance ?', hint: 'Compétitif favorise les Game Changers ; détendu les écarte.', body: <Choices options={POWERS} value={answers.power} onChange={(power) => set({ power })} /> },
    { title: 'Un commandant que tu possèdes, ou une découverte ?', body: <Choices options={ORIGINS} value={answers.origin} onChange={(origin) => set({ origin })} /> },
  ];

  const waitingTheme = answers.theme && !themeSet;
  const results = useMemo(
    () => (step < questions.length || waitingTheme ? [] : matchmake(catalog, answers, { owned, theme: themeSet, now: Date.now() })),
    [step, questions.length, waitingTheme, catalog, answers, owned, themeSet],
  );

  if (step < questions.length) {
    const q = questions[step];
    return (
      <section className="max-w-2xl mx-auto bg-slate-800/50 border border-white/[0.06] rounded-xl p-5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-1">Question {step + 1} / {questions.length}</p>
        <h2 className="font-display text-2xl font-semibold text-slate-50 mb-1">{q.title}</h2>
        {q.hint && <p className="text-sm text-slate-400 mb-3">{q.hint}</p>}
        <div className="my-4">{q.body}</div>
        <div className="flex justify-between gap-2">
          <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="rounded-md bg-slate-700 px-4 py-2 text-sm disabled:opacity-40">Précédent</button>
          <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 px-4 py-2 text-sm">
            {step === questions.length - 1 ? 'Voir mes commandants' : 'Suivant'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-3 mb-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <fieldset>
            <legend className="text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-1">Couleurs</legend>
            <ColorPicker value={answers.colors} onChange={(colors) => set({ colors })} />
          </fieldset>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Thème
            <select value={answers.theme} onChange={(e) => set({ theme: e.target.value })} className={`${field} block mt-1 normal-case tracking-normal max-w-[14rem]`}>
              {themeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Budget
            <select value={answers.budget} onChange={(e) => set({ budget: Number(e.target.value) })} className={`${field} block mt-1 normal-case tracking-normal`}>
              {BUDGETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Puissance
            <select value={answers.power} onChange={(e) => set({ power: e.target.value })} className={`${field} block mt-1 normal-case tracking-normal`}>
              {POWERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Origine
            <select value={answers.origin} onChange={(e) => set({ origin: e.target.value })} className={`${field} block mt-1 normal-case tracking-normal`}>
              {ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setAnswers(EMPTY_ANSWERS); setStep(0); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 pb-2">
            <RotateCcw size={14} /> Recommencer le quiz
          </button>
        </div>
      </section>

      {waitingTheme ? (
        <div className="text-center text-slate-500 py-12">Chargement du thème…</div>
      ) : !results.length ? (
        <div className="text-center text-slate-400 py-12">Aucun commandant ne répond à toutes ces réponses. Élargis le budget, les couleurs ou l'origine.</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {results.map(({ commander: c, score, reasons }) => (
            <CommanderTile
              key={c.oracle_id} c={c} owned={owned.has(c.oracle_id)} starred={starred.has(c.oracle_id)} onStar={onStar} onOpen={onOpen}
              extra={(
                <span className="block mt-2 text-xs">
                  <span className="text-gold-300 font-semibold">Score {score}</span>
                  {reasons.length > 0 && <span className="block text-slate-400">{reasons.join(' · ')}</span>}
                </span>
              )}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
