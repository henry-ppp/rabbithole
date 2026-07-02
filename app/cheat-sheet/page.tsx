"use client";

import { PanZoomViewport } from "@/components/cheat-sheet/PanZoomViewport";
import { RoadmapFlowView } from "@/components/cheat-sheet/RoadmapFlowView";
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
import {
  fetchCheatSheetStream,
  streamingStatusLabel,
} from "@/lib/cheat-sheet/stream-client";
import type { CheatSheetStreamEvent } from "@/lib/cheat-sheet/stream-events";
import {
  normalizeStyle,
  styleSupportsDrill,
  type KnowledgeStyle,
} from "@/lib/cheat-sheet/styles";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

type StreamGenerationOptions = {
  topic: string;
  label: string;
  style: KnowledgeStyle;
  parentContext?: string;
  useFixture?: boolean;
  retrialCount?: number;
  onPartial: (response: CheatSheetResponse) => void;
  onDone: (response: CheatSheetResponse) => void;
};

function isRoadmapResponse(response: CheatSheetResponse | null): boolean {
  if (!response) return false;
  return (
    response.meta.style === "roadmap" || response.tree.kind === "conceptGraph"
  );
}

export default function CheatSheetPage() {
  const [topic, setTopic] = useState("Git rebase");
  const [audience, setAudience] = useState("");
  const [style, setStyle] = useState<KnowledgeStyle>("cheatsheet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<CheatSheetFrame[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [depthLimitMessage, setDepthLimitMessage] = useState<string | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const sessionCache = useRef(new Map<string, CheatSheetResponse>());
  const streamAbortRef = useRef<AbortController | null>(null);

  const activeFrame = stack[stack.length - 1] ?? null;
  const activeResponse = activeFrame?.response ?? null;
  const activeStyle = normalizeStyle(activeResponse?.meta.style ?? style);
  const roadmapView = isRoadmapResponse(activeResponse);
  const drillEnabled = styleSupportsDrill(activeStyle) && !roadmapView;
  const canExplore = stack.length > 0 && !loading && drillEnabled;
  const hasActiveSheet = Boolean(activeResponse?.tree);
  const isStreamingSkeleton =
    loading && activeResponse?.meta.streamingStage === "skeleton";
  const streamingStatus = loading
    ? streamingStatusLabel(activeResponse?.meta.streamingStage, activeStyle)
    : null;

  const applyResponse = useCallback((json: CheatSheetResponse) => {
    setWarnings(json.meta?.warnings ?? []);
  }, []);

  const runStreamingGeneration = useCallback(
    async (options: StreamGenerationOptions) => {
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;

      setLoading(true);
      setError(null);

      const handleEvent = (event: CheatSheetStreamEvent) => {
        if (event.type !== "partial" && event.type !== "done") return;
        const response = { tree: event.tree, meta: event.meta };
        if (event.type === "done") {
          options.onDone(response);
          applyResponse(response);
        } else {
          options.onPartial(response);
          applyResponse(response);
        }
      };

      try {
        await fetchCheatSheetStream(
          {
            topic: options.topic,
            audience,
            style: options.style,
            parentContext: options.parentContext,
            useFixture: options.useFixture,
            signal: controller.signal,
          },
          handleEvent,
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null;
        }
        setLoading(false);
      }
    },
    [audience, applyResponse],
  );

  const runRootGeneration = useCallback(
    async (useFixture: boolean) => {
      const rootTopic = topic.trim();
      if (!rootTopic) return;

      setDepthLimitMessage(null);
      setWarnings([]);
      setStack([]);
      sessionCache.current.clear();

      const key = cacheKey(rootTopic, audience, style);

      await runStreamingGeneration({
        topic: rootTopic,
        label: rootTopic,
        style,
        useFixture,
        onPartial: (response) => {
          setStack([createFrame(rootTopic, rootTopic, response)]);
        },
        onDone: (response) => {
          sessionCache.current.set(key, response);
          setStack([createFrame(rootTopic, rootTopic, response)]);
        },
      });
    },
    [topic, audience, style, runStreamingGeneration],
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

  const handleRegenerate = useCallback(async () => {
    if (loading || stack.length === 0) return;

    const frameIndex = stack.length - 1;
    const currentFrame = stack[frameIndex]!;
    const parentContext =
      drillEnabled && frameIndex > 0
        ? stack[frameIndex - 1]!.topic
        : undefined;

    setWarnings([]);
    setDepthLimitMessage(null);

    const key = cacheKey(currentFrame.topic, audience, style);
    sessionCache.current.delete(key);

    await runStreamingGeneration({
      topic: currentFrame.topic,
      label: currentFrame.label,
      style,
      parentContext,
      retrialCount: currentFrame.retrialCount,
      onPartial: (response) => {
        setStack((prev) => {
          const next = [...prev];
          next[frameIndex] = createFrame(
            currentFrame.label,
            currentFrame.topic,
            response,
            currentFrame.retrialCount,
          );
          return next;
        });
      },
      onDone: (response) => {
        sessionCache.current.set(key, response);
        const newFrame = createFrame(
          currentFrame.label,
          currentFrame.topic,
          response,
          currentFrame.retrialCount + 1 + (response.meta.retrialCount ?? 0),
        );
        setStack((prev) => {
          const next = [...prev];
          next[frameIndex] = newFrame;
          return next;
        });
      },
    });
  }, [loading, stack, audience, style, drillEnabled, runStreamingGeneration]);

  const handleDrill = useCallback(
    async (target: DrillTarget) => {
      if (loading || stack.length === 0 || !drillEnabled) return;

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
      const key = cacheKey(childTopic, audience, style);
      const cached = sessionCache.current.get(key);

      if (cached) {
        const frame = createFrame(target.label, childTopic, cached);
        setStack((prev) => [...prev, frame]);
        applyResponse(cached);
        setError(null);
        return;
      }

      setWarnings([]);

      await runStreamingGeneration({
        topic: childTopic,
        label: target.label,
        style: "cheatsheet",
        parentContext,
        onPartial: (response) => {
          setStack((prev) => {
            const last = prev[prev.length - 1];
            const frame = createFrame(target.label, childTopic, response);
            if (last?.topic === childTopic) {
              return [...prev.slice(0, -1), frame];
            }
            return [...prev, frame];
          });
        },
        onDone: (response) => {
          sessionCache.current.set(key, response);
          setStack((prev) => {
            const last = prev[prev.length - 1];
            const frame = createFrame(target.label, childTopic, response);
            if (last?.topic === childTopic) {
              return [...prev.slice(0, -1), frame];
            }
            return [...prev, frame];
          });
        },
      });
    },
    [loading, stack, audience, style, drillEnabled, applyResponse, runStreamingGeneration],
  );

  const breadcrumbTrail =
    stack.length > 0 ? (
      <>
        {stack.map((frame, index) => {
          const isLast = index === stack.length - 1;
          const allowNav = !isLast && (!loading || index < stack.length - 1);

          return (
            <span key={frame.id} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="text-zinc-400" aria-hidden>
                  /
                </span>
              ) : null}
              {isLast ? (
                <span
                  className="max-w-[10rem] truncate font-medium text-zinc-800 dark:text-zinc-100"
                  title={frame.label}
                >
                  {frame.label}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!allowNav}
                  onClick={() => navigateToFrame(index)}
                  className="max-w-[10rem] truncate text-violet-700 hover:underline disabled:cursor-default disabled:opacity-50 dark:text-violet-300"
                  title={frame.label}
                >
                  {frame.label}
                </button>
              )}
            </span>
          );
        })}
        {loading && stack.length > 1 ? (
          <span className="text-zinc-500">…</span>
        ) : null}
      </>
    ) : null;

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-100 dark:bg-black">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="sr-only">Topic</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="Topic…"
          />
        </label>

        <label className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-400">
            Style
          </span>
          <select
            value={style}
            onChange={(e) => setStyle(normalizeStyle(e.target.value))}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="cheatsheet">Cheat sheet</option>
            <option value="roadmap">Roadmap</option>
          </select>
        </label>

        <button
          type="button"
          disabled={loading || !topic.trim()}
          onClick={() => runRootGeneration(false)}
          className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "…" : "Generate"}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-expanded={menuOpen}
            aria-label="More options"
          >
            ⋯
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <label className="flex flex-col gap-1 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <span className="text-[0.65rem] font-medium text-zinc-500">
                    Audience
                  </span>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="optional"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 sm:hidden dark:border-zinc-800">
                  <span className="text-xs text-zinc-500">Style</span>
                  <select
                    value={style}
                    onChange={(e) => setStyle(normalizeStyle(e.target.value))}
                    className="rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="cheatsheet">Cheat sheet</option>
                    <option value="roadmap">Roadmap</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setMenuOpen(false);
                    runRootGeneration(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  Load fixture
                </button>
                <Link
                  href="/"
                  className="block px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => setMenuOpen(false)}
                >
                  Home
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </header>

      {(error || depthLimitMessage || warnings.length > 0) && (
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/80">
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
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col">
        {hasActiveSheet ? (
          roadmapView ? (
            <RoadmapFlowView
              key={activeFrame?.id ?? "roadmap"}
              node={activeResponse!.tree}
              onRegenerate={handleRegenerate}
              regenerateDisabled={loading}
              retrialCount={activeFrame?.retrialCount ?? 0}
              breadcrumbs={breadcrumbTrail}
              streamingStatus={streamingStatus}
              isStreamingSkeleton={isStreamingSkeleton}
            />
          ) : (
            <PanZoomViewport
              key={activeFrame?.id ?? "viewport"}
              artboardWidth={1400}
              artboardMinHeight={1000}
              onRegenerate={handleRegenerate}
              regenerateDisabled={loading}
              retrialCount={activeFrame?.retrialCount ?? 0}
              breadcrumbs={drillEnabled ? breadcrumbTrail : undefined}
              streamingStatus={streamingStatus}
            >
              <RenderNodeView
                node={activeResponse!.tree}
                onDrill={canExplore ? handleDrill : undefined}
                drilling={loading}
                isStreamingSkeleton={isStreamingSkeleton}
              />
            </PanZoomViewport>
          )
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-500">
            {loading ? (
              <p aria-live="polite">
                {streamingStatus ??
                  (style === "roadmap"
                    ? "Planning roadmap…"
                    : "Planning outline…")}
              </p>
            ) : style === "roadmap" ? (
              <>
                Generate a concept map — key topics connected top to bottom.
                Click a node to expand key terms and see prerequisites.
              </>
            ) : (
              <>
                Enter a topic and generate, or load the fixture from the menu.
                Modules start collapsed; expand for details, click titles to
                drill deeper.
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
