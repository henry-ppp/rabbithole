import type { KnowledgeStyle } from "./styles";
import type { CheatSheetResponse } from "./render-contract";
import type { CheatSheetStreamEvent } from "./stream-events";

export type FetchCheatSheetStreamOptions = {
  topic: string;
  audience?: string;
  style?: KnowledgeStyle;
  parentContext?: string;
  useFixture?: boolean;
  signal?: AbortSignal;
};

export type FetchCheatSheetStreamResult = {
  response: CheatSheetResponse;
  events: CheatSheetStreamEvent[];
};

export async function fetchCheatSheetStream(
  options: FetchCheatSheetStreamOptions,
  onEvent?: (event: CheatSheetStreamEvent) => void,
): Promise<FetchCheatSheetStreamResult> {
  const res = await fetch("/api/cheat-sheet/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: options.topic.trim(),
      audience: options.audience?.trim() || undefined,
      style: options.style ?? "cheatsheet",
      parentContext: options.parentContext?.trim() || undefined,
      useFixture: options.useFixture ?? false,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Stream response has no body");
  }

  const events: CheatSheetStreamEvent[] = [];
  let latestResponse: CheatSheetResponse | null = null;
  let streamError: string | null = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (event: CheatSheetStreamEvent) => {
    events.push(event);
    onEvent?.(event);

    if (event.type === "partial" || event.type === "done") {
      latestResponse = { tree: event.tree, meta: event.meta };
    }
    if (event.type === "error") {
      streamError = event.message;
    }
  };

  while (true) {
    if (options.signal?.aborted) {
      await reader.cancel();
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      handleEvent(JSON.parse(trimmed) as CheatSheetStreamEvent);
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    handleEvent(JSON.parse(trailing) as CheatSheetStreamEvent);
  }

    if (streamError && !options.signal?.aborted) {
      throw new Error(streamError);
    }
    if (!latestResponse && !options.signal?.aborted) {
      throw new Error("Stream ended without a response");
    }
    if (!latestResponse) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

  return { response: latestResponse, events };
}

/** Parse NDJSON lines (for tests). */
export function parseNdjsonEvents(text: string): CheatSheetStreamEvent[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CheatSheetStreamEvent);
}

export function streamingStatusLabel(
  stage: CheatSheetResponse["meta"]["streamingStage"] | undefined,
  style: KnowledgeStyle,
): string | null {
  if (!stage) return null;
  if (stage === "skeleton") {
    return style === "roadmap" ? "Planning roadmap…" : "Planning outline…";
  }
  return style === "roadmap" ? "Writing content…" : "Writing sections…";
}
