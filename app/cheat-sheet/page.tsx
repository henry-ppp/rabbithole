"use client";

import { PanZoomViewport } from "@/components/cheat-sheet/PanZoomViewport";
import { RoadmapFlowView } from "@/components/cheat-sheet/RoadmapFlowView";
import {
  GenerateButtonSpinner,
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

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80">
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
          <span className="text-[0.6875rem] font-medium text-zinc-400">
            Style
          </span>
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
          disabled={loading || !topic.trim()}
          onClick={() => runRootGeneration(false)}
          className="inline-flex h-9 min-w-[5.75rem] shrink-0 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-opacity disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? <GenerateButtonSpinner /> : "Generate"}
        </button>
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
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-400">
            {style === "roadmap" ? (
              <>
                Generate a concept map — key topics connected top to bottom.
                Click a node to expand key terms and see prerequisites.
              </>
            ) : (
              <>
                Enter a topic and generate a cheat sheet.
                Each area shows key items at a glance; click module titles to
                drill deeper.
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
