import React, { useState, useEffect, useRef } from 'react';

const CONTAINER_SIZE = 264;
const CROP_SIZE = 208;
const OUTPUT_SIZE = 256;
const MAX_ZOOM = 4;

function clampOffset(nx, ny, targetZoom, nat) {
  if (!nat.w || !nat.h) return { x: 0, y: 0 };
  const base = CROP_SIZE / Math.min(nat.w, nat.h);
  const w = nat.w * base * targetZoom;
  const h = nat.h * base * targetZoom;
  const maxX = Math.max(0, (w - CROP_SIZE) / 2);
  const maxY = Math.max(0, (h - CROP_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, nx)),
    y: Math.min(maxY, Math.max(-maxY, ny))
  };
}

export default function AvatarCropModal({ file, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  const imgRef = useRef(null);
  const viewportRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const naturalRef = useRef({ w: 0, h: 0 });

  const applyZoom = (nextZoomRaw) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(1, Number(nextZoomRaw)));
    const prevZoom = zoomRef.current || 1;
    const scaleRatio = nextZoom / prevZoom;
    const nextOff = clampOffset(
      offsetRef.current.x * scaleRatio,
      offsetRef.current.y * scaleRatio,
      nextZoom,
      naturalRef.current
    );
    zoomRef.current = nextZoom;
    offsetRef.current = nextOff;
    setZoom(nextZoom);
    setOffset(nextOff);
  };

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    naturalRef.current = { w: 0, h: 0 };
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setNaturalSize({ w: 0, h: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0025;
      applyZoom(zoomRef.current + delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [file]);

  const baseScale =
    naturalSize.w > 0 && naturalSize.h > 0
      ? CROP_SIZE / Math.min(naturalSize.w, naturalSize.h)
      : 1;

  const dispW = naturalSize.w * baseScale * zoom;
  const dispH = naturalSize.h * baseScale * zoom;

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        type: 'drag',
        x: e.clientX,
        y: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y
      };
    } else if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      gestureRef.current = {
        type: 'pinch',
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        mx: (p1.x + p2.x) / 2,
        my: (p1.y + p2.y) / 2,
        startZoom: zoomRef.current,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y
      };
    }
  };

  const handlePointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;

    if (g.type === 'drag' && pointersRef.current.size === 1) {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      const nextOff = clampOffset(g.ox + dx, g.oy + dy, zoomRef.current, naturalRef.current);
      offsetRef.current = nextOff;
      setOffset(nextOff);
    } else if (g.type === 'pinch' && pointersRef.current.size >= 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(1, g.startZoom * (dist / g.dist)));
      const zoomRatio = nextZoom / g.startZoom;
      const nextOff = clampOffset(
        g.ox * zoomRatio + (mx - g.mx),
        g.oy * zoomRatio + (my - g.my),
        nextZoom,
        naturalRef.current
      );
      zoomRef.current = nextZoom;
      offsetRef.current = nextOff;
      setZoom(nextZoom);
      setOffset(nextOff);
    }
  };

  const handlePointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 1) {
      const [rem] = Array.from(pointersRef.current.values());
      gestureRef.current = {
        type: 'drag',
        x: rem.x,
        y: rem.y,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y
      };
    } else {
      gestureRef.current = null;
    }
  };

  const handleDoubleClick = () => {
    applyZoom(zoomRef.current < 1.3 ? 1.8 : 1);
  };

  const handleSave = () => {
    if (!imgRef.current || !naturalSize.w) return;
    setProcessing(true);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#18261F';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const ratio = OUTPUT_SIZE / CROP_SIZE;
    const rx = CROP_SIZE / 2 - dispW / 2 + offset.x;
    const ry = CROP_SIZE / 2 - dispH / 2 + offset.y;

    ctx.drawImage(
      imgRef.current,
      rx * ratio,
      ry * ratio,
      dispW * ratio,
      dispH * ratio
    );

    canvas.toBlob(
      (blob) => {
        setProcessing(false);
        if (blob) onConfirm(blob);
      },
      'image/jpeg',
      0.85
    );
  };

  if (!file) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xs rounded-3xl p-4 space-y-3.5 border border-[#DFD9CE] shadow-2xl"
      >
        <div className="text-center">
          <div className="font-display font-extrabold text-base text-[#18261F]">
            Profilkép igazítása
          </div>
          <div className="text-[11px] text-[#5C6B62]">
            Nagyíts bele és húzd középre a képet
          </div>
        </div>

        <div className="flex justify-center">
          <div
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE, touchAction: 'none' }}
            className="relative overflow-hidden rounded-2xl bg-[#18261F] cursor-grab active:cursor-grabbing select-none"
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="Előnézet"
                draggable={false}
                onLoad={(e) => {
                  const nat = {
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight
                  };
                  naturalRef.current = nat;
                  setNaturalSize(nat);
                }}
                style={{
                  width: dispW || CROP_SIZE,
                  height: dispH || CROP_SIZE,
                  maxWidth: 'none',
                  transform: `translate3d(${CONTAINER_SIZE / 2 - (dispW || CROP_SIZE) / 2 + offset.x}px, ${CONTAINER_SIZE / 2 - (dispH || CROP_SIZE) / 2 + offset.y}px, 0)`
                }}
                className="pointer-events-none absolute top-0 left-0 block"
              />
            )}

            <div
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-1">
          <span className="text-xs font-bold text-[#5C6B62]">−</span>
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.02"
            value={zoom}
            onChange={(e) => applyZoom(e.target.value)}
            aria-label="Nagyítás"
            className="flex-1 accent-pilis"
          />
          <span className="text-xs font-bold text-[#5C6B62]">+</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-limestone text-[#5C6B62] font-bold text-xs py-2.5 rounded-xl border border-[#DFD9CE]"
          >
            Mégse
          </button>
          <button
            type="button"
            disabled={processing || !naturalSize.w}
            onClick={handleSave}
            className="flex-1 bg-pilis text-white font-bold text-xs py-2.5 rounded-xl disabled:opacity-50"
          >
            {processing ? 'Mentés...' : 'Kép mentése'}
          </button>
        </div>
      </div>
    </div>
  );
}
