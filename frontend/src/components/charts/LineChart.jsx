import { useRef, useState } from 'react';

// Spline Catmull-Rom → segments de Bézier cubiques, pour une courbe lissée.
function buildCurve(pts, t = 0.18) {
  if (pts.length < 2) return '';
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export default function LineChart({ points }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!points || points.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-10 text-center">
        Pas encore d'historique. Les snapshots sont générés quotidiennement.
      </div>
    );
  }

  const width = 600;
  const height = 110;
  const pad = 18;
  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const n = points.length;

  const x = (i) => pad + (n === 1 ? (width - 2 * pad) / 2 : (i / (n - 1)) * (width - 2 * pad));
  const y = (v) => pad + (1 - (v - min) / range) * (height - 2 * pad);

  const coords = points.map((p, i) => [x(i), y(values[i])]);
  const curve = buildCurve(coords);
  const linePath = `M ${coords[0][0].toFixed(2)},${coords[0][1].toFixed(2)}${curve}`;
  const areaPath = `M ${coords[0][0].toFixed(2)},${height - pad} L ${coords[0][0].toFixed(2)},${coords[0][1].toFixed(2)}${curve} L ${coords[n - 1][0].toFixed(2)},${height - pad} Z`;
  const fmtDate = (d) => String(d).slice(0, 10);
  const last = values[n - 1];

  function handleMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const vbX = ((clientX - rect.left) / rect.width) * width;
    let idx = n === 1 ? 0 : Math.round(((vbX - pad) / (width - 2 * pad)) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  }

  // Position de la bulle d'info
  let box = null;
  if (hover != null) {
    const px = x(hover);
    const py = y(values[hover]);
    const bw = 96;
    const bh = 40;
    const bx = Math.max(2, Math.min(width - bw - 2, px - bw / 2));
    const by = py - bh - 8 < 2 ? py + 8 : py - bh - 8;
    box = { px, py, bx, by, bw, bh };
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={handleMove}
        onTouchMove={handleMove}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00b4ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00b4ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#00b4ff" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(values[i])} r="1.8" fill="#00b4ff" />
        ))}
        <text x={pad} y={11} fill="#64748b" fontSize="8">{max.toFixed(0)} €</text>
        <text x={pad} y={height - 5} fill="#64748b" fontSize="8">{fmtDate(points[0].date)}</text>
        <text x={width - pad} y={height - 5} fill="#64748b" fontSize="8" textAnchor="end">
          {fmtDate(points[n - 1].date)}
        </text>

        {box && (
          <g pointerEvents="none">
            <line x1={box.px} y1={pad} x2={box.px} y2={height - pad} stroke="#475569" strokeWidth="0.75" strokeDasharray="3 3" />
            <circle cx={box.px} cy={box.py} r="3" fill="#00b4ff" stroke="#0f172a" strokeWidth="1" />
            <rect x={box.bx} y={box.by} width={box.bw} height={box.bh} rx="3" fill="#0f172a" stroke="#334155" strokeWidth="0.75" />
            <text x={box.bx + 6} y={box.by + 11} fill="#94a3b8" fontSize="7.5">{fmtDate(points[hover].date)}</text>
            <text x={box.bx + 6} y={box.by + 22} fill="#34d399" fontSize="9" fontWeight="bold">
              {values[hover].toFixed(2)} €
            </text>
            {hover > 0 && (() => {
              const prev = values[hover - 1];
              const pct = prev ? ((values[hover] - prev) / prev) * 100 : 0;
              const up = pct >= 0;
              return (
                <text x={box.bx + 6} y={box.by + 33} fill={up ? '#34d399' : '#f87171'} fontSize="7.5">
                  {up ? '▲' : '▼'} {up ? '+' : ''}{pct.toFixed(1)}% vs préc.
                </text>
              );
            })()}
          </g>
        )}
      </svg>
      <div className="text-center text-xs text-slate-400 mt-1">
        Dernière valeur : <span className="text-emerald-400 font-semibold">{last.toFixed(2)} €</span>
      </div>
    </div>
  );
}
