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

type Point = { x: number; y: number };

type ViewState = {
  scale: number;
  offset: Point;
};

/** Keep the artboard point under `anchor` (container-local px) fixed on screen. */
function zoomAtPoint(
  offset: Point,
  oldScale: number,
  newScale: number,
  anchor: Point,
): Point {
  return {
    x: anchor.x - ((anchor.x - offset.x) / oldScale) * newScale,
    y: anchor.y - ((anchor.y - offset.y) / oldScale) * newScale,
  };
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function wheelScaleFactor(deltaY: number, deltaMode: number): number {
  // DOM_DELTA_LINE (1) / DOM_DELTA_PAGE (2) send larger deltas than pixel mode (0).
  const normalized =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-normalized * 0.002);
}

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
  const [view, setView] = useState<ViewState>(() => {
    const scale =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 1
        : DEFAULT_SCALE;
    return { scale, offset: { x: 40, y: 40 } };
  });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const { scale, offset } = view;

  const zoomTo = useCallback((computeScale: (prev: number) => number, anchor: Point) => {
    setView((prev) => {
      const nextScale = clampScale(computeScale(prev.scale));
      if (nextScale === prev.scale) {
        return prev;
      }
      return {
        scale: nextScale,
        offset: zoomAtPoint(prev.offset, prev.scale, nextScale, anchor),
      };
    });
  }, []);

  const resetView = useCallback(() => {
    setView({ scale: DEFAULT_SCALE, offset: { x: 40, y: 40 } });
  }, []);

  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 48;
    const anchor = {
      x: container.clientWidth / 2,
      y: container.clientHeight / 2,
    };
    setView((prev) => {
      const nextScale = clampScale(
        (container.clientWidth - padding) / artboardWidth,
      );
      return {
        scale: nextScale,
        offset: zoomAtPoint(prev.offset, prev.scale, nextScale, anchor),
      };
    });
  }, [artboardWidth]);

  const containerPointFromEvent = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [],
  );

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const anchor = containerPointFromEvent(event.clientX, event.clientY);
      if (!anchor) return;

      const factor = wheelScaleFactor(event.deltaY, event.deltaMode);
      zoomTo((s) => s * factor, anchor);
    },
    [containerPointFromEvent, zoomTo],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragRef.current = {
        active: true,
        moved: false,
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
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }
    setView((prev) => ({
      ...prev,
      offset: {
        x: drag.originX + dx,
        y: drag.originY + dy,
      },
    }));
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) {
      window.getSelection()?.removeAllRanges();
    }
    if (dragRef.current) {
      dragRef.current.active = false;
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const zoomByDelta = useCallback(
    (delta: number) => {
      const container = containerRef.current;
      if (!container) return;
      const anchor = {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      };
      zoomTo((s) => s + delta, anchor);
    },
    [zoomTo],
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-xs text-zinc-500">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomByDelta(-0.15)}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => zoomByDelta(0.15)}
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
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden bg-zinc-200/60 active:cursor-grabbing dark:bg-zinc-950"
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