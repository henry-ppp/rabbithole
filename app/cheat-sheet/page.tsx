"use client";

import { PanZoomViewport } from "@/components/cheat-sheet/PanZoomViewport";
import { RoadmapFlowView } from "@/components/cheat-sheet/RoadmapFlowView";
import {
  GenerationLoader,
} from "@/components/cheat-sheet/GenerationLoader";
import type { CheatSheetResponse } from "@/lib/cheat-sheet/render-contract";
import {
  MAX_NAV_DEPTH,
  cacheKey,
  canDrillDeeper,
  composeChildTopic,
  createFrame,
  resolveFrameLabel,
  withSheetDisplayTitle,
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
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [style, setStyle] = useState<KnowledgeStyle>("cheatsheet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<CheatSheetFrame[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [depthLimitMessage, setDepthLimitMessage] = useState<string | null>(
    null,
  );

  const sessionCache = useRef(new Map<string, CheatSheetResponse>());
  const streamAbortRef = useRef<AbortController | null>(null);

  const activeFrame = stack[stack.length - 1] ?? null;
  const activeResponse = activeFrame?.response ?? null;
  const activeStyle = normalizeStyle(activeResponse?.meta.style ?? style);
  const roadmapView = isRoadmapResponse(activeResponse);
  const drillEnabled = styleSupportsDrill(activeStyle) && !roadmapView;
  const canExplore = stack.length > 0 && !loading && drillEnabled;
  const hasActiveSheet = Boolean(activeResponse?.tree);
  const showCanvas = hasActiveSheet || loading;
  const isStreamingSkeleton =
    loading && activeResponse?.meta.streamingStage === "skeleton";
  const loadingMessage =
    streamingStatusLabel(activeResponse?.meta.streamingStage, activeStyle) ??
    (activeStyle === "roadmap" ? "Planning roadmap…" : "Planning outline…");
  const streamingStatus = loading ? loadingMessage : null;

  const applyResponse = useCallback((json: CheatSheetResponse) => {
    setWarnings(json.meta?.warnings ?? []);
  }, []);

  const stopGeneration = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLoading(false);
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
    if (stack.length === 0) return;

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

    const patchResponse = (response: CheatSheetResponse) =>
      frameIndex > 0
        ? withSheetDisplayTitle(response, currentFrame.label)
        : response;

    await runStreamingGeneration({
      topic: currentFrame.topic,
      label: currentFrame.label,
      style,
      parentContext,
      retrialCount: currentFrame.retrialCount,
      onPartial: (response) => {
        const patched = patchResponse(response);
        setStack((prev) => {
          const next = [...prev];
          next[frameIndex] = createFrame(
            currentFrame.label,
            currentFrame.topic,
            patched,
            currentFrame.retrialCount,
          );
          return next;
        });
      },
      onDone: (response) => {
        const patched = patchResponse(response);
        sessionCache.current.set(key, patched);
        const newFrame = createFrame(
          currentFrame.label,
          currentFrame.topic,
          patched,
          currentFrame.retrialCount + 1 + (response.meta.retrialCount ?? 0),
        );
        setStack((prev) => {
          const next = [...prev];
          next[frameIndex] = newFrame;
          return next;
        });
      },
    });
  }, [stack, audience, style, drillEnabled, runStreamingGeneration]);

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

      const frameLabel = resolveFrameLabel(target);
      const patchResponse = (response: CheatSheetResponse) =>
        withSheetDisplayTitle(response, frameLabel);

      setDepthLimitMessage(null);
      const parentFrame = stack[stack.length - 1]!;
      const parentContext = parentFrame.topic;
      const key = cacheKey(childTopic, audience, style);
      const cached = sessionCache.current.get(key);

      if (cached) {
        const patched = patchResponse(cached);
        const frame = createFrame(frameLabel, childTopic, patched);
        setStack((prev) => [...prev, frame]);
        applyResponse(patched);
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
          const patched = patchResponse(response);
          setStack((prev) => {
            const last = prev[prev.length - 1];
            const frame = createFrame(frameLabel, childTopic, patched);
            if (last?.topic === childTopic) {
              return [...prev.slice(0, -1), frame];
            }
            return [...prev, frame];
          });
        },
        onDone: (response) => {
          const patched = patchResponse(response);
          sessionCache.current.set(key, patched);
          setStack((prev) => {
            const last = prev[prev.length - 1];
            const frame = createFrame(frameLabel, childTopic, patched);
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

  const isLanding = !showCanvas;
  const showStickyHeader = !isLanding;

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
                  className="truncate font-medium text-zinc-900 dark:text-zinc-50"
                  title={frame.label}
                >
                  {frame.label}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!allowNav}
                  onClick={() => navigateToFrame(index)}
                  className="truncate text-zinc-500 transition-colors hover:text-zinc-900 disabled:cursor-default disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
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

  const landingHeadline =
    style === "roadmap"
      ? "What concept map should we sketch?"
      : "What do you want to learn?";
  const landingInstruction =
    style === "roadmap"
      ? "Enter a subject and we'll map key topics, prerequisites, and how they connect."
      : "Enter a topic or keyword below — we'll turn it into a visual cheat sheet you can explore and drill into.";
  const landingPlaceholder =
    style === "roadmap"
      ? 'Try "Machine learning", "Web development", or "Product management"…'
      : 'Try "Git rebase", "React useEffect", or "TCP handshake"…';
  const landingHint =
    style === "roadmap"
      ? "Press Enter or click Generate. Click nodes on the map to expand terms and prerequisites."
      : "Press Enter or click Generate. Click module titles on the canvas to go deeper.";

  const handleRootSubmit = useCallback(() => {
    if (loading) {
      stopGeneration();
      return;
    }
    void runRootGeneration(false);
  }, [loading, stopGeneration, runRootGeneration]);

  const stickyHeaderControls = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-zinc-100/90 px-4 py-2 text-sm transition-shadow focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-900/10 dark:bg-zinc-900/80 dark:focus-within:bg-zinc-900 dark:focus-within:ring-zinc-100/10">
        {stack.length > 0 ? (
          <>
            <nav
              aria-label="Topic path"
              className="flex min-w-0 shrink items-center gap-1 overflow-hidden text-zinc-500 dark:text-zinc-400"
            >
              {breadcrumbTrail}
            </nav>
            <span className="shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden>
              |
            </span>
          </>
        ) : null}
        <label className="flex min-w-0 flex-1 items-center">
          <span className="sr-only">Topic</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50"
            placeholder={stack.length > 0 ? "New topic…" : "Topic…"}
          />
        </label>
      </div>

      <label className="hidden items-center gap-2 sm:flex">
        <span className="text-[0.6875rem] font-medium text-zinc-400">Style</span>
        <select
          value={style}
          onChange={(e) => setStyle(normalizeStyle(e.target.value))}
          className="rounded-full border-0 bg-zinc-100/90 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:bg-zinc-900/80 dark:text-zinc-200"
        >
          <option value="cheatsheet">Cheat sheet</option>
          <option value="roadmap">Roadmap</option>
        </select>
      </label>

      <button
        type="button"
        disabled={!loading && !topic.trim()}
        onClick={handleRootSubmit}
        className={`inline-flex h-9 min-w-[5.75rem] shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm transition-opacity disabled:opacity-40 ${
          loading
            ? "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        }`}
      >
        {loading ? "Stop" : "Generate"}
      </button>
    </>
  );

  const landingHero = (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            {landingHeadline}
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
            {landingInstruction}
          </p>
        </div>

        <div className="w-full rounded-[1.75rem] border border-zinc-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-shadow focus-within:border-zinc-300 focus-within:shadow-[0_12px_40px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-700">
          <label className="block">
            <span className="sr-only">Topic or keyword</span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && topic.trim()) {
                  e.preventDefault();
                  handleRootSubmit();
                }
              }}
              className="w-full border-0 bg-transparent px-5 pb-2 pt-5 text-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50"
              placeholder={landingPlaceholder}
              autoFocus
            />
          </label>
          <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400">Format</span>
              <select
                value={style}
                onChange={(e) => setStyle(normalizeStyle(e.target.value))}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <option value="cheatsheet">Cheat sheet</option>
                <option value="roadmap">Roadmap</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!topic.trim()}
              onClick={handleRootSubmit}
              className="inline-flex h-10 min-w-[6.5rem] items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-sm transition-opacity hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Generate
            </button>
          </div>
        </div>

        <p className="max-w-md text-center text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
          {landingHint}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-50 dark:bg-zinc-950">
      {showStickyHeader ? (
        <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80">
          {stickyHeaderControls}
        </header>
      ) : null}

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
        {showCanvas ? (
          roadmapView ? (
            <RoadmapFlowView
              key={activeFrame?.id ?? "roadmap"}
              node={activeResponse!.tree}
              onRegenerate={handleRegenerate}
              retrialCount={activeFrame?.retrialCount ?? 0}
              streamingStatus={streamingStatus}
              isStreamingSkeleton={isStreamingSkeleton}
            />
          ) : (
            <PanZoomViewport
              key={activeFrame?.topic ?? "viewport"}
              onRegenerate={stack.length > 0 ? handleRegenerate : undefined}
              retrialCount={activeFrame?.retrialCount ?? 0}
              streamingStatus={streamingStatus}
            >
              {hasActiveSheet ? (
                <RenderNodeView
                  node={activeResponse!.tree}
                  onDrill={canExplore ? handleDrill : undefined}
                  drilling={loading}
                  isStreamingSkeleton={isStreamingSkeleton}
                />
              ) : (
                <GenerationLoader message={loadingMessage} />
              )}
            </PanZoomViewport>
          )
        ) : (
          landingHero
        )}
      </main>
    </div>
  );
}
