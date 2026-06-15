// Suivi en mémoire des jobs admin lancés à la demande (instance backend unique).
const jobs = {};

export function jobState() {
  return jobs;
}

/**
 * Lance `fn` en arrière-plan sous le nom `name`. Refuse si déjà en cours.
 * Retourne true si démarré, false si un run est déjà actif.
 */
export function startJob(name, fn) {
  if (jobs[name]?.running) return false;
  jobs[name] = { running: true, startedAt: new Date().toISOString(), finishedAt: null, ok: null, error: null, info: null };
  Promise.resolve()
    .then(fn)
    .then((info) => {
      jobs[name] = { ...jobs[name], running: false, finishedAt: new Date().toISOString(), ok: true, info: info ?? null };
    })
    .catch((e) => {
      jobs[name] = { ...jobs[name], running: false, finishedAt: new Date().toISOString(), ok: false, error: e.message };
    });
  return true;
}
