import { useState } from 'react';

/** Card image that follows the pointer while hovering `children` (mouse only, no touch). */
export default function HoverCard({ image, children, className = '' }) {
  const [pos, setPos] = useState(null);
  const move = (e) => {
    if (e.pointerType !== 'mouse' || !image) return;
    setPos({ x: e.clientX, y: e.clientY });
  };
  const W = 244;
  const H = 340;
  return (
    <div className={className} onPointerMove={move} onPointerLeave={() => setPos(null)}>
      {children}
      {pos && (
        <img
          src={image} alt="" aria-hidden="true" width={W} height={H}
          className="fixed z-50 pointer-events-none rounded-[12px] shadow-2xl shadow-black/60"
          style={{
            left: pos.x + 24 + W > window.innerWidth ? pos.x - W - 24 : pos.x + 24,
            top: Math.max(8, Math.min(pos.y - H / 2, window.innerHeight - H - 8)),
          }}
        />
      )}
    </div>
  );
}
