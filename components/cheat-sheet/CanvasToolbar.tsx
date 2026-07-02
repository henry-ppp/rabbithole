"use client";

import type { ReactNode } from "react";

type CanvasToolbarProps = {
  variant: "sheet" | "graph";
  scale?: number;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onFitWidth?: () => void;
  onReset?: () => void;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
  retrialCount?: number;
  breadcrumbs?: ReactNode;
  streamingStatus?: string | null;
};

const btnClass =
  "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

export function CanvasToolbar({
  variant,
  scale,
  onZoomOut,
  onZoomIn,
  onFitWidth,
  onReset,
  onRegenerate,
  regenerateDisabled = false,
  retrialCount = 0,
  breadcrumbs,
  streamingStatus,
}: CanvasToolbarProps) {
  const helpText =
    variant === "graph"
      ? "Pan and scroll to move. Click a node to expand key terms and highlight prerequisites."
      : "Drag to pan. Scroll to zoom. Expand modules for details; click titles to drill deeper.";

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
      {breadcrumbs ? (
        <div className="flex min-w-0 items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          {breadcrumbs}
        </div>
      ) : null}

      {variant === "sheet" && scale !== undefined ? (
        <>
          <span className="text-xs tabular-nums text-zinc-500">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomOut}
            className={btnClass}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className={btnClass}
            aria-label="Zoom in"
          >
            +
          </button>
          <button type="button" onClick={onFitWidth} className={btnClass}>
            Fit width
          </button>
          <button type="button" onClick={onReset} className={btnClass}>
            Reset
          </button>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {streamingStatus ? (
          <span
            className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
            aria-live="polite"
          >
            {streamingStatus}
          </span>
        ) : null}
        {retrialCount > 0 ? (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[0.65rem] tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            aria-label={`${retrialCount} retrials`}
          >
            ↻ {retrialCount}
          </span>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            disabled={regenerateDisabled}
            onClick={onRegenerate}
            className={`${btnClass} disabled:opacity-50`}
            title="Regenerate this level"
          >
            Regenerate
          </button>
        ) : null}
        <span className="group relative">
          <button
            type="button"
            className={`${btnClass} px-1.5`}
            aria-label="Canvas help"
          >
            ?
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden w-56 rounded-md border border-zinc-200 bg-white p-2 text-[0.65rem] leading-snug text-zinc-600 shadow-sm group-hover:block group-focus-within:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {helpText}
          </span>
        </span>
      </div>
    </div>
  );
}
