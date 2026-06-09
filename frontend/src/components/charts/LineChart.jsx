import { useRef, useState } from 'react';

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
  const height = 180;
  const pad = 28;
  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const n = points.length;

  const x = (i) => pad + (n === 1 ? (width - 2 * pad) / 2 : (i / (n - 1)) * (width - 2 * pad));
  const y = (v) => pad + (1 - (v - min) / range) * (height - 2 * pad);

  const line = points.map((p, i) => `${x(i)},${y(values[i])}`).join(' ');
  const area = `${x(0)},${height - pad} ${line} ${x(n - 1)},${height - pad}`;
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
    const bw = 104;
    const bh = 36;
    const bx = Math.max(2, Math.min(width - bw - 2, px - bw / 2));
    const by = py - bh - 10 < 2 ? py + 10 : py - bh - 10;
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
        <polygon points={area} fill="url(#areaGrad)" />
        <polyline points={line} fill="none" stroke="#00b4ff" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(values[i])} r="2.5" fill="#00b4ff" />
        ))}
        <text x={pad} y={16} fill="#64748b" fontSize="11">{max.toFixed(0)} €</text>
        <text x={pad} y={height - 8} fill="#64748b" fontSize="11">{fmtDate(points[0].date)}</text>
        <text x={width - pad} y={height - 8} fill="#64748b" fontSize="11" textAnchor="end">
          {fmtDate(points[n - 1].date)}
        </text>

        {box && (
          <g pointerEvents="none">
            <line x1={box.px} y1={pad} x2={box.px} y2={height - pad} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={box.px} cy={box.py} r="4" fill="#00b4ff" stroke="#0f172a" strokeWidth="1.5" />
            <rect x={box.bx} y={box.by} width={box.bw} height={box.bh} rx="4" fill="#0f172a" stroke="#334155" />
            <text x={box.bx + 8} y={box.by + 15} fill="#94a3b8" fontSize="10">{fmtDate(points[hover].date)}</text>
            <text x={box.bx + 8} y={box.by + 29} fill="#34d399" fontSize="12" fontWeight="bold">
              {values[hover].toFixed(2)} €
            </text>
          </g>
        )}
      </svg>
      <div className="text-center text-sm text-slate-400 mt-1">
        Dernière valeur : <span className="text-emerald-400 font-semibold">{last.toFixed(2)} €</span>
      </div>
    </div>
  );
}
