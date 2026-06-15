import { Component } from 'react';

// Empêche l'écran blanc : si un composant enfant plante au rendu, on affiche un
// fallback au lieu de casser toute l'app. (Les error boundaries doivent être des classes.)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary a capturé une erreur :', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-lg mx-auto text-center py-16">
          <h1 className="font-display text-xl font-bold mb-2">Une erreur est survenue</h1>
          <p className="text-sm text-slate-400 mb-4">
            Cette page a rencontré un problème. Tu peux la recharger ou revenir au tableau de bord.
          </p>
          <div className="flex gap-2 justify-center">
            <button type="button" onClick={() => window.location.reload()}
              className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm">Recharger</button>
            <button type="button" onClick={() => window.location.assign('/')}
              className="rounded-md bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm">Tableau de bord</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
