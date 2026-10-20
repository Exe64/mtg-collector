import { useEffect, useRef } from 'react';
import { WUBRG_DOTS } from './Wordmark';

const REPEL_RADIUS = 140; // px autour du pointeur
const REPEL_FORCE = 2.4;
const SPRING = 0.01; // rappel vers la trajectoire après une poussée
const DAMPING = 0.9;
const DRIFT = [0.045, 0.018]; // dérive d'ensemble (px / image) des étoiles les plus proches
const PARALLAX = 26; // décalage max (px) des plans proches selon la position du pointeur
const STAR_WHITE = '#f3efe6';

// Sprite de halo par couleur : un dégradé radial pré-rendu, bien moins coûteux que shadowBlur
function makeSprites() {
  const sprites = {};
  for (const color of [...WUBRG_DOTS, STAR_WHITE]) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.35, `${color}55`);
    grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites[color] = c;
  }
  return sprites;
}

// Étoiles réparties sur toute la page, chacune à une profondeur z (0 loin → 1 près) :
// taille, éclat, vitesse de dérive, parallaxe et sensibilité au pointeur en dépendent.
function makeStars(w, h) {
  const n = Math.round(Math.min(Math.max((w * h) / 2200, 220), 900));
  return Array.from({ length: n }, () => {
    const z = Math.random() ** 1.8; // beaucoup de lointaines, peu de proches
    return {
      fx: Math.random(), fy: Math.random(), // trajectoire, en fraction de la page
      z,
      wx: 0, wy: 0, // errance lissée
      x: null, y: null, vx: 0, vy: 0,
      size: 0.35 + z * z * 2.6, // rayon du cœur en px
      color: Math.random() < 0.72 ? WUBRG_DOTS[Math.floor(Math.random() * WUBRG_DOTS.length)] : STAR_WHITE,
      alpha: 0.25 + z * 0.75,
      phase: Math.random() * Math.PI * 2,
      pulse: 0.0005 + Math.random() * 0.0015,
    };
  });
}

export default function Starfield() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sprites = makeSprites();
    const pointer = { x: -1e4, y: -1e4, px: 0, py: 0 }; // px/py : parallaxe lissée (-1 → 1)
    let stars = [];
    let w = 0; let h = 0; let raf = 0; let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(w, h);
    };

    const frame = (now) => {
      const k = Math.min((now - last) / 16.67, 3); // pas normalisé à 60 i/s
      last = now;
      ctx.clearRect(0, 0, w, h);

      // La parallaxe suit le pointeur avec retard ; revient au centre s'il quitte la page
      const inside = pointer.x > -1e3;
      const tx = inside ? (pointer.x / w) * 2 - 1 : 0;
      const ty = inside ? (pointer.y / h) * 2 - 1 : 0;
      pointer.px += (tx - pointer.px) * 0.04 * k;
      pointer.py += (ty - pointer.py) * 0.04 * k;

      for (const s of stars) {
        if (!still) {
          s.fx = (s.fx + (DRIFT[0] * s.z * k) / w + 1) % 1;
          s.fy = (s.fy + (DRIFT[1] * s.z * k) / h + 1) % 1;
          s.wx = (s.wx + (Math.random() - 0.5) * 0.35 * k) * 0.985;
          s.wy = (s.wy + (Math.random() - 0.5) * 0.35 * k) * 0.985;
        }
        const hx = s.fx * w + s.wx - pointer.px * PARALLAX * s.z;
        const hy = s.fy * h + s.wy - pointer.py * PARALLAX * s.z;
        // Première image, ou étoile qui vient de reboucler d'un bord à l'autre : placement direct
        if (s.x === null || still || Math.abs(hx - s.x) > w / 2 || Math.abs(hy - s.y) > h / 2) {
          s.x = hx; s.y = hy; s.vx = 0; s.vy = 0;
        }

        if (!still) {
          s.vx += (hx - s.x) * SPRING * k;
          s.vy += (hy - s.y) * SPRING * k;
          const dx = s.x - pointer.x; const dy = s.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < REPEL_RADIUS && d > 0.01) {
            const f = (1 - d / REPEL_RADIUS) * REPEL_FORCE * (0.3 + s.z) * k; // les proches fuient plus
            s.vx += (dx / d) * f; s.vy += (dy / d) * f;
          }
          const damp = DAMPING ** k;
          s.vx *= damp; s.vy *= damp;
          s.x += s.vx * k; s.y += s.vy * k;
        }

        const twinkle = still ? 1 : 0.6 + 0.4 * Math.sin(now * s.pulse + s.phase);
        const r = s.size * 5; // halo autour du cœur
        ctx.globalAlpha = s.alpha * twinkle;
        ctx.drawImage(sprites[s.color], s.x - r, s.y - r, r * 2, r * 2);
      }
      if (!still) raf = requestAnimationFrame(frame);
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    };
    const onLeave = () => { pointer.x = -1e4; pointer.y = -1e4; };
    const onResize = () => { resize(); if (still) frame(performance.now()); };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 w-full h-full" />;
}
