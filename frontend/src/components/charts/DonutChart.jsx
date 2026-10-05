export default function DonutChart({ data, size = 168, thickness = 26 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden="true">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2c2f33" strokeWidth={thickness} />
        ) : (
          data.map((d, i) => {
            const seg = (d.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none" stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${seg} ${c - seg}`}
                strokeDashoffset={-offset}
              />
            );
            offset += seg;
            return el;
          })
        )}
      </svg>
      <ul className="text-xs space-y-1">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-slate-300">{d.label}</span>
            <span className="text-slate-500">
              {d.value}{total ? ` · ${Math.round((100 * d.value) / total)}%` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
