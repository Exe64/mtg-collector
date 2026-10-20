// Pastilles W U B R G, en teintes pastel (comme les gemmes de la référence)
export const WUBRG_DOTS = ['#fdfbce', '#bcdaf7', '#a7999e', '#f19b79', '#9fcba6'];

// Logotype « MTG Collector », filet–étoile–filet, devise. `size` : 'lg' (hero) ou 'sm' (connexion).
export default function Wordmark({ size = 'lg', as: Tag = 'h1' }) {
  const lg = size === 'lg';
  return (
    <div className="flex flex-col items-center">
      <Tag className={`font-display font-bold uppercase text-center whitespace-nowrap text-slate-50 leading-none tracking-[0.05em] drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] ${lg ? 'text-[2.375rem] sm:text-7xl' : 'text-[2.5rem]'}`}>
        MTG Collector
      </Tag>
      <div aria-hidden className={`flex items-center gap-2 ${lg ? 'mt-3 sm:mt-4 w-56 sm:w-80' : 'mt-2 w-48'}`}>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-50/80" />
        <svg viewBox="0 0 16 16" className={`fill-slate-50 ${lg ? 'w-3.5 h-3.5' : 'w-3 h-3'}`}><path d="M8 0 9.6 6.4 16 8 9.6 9.6 8 16 6.4 9.6 0 8 6.4 6.4Z" /></svg>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-50/80" />
      </div>
      <p className={`font-semibold uppercase text-slate-100 ${lg ? 'mt-2 text-xs sm:text-sm tracking-[0.35em]' : 'mt-1.5 text-[10px] tracking-[0.3em]'}`}>
        Collect with <span className="text-gold-400">passion</span>
      </p>
    </div>
  );
}
