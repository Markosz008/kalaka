import React, { useState, useEffect, useRef } from 'react';

const PREVIEW_SIZE = 224;
const OUTPUT_SIZE = 256;

export default function AvatarCropModal({ file, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const imgRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale =
    naturalSize.w > 0 && naturalSize.h > 0
      ? PREVIEW_SIZE / Math.min(naturalSize.w, naturalSize.h)
      : 1;

  const dispW = naturalSize.w * baseScale * zoom;
  const dispH = naturalSize.h * baseScale * zoom;

  const clampOffset = (nx, ny, nextZoom = zoom) => {
    const w = naturalSize.w * baseScale * nextZoom;
    const h = naturalSize.h * baseScale * nextZoom;
    const maxX = Math.max(0, (w - PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (h - PREVIEW_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nx)),
      y: Math.min(maxY, Math.max(-maxY, ny))
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y
    };
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset(clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy));
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handleZoomChange = (nextZoom) => {
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
  };

  const handleSave = () => {
    if (!imgRef.current || !naturalSize.w) return;
    setProcessing(true);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    const ratio = OUTPUT_SIZE / PREVIEW_SIZE;
    const rx = PREVIEW_SIZE / 2 - dispW / 2 + offset.x;
    const ry = PREVIEW_SIZE / 2 - dispH / 2 + offset.y;

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
      0.82
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
            Húzd a képet, hogy az arcod a kör közepére kerüljön
          </div>
        </div>

        <div className="flex justify-center">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, touchAction: 'none' }}
            className="relative overflow-hidden rounded-2xl bg-[#18261F] cursor-grab active:cursor-grabbing select-none"
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="Előnézet"
                draggable={false}
                onLoad={(e) => {
                  setNaturalSize({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight
                  });
                }}
                style={{
                  width: dispW || PREVIEW_SIZE,
                  height: dispH || PREVIEW_SIZE,
                  maxWidth: 'none',
                  transform: `translate(${PREVIEW_SIZE / 2 - (dispW || PREVIEW_SIZE) / 2 + offset.x}px, ${PREVIEW_SIZE / 2 - (dispH || PREVIEW_SIZE) / 2 + offset.y}px)`
                }}
                className="pointer-events-none block"
              />
            )}

            <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.52)]" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-1">
          <span className="text-xs font-bold text-[#5C6B62]">−</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
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
