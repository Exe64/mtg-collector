import { useLayoutEffect, useRef } from 'react';

// <dialog> natif : piège et retour du focus, Échap et rôle fournis par le navigateur.
// Le contenu doit être monté uniquement quand la modale est ouverte.
export default function Modal({ onClose, label, className = '', children }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);

  // Clic sur le voile : la cible est le <dialog> lui-même, hors de sa boîte.
  // (Un « clic » clavier a des coordonnées nulles mais vise un enfant.)
  const onBackdrop = (e) => {
    if (e.target !== ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={onBackdrop}
      className={`bg-slate-800 text-slate-100 backdrop:bg-black/70 ${className}`}
    >
      {children}
    </dialog>
  );
}
