"use client";

import { PanZoomViewport } from "@/components/cheat-sheet/PanZoomViewport";
import type { CheatSheetResponse } from "@/lib/cheat-sheet/render-contract";
import { RenderNodeView } from "@/lib/cheat-sheet/render-node";
import Link from "next/link";
import { useCallback, useState } from "react";

type Phase = CheatSheetResponse["meta"]["phases"][number];

export default function CheatSheetPage() {
  const [topic, setTopic] = useState("Git rebase");
  const [audience, setAudience] = useState("");
  const [depth, setDepth] = useState("reference");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheatSheetResponse | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const runGeneration = useCallback(
    async (useFixture: boolean) => {
      setLoading(true);
      setError(null);
      setPhases([]);
      setWarnings([]);

      try {
        const res = await fetch("/api/cheat-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim(),
            audience: audience.trim() || undefined,
            depth: depth.trim() || undefined,
            useFixture,
          }),
        });

        const json = (await res.json()) as CheatSheetResponse & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(json.error ?? `Request failed (${res.status})`);
        }

        setData(json);
        setPhases(json.meta?.phases ?? []);
        setWarnings(json.meta?.warnings ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setData(null);
        setWarnings([]);
      } finally {
        setLoading(false);
      }
    },
    [topic, audience, depth],
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
            onClick={() => runGeneration(false)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runGeneration(true)}
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

      {(error || phases.length > 0 || warnings.length > 0) && (
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/80">
          {error ? (
            <p className="text-red-600 dark:text-red-400">{error}</p>
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
                  {phase.runId ? ` · ${phase.runId.slice(0, 8)}` : null}
                </li>
              ))}
            </ul>
          ) : null}
          {data?.meta.coverageMap ? (
            <p className="mt-1 text-zinc-500">
              Coverage: {data.meta.coverageMap.sections.length} sections —{" "}
              {data.meta.coverageMap.title}
            </p>
          ) : null}
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        {data?.tree ? (
          <PanZoomViewport artboardWidth={1400} artboardMinHeight={1000}>
            <RenderNodeView node={data.tree} />
          </PanZoomViewport>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-500">
            Enter a topic and generate, or load the Git rebase fixture to preview
            the canvas.
          </div>
        )}
      </main>
    </div>
  );
}
