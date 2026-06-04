import { useState } from 'react';
import CardSearch from '../components/search/CardSearch';

export default function Add() {
  const [count, setCount] = useState(0);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Ajouter des cartes</h1>
      <p className="text-sm text-slate-400 mb-4">
        Recherche une carte, choisis la version (édition), la finition et l'état, puis ajoute-la à ta collection.
      </p>

      <CardSearch onAdded={() => setCount((c) => c + 1)} />

      {count > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {count} ajout{count > 1 ? 's' : ''} durant cette session.
        </p>
      )}
    </div>
  );
}
