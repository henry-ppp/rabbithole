"use client";

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500/70"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

type GenerationLoaderProps = {
  message: string;
  compact?: boolean;
};

export function GenerationLoader({
  message,
  compact = false,
}: GenerationLoaderProps) {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2.5 px-6 py-8 text-sm text-zinc-500"
        aria-live="polite"
      >
        <LoadingDots />
        <span className="animate-pulse">{message}</span>
      </div>
    );
  }

  return (
    <article
      className="flex w-[min(720px,90vw)] flex-col gap-8 p-10"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="space-y-3">
        <div className="h-7 w-2/5 animate-pulse rounded-full bg-zinc-200/80" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-zinc-100" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              "h-28 rounded-xl border border-zinc-200/60 p-4",
              i % 2 === 0 ? "bg-blue-50/50" : "bg-amber-50/50",
              "animate-pulse",
            ].join(" ")}
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "1.8s" }}
          >
            <div className="mb-3 h-3 w-1/2 rounded-full bg-zinc-200/80" />
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-zinc-100" />
              <div className="h-2 w-4/5 rounded-full bg-zinc-100" />
              <div className="h-2 w-3/5 rounded-full bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 text-sm text-zinc-500">
        <LoadingDots />
        <span className="font-medium text-zinc-600">{message}</span>
      </div>
    </article>
  );
}

export function GenerateButtonSpinner() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 animate-bounce rounded-full bg-current opacity-80"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
