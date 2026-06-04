import { useRef, useEffect, useState } from 'react';

/**
 * Scan caméra best-effort : capture une image, OCR de la zone titre via
 * Tesseract.js (chargé en lazy), renvoie le texte au parent.
 * Nécessite un contexte sécurisé (https ou localhost) pour getUserMedia.
 */
export default function ScanModal({ onResult, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('init'); // init | ready | scanning | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('ready');
      } catch {
        setError("Accès caméra impossible. Vérifie les permissions et l'usage en HTTPS.");
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setStatus('scanning');
    setError(null);

    // Recadrage sur la bande titre (haut de la carte)
    const w = video.videoWidth;
    const h = video.videoHeight;
    const cropY = Math.round(h * 0.05);
    const cropH = Math.round(h * 0.16);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = cropH;
    canvas.getContext('2d').drawImage(video, 0, cropY, w, cropH, 0, 0, w, cropH);

    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(canvas, 'eng');
      const best = (data.text || '')
        .split('\n')
        .map((s) => s.replace(/[^a-zA-Z',\- ]/g, '').trim())
        .filter((s) => s.length >= 3)
        .sort((a, b) => b.length - a.length)[0] || '';
      if (!best) {
        setError('Texte non reconnu. Réessaie en cadrant bien le titre, ou saisis le nom à la main.');
        setStatus('ready');
        return;
      }
      onResult(best);
    } catch {
      setError("Échec de l'OCR.");
      setStatus('ready');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl max-w-lg w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold">Scanner une carte</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {status === 'error' ? (
          <div className="text-sm text-rose-400 py-8 text-center">{error}</div>
        ) : (
          <>
            <div className="relative rounded-lg overflow-hidden bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted className="w-full" />
              {/* Guide de cadrage du titre */}
              <div
                className="absolute left-2 right-2 border-2 border-emerald-400/80 rounded pointer-events-none"
                style={{ top: '5%', height: '16%' }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Cadre le <b>titre</b> de la carte dans le rectangle vert, bon éclairage. Précision best-effort.
            </p>
            {error && <p className="text-xs text-amber-400 mt-1">{error}</p>}
            <button
              type="button"
              onClick={capture}
              disabled={status !== 'ready'}
              className="mt-3 w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 text-sm"
            >
              {status === 'scanning' ? 'Analyse…' : 'Capturer & reconnaître'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
