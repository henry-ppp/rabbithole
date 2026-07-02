"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CanvasControls } from "@/components/cheat-sheet/CanvasToolbar";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const DEFAULT_SCALE = 0.85;

type Point = { x: number; y: number };

type ViewState = {
  scale: number;
  offset: Point;
};

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
  const normalized =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-normalized * 0.002);
}

type PanZoomViewportProps = {
  children: ReactNode;
  onRegenerate?: () => void;
  retrialCount?: number;
  streamingStatus?: string | null;
  className?: string;
};

export function PanZoomViewport({
  children,
  onRegenerate,
  retrialCount = 0,
  streamingStatus,
  className = "",
}: PanZoomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
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

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("button, a, input, select, textarea, [role='button']")) {
        return;
      }
      event.preventDefault();
      const container = event.currentTarget;
      container.setPointerCapture(event.pointerId);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheelNative = (event: WheelEvent) => {
      if (!container.contains(event.target as Node)) return;

      event.preventDefault();
      event.stopPropagation();

      const anchor = containerPointFromEvent(event.clientX, event.clientY);
      if (!anchor) return;

      const factor = wheelScaleFactor(event.deltaY, event.deltaMode);
      zoomTo((s) => s * factor, anchor);
    };

    window.addEventListener("wheel", onWheelNative, { passive: false, capture: true });
    return () =>
      window.removeEventListener("wheel", onWheelNative, { capture: true });
  }, [containerPointFromEvent, zoomTo]);

  return (
    <div className={`relative min-h-0 flex-1 ${className}`}>
      <div
        ref={containerRef}
        className="relative h-full cursor-grab touch-none select-none overflow-hidden bg-zinc-100 active:cursor-grabbing dark:bg-zinc-950 [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.045)_1px,transparent_0)] [background-size:24px_24px]"
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
            ref={artboardRef}
            className="cheat-sheet-artboard relative w-max max-w-[min(1400px,95vw)] rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
          >
            {children}
          </div>
        </div>
      </div>

      <CanvasControls
        onZoomOut={() => zoomByDelta(-0.15)}
        onZoomIn={() => zoomByDelta(0.15)}
        onRegenerate={onRegenerate}
        retrialCount={retrialCount}
        streamingStatus={streamingStatus}
      />
    </div>
  );
}
