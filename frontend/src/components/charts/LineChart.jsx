export default function LineChart({ points }) {
  if (!points || points.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-10 text-center">
        Pas encore d'historique. Les snapshots sont générés quotidiennement (3h UTC).
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

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
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
      </svg>
      <div className="text-center text-sm text-slate-400 mt-1">
        Dernière valeur : <span className="text-emerald-400 font-semibold">{last.toFixed(2)} €</span>
      </div>
    </div>
  );
}
