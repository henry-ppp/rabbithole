"use client";

import { PanZoomViewport } from "@/components/cheat-sheet/PanZoomViewport";
import type { CheatSheetResponse } from "@/lib/cheat-sheet/render-contract";
import {
  MAX_NAV_DEPTH,
  cacheKey,
  canDrillDeeper,
  composeChildTopic,
  createFrame,
  type CheatSheetFrame,
  type DrillTarget,
} from "@/lib/cheat-sheet/navigation";
import { RenderNodeView } from "@/lib/cheat-sheet/render-node";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

type Phase = CheatSheetResponse["meta"]["phases"][number];

type FetchOptions = {
  topic: string;
  useFixture?: boolean;
  parentContext?: string;
};

async function fetchCheatSheet(
  options: FetchOptions & { audience?: string; depth?: string },
): Promise<CheatSheetResponse & { error?: string }> {
  const res = await fetch("/api/cheat-sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: options.topic.trim(),
      audience: options.audience?.trim() || undefined,
      depth: options.depth?.trim() || undefined,
      parentContext: options.parentContext?.trim() || undefined,
      useFixture: options.useFixture ?? false,
    }),
  });

  const json = (await res.json()) as CheatSheetResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json;
}

export default function CheatSheetPage() {
  const [topic, setTopic] = useState("Git rebase");
  const [audience, setAudience] = useState("");
  const [depth, setDepth] = useState("reference");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<CheatSheetFrame[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [depthLimitMessage, setDepthLimitMessage] = useState<string | null>(
    null,
  );

  const sessionCache = useRef(new Map<string, CheatSheetResponse>());

  const activeFrame = stack[stack.length - 1] ?? null;
  const activeResponse = activeFrame?.response ?? null;
  const canExplore = stack.length > 0 && !loading;

  const applyResponse = useCallback((json: CheatSheetResponse) => {
    setPhases(json.meta?.phases ?? []);
    setWarnings(json.meta?.warnings ?? []);
  }, []);

  const runRootGeneration = useCallback(
    async (useFixture: boolean) => {
      const rootTopic = topic.trim();
      if (!rootTopic) return;

      setLoading(true);
      setError(null);
      setDepthLimitMessage(null);
      setPhases([]);
      setWarnings([]);
      setStack([]);
      sessionCache.current.clear();

      try {
        const json = await fetchCheatSheet({
          topic: rootTopic,
          audience,
          depth,
          useFixture,
        });

        const frame = createFrame(rootTopic, rootTopic, json);
        const key = cacheKey(rootTopic, audience, depth);
        sessionCache.current.set(key, json);

        setStack([frame]);
        applyResponse(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStack([]);
        setWarnings([]);
      } finally {
        setLoading(false);
      }
    },
    [topic, audience, depth, applyResponse],
  );

  const navigateToFrame = useCallback(
    (index: number) => {
      if (loading && index >= stack.length - 1) return;
      setError(null);
      setDepthLimitMessage(null);
      setStack((prev) => {
        const next = prev.slice(0, index + 1);
        const frame = next[index];
        if (frame) {
          applyResponse(frame.response);
        }
        return next;
      });
    },
    [loading, stack.length, applyResponse],
  );

  const handleDrill = useCallback(
    async (target: DrillTarget) => {
      if (loading || stack.length === 0) return;

      if (!canDrillDeeper(stack.length)) {
        setDepthLimitMessage(
          `Maximum drill depth (${MAX_NAV_DEPTH}) reached. Go back to explore another branch.`,
        );
        return;
      }

      const childTopic = composeChildTopic(stack, target);
      if (!childTopic) return;

      setDepthLimitMessage(null);
      const parentFrame = stack[stack.length - 1]!;
      const parentContext = parentFrame.topic;
      const key = cacheKey(childTopic, audience, depth);
      const cached = sessionCache.current.get(key);

      if (cached) {
        const frame = createFrame(
          target.label,
          childTopic,
          cached,
        );
        setStack((prev) => [...prev, frame]);
        applyResponse(cached);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setPhases([]);
      setWarnings([]);

      try {
        const json = await fetchCheatSheet({
          topic: childTopic,
          audience,
          depth,
          parentContext,
        });

        sessionCache.current.set(key, json);
        const frame = createFrame(target.label, childTopic, json);
        setStack((prev) => [...prev, frame]);
        applyResponse(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [loading, stack, audience, depth, applyResponse],
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-100 dark:bg-black">
      <header className="flex shrink-0 flex-wrap items-end gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Topic
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="e.g. TypeScript utility types"
            />
          </label>
          <label className="flex w-40 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Audience
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="optional"
            />
          </label>
          <label className="flex w-36 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Depth
            <select
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="reference">Reference</option>
              <option value="exam">Exam cram</option>
              <option value="on-call">On-call</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !topic.trim()}
            onClick={() => runRootGeneration(false)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Generating?" : "Generate"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runRootGeneration(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Load fixture
          </button>
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Home
          </Link>
        </div>
      </header>

      {stack.length > 0 ? (
        <nav
          aria-label="Cheat sheet breadcrumbs"
          className="flex shrink-0 flex-wrap items-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {stack.map((frame, index) => {
            const isLast = index === stack.length - 1;
            const allowNav =
              !isLast && (!loading || index < stack.length - 1);

            return (
              <span key={frame.id} className="flex items-center gap-1">
                {index > 0 ? (
                  <span className="text-zinc-400" aria-hidden>
                    /
                  </span>
                ) : null}
                {isLast ? (
                  <span
                    className="max-w-[14rem] truncate font-medium text-zinc-900 dark:text-zinc-50"
                    title={frame.label}
                  >
                    {frame.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!allowNav}
                    onClick={() => navigateToFrame(index)}
                    className="max-w-[14rem] truncate text-violet-700 hover:underline disabled:cursor-default disabled:opacity-50 dark:text-violet-300"
                    title={frame.label}
                  >
                    {frame.label}
                  </button>
                )}
              </span>
            );
          })}
          {loading && stack.length > 1 ? (
            <span className="ml-2 text-xs text-zinc-500">Exploring?</span>
          ) : null}
        </nav>
      ) : null}

      {(error ||
        depthLimitMessage ||
        phases.length > 0 ||
        warnings.length > 0) && (
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/80">
          {error ? (
            <p className="text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          {depthLimitMessage ? (
            <p className="text-amber-800 dark:text-amber-200">
              {depthLimitMessage}
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="mt-1 space-y-1 text-amber-800 dark:text-amber-200">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {phases.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-3 text-zinc-600 dark:text-zinc-400">
              {phases.map((phase) => (
                <li key={phase.name}>
                  <span className="font-medium">{phase.name}</span>:{" "}
                  <span
                    className={
                      phase.status === "ok"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {phase.status}
                  </span>
                  {phase.runId ? ` ? ${phase.runId.slice(0, 8)}` : null}
                </li>
              ))}
            </ul>
          ) : null}
          {activeResponse?.meta.coverageMap ? (
            <p className="mt-1 text-zinc-500">
              Coverage: {activeResponse.meta.coverageMap.sections.length}{" "}
              sections ? {activeResponse.meta.coverageMap.title}
            </p>
          ) : null}
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col">
        {activeResponse?.tree ? (
          <>
            <PanZoomViewport
              key={activeFrame?.id ?? "viewport"}
              artboardWidth={1400}
              artboardMinHeight={1000}
            >
              <RenderNodeView
                node={activeResponse.tree}
                onDrill={canExplore ? handleDrill : undefined}
                drilling={loading}
              />
            </PanZoomViewport>
            {loading ? (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-900/20 backdrop-blur-[1px] dark:bg-black/30"
                aria-live="polite"
              >
                <p className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-lg dark:bg-zinc-900">
                  Generating cheat sheet?
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-500">
            Enter a topic and generate, or load the Git rebase fixture to preview
            the canvas. Click section titles, table cells, list items, or code
            blocks to explore deeper.
          </div>
        )}
      </main>
    </div>
  );
}

