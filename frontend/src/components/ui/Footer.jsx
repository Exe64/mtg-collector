import { AUTHOR_LINKS } from '../../constants';

const link = 'hover:text-gold-300 underline-offset-2 hover:underline';
const ext = { target: '_blank', rel: 'noopener noreferrer' };

// Pied de page commun : copyright, liens auteur, version, licence, mention non officielle
export default function Footer({ className = '' }) {
  return (
    <footer className={`text-center text-[11px] leading-relaxed text-slate-500 ${className}`}>
      <p>
        © {new Date().getFullYear()} Julien DUMUR
        {' · '}<a href={AUTHOR_LINKS.github} {...ext} className={link}>GitHub</a>
        {' · '}<a href={AUTHOR_LINKS.kofi} {...ext} className={link}>Offrez-moi un café ☕</a>
      </p>
      <p>
        <a href={`${AUTHOR_LINKS.repo}/releases`} {...ext} className={link}>MTG Collector v{__APP_VERSION__}</a>
        {' · '}<a href={`${AUTHOR_LINKS.repo}/blob/main/LICENSE`} {...ext} className={link}>Licence AGPL-3.0</a>
        {' · '}projet non officiel, sans lien avec Wizards of the Coast
      </p>
    </footer>
  );
}
