"use client";

type CanvasControlBarProps = {
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onRegenerate?: () => void;
  retrialCount?: number;
};

const iconBtnClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const textBtnClass =
  "h-8 shrink-0 rounded-full px-3 text-xs font-medium leading-none text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

const shellClass =
  "pointer-events-auto flex items-center gap-0.5 rounded-full border border-zinc-200/70 bg-white/75 p-1 shadow-lg shadow-zinc-900/[0.06] backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-950/75";

function stopPanPropagation(event: React.PointerEvent | React.MouseEvent) {
  event.stopPropagation();
}

export function CanvasControlBar({
  onZoomOut,
  onZoomIn,
  onRegenerate,
  retrialCount = 0,
}: CanvasControlBarProps) {
  return (
    <div
      className={shellClass}
      onPointerDown={stopPanPropagation}
      onPointerUp={stopPanPropagation}
      onClick={stopPanPropagation}
    >
      {onZoomOut ? (
        <button
          type="button"
          onClick={onZoomOut}
          className={iconBtnClass}
          aria-label="Zoom out"
        >
          −
        </button>
      ) : null}
      {onZoomIn ? (
        <button
          type="button"
          onClick={onZoomIn}
          className={iconBtnClass}
          aria-label="Zoom in"
        >
          +
        </button>
      ) : null}
      {onZoomOut && onZoomIn && onRegenerate ? (
        <span className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
      ) : null}
      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          className={textBtnClass}
          title="Regenerate this level"
        >
          Regenerate
        </button>
      ) : null}
      {retrialCount > 0 ? (
        <span
          className="rounded-full bg-amber-100/90 px-2 py-1 font-mono text-[0.625rem] tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
          aria-label={`${retrialCount} retrials`}
        >
          ↻ {retrialCount}
        </span>
      ) : null}
    </div>
  );
}

type CanvasControlsProps = CanvasControlBarProps & {
  streamingStatus?: string | null;
};

export function CanvasControls({
  onZoomOut,
  onZoomIn,
  onRegenerate,
  retrialCount = 0,
  streamingStatus,
}: CanvasControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {streamingStatus ? (
        <span
          className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-[0.6875rem] font-medium text-violet-700 shadow-sm backdrop-blur-md dark:border-violet-900/50 dark:bg-violet-950/80 dark:text-violet-200"
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
          {streamingStatus}
        </span>
      ) : null}

      <div className="absolute bottom-4 left-4">
        <CanvasControlBar
          onZoomOut={onZoomOut}
          onZoomIn={onZoomIn}
          onRegenerate={onRegenerate}
          retrialCount={retrialCount}
        />
      </div>
    </div>
  );
}
