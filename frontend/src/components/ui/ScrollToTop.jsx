import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Bouton flottant « remonter en haut » (coin bas-droite), visible après défilement.
export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Remonter en haut"
      className="fixed right-4 bottom-20 sm:bottom-6 z-40 w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-slate-900 shadow-lg flex items-center justify-center"
    >
      <ArrowUp size={20} />
    </button>
  );
}
