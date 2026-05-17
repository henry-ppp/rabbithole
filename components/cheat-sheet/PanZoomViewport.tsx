"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const DEFAULT_SCALE = 0.85;

type PanZoomViewportProps = {
  children: ReactNode;
  artboardWidth?: number;
  artboardMinHeight?: number;
  className?: string;
};

export function PanZoomViewport({
  children,
  artboardWidth = 1400,
  artboardMinHeight = 900,
  className = "",
}: PanZoomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SCALE;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 1
      : DEFAULT_SCALE;
  });
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const clampScale = useCallback((value: number) => {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }, []);

  const resetView = useCallback(() => {
    setScale(DEFAULT_SCALE);
    setOffset({ x: 40, y: 40 });
  }, []);

  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 48;
    const nextScale = clampScale(
      (container.clientWidth - padding) / artboardWidth,
    );
    setScale(nextScale);
    setOffset({ x: 24, y: 24 });
  }, [artboardWidth, clampScale]);

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setScale((s) => clampScale(s + delta));
    },
    [clampScale],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    },
    [offset.x, offset.y],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current.active = false;
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-xs text-zinc-500">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s - 0.15))}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s + 0.15))}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={fitToWidth}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Fit width
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Reset
        </button>
        <span className="ml-auto text-xs text-zinc-400">
          Drag to pan · Scroll to zoom
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-zinc-200/60 active:cursor-grabbing dark:bg-zinc-950"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="application"
        aria-label="Cheat sheet canvas viewport"
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          <div
            className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-300/80 dark:bg-zinc-900 dark:ring-zinc-700"
            style={{
              width: artboardWidth,
              minHeight: artboardMinHeight,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
