import type { CheatSheetResponse } from "./render-contract";

export const MAX_NAV_DEPTH = 8;
export const MAX_TOPIC_LENGTH = 200;
export const MAX_DRILL_LABEL_LENGTH = 120;

export type DrillSourceKind = "module";

export type DrillTarget = {
  label: string;
  sourceKind: DrillSourceKind;
};

export type CheatSheetFrame = {
  id: string;
  label: string;
  topic: string;
  response: CheatSheetResponse;
  /** Cumulative retrials at this level (agent JSON retries + user regenerations). */
  retrialCount: number;
};

export function agentRetrialCount(response: CheatSheetResponse): number {
  return response.meta.retrialCount ?? 0;
}

export function normalizeDrillLabel(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length > MAX_DRILL_LABEL_LENGTH
    ? trimmed.slice(0, MAX_DRILL_LABEL_LENGTH)
    : trimmed;
}

export function cacheKey(
  topic: string,
  audience?: string,
  depth?: string,
): string {
  return JSON.stringify({
    topic: topic.trim(),
    audience: audience?.trim() ?? "",
    depth: depth?.trim() ?? "",
  });
}

export function truncateTopic(topic: string): string {
  const trimmed = topic.trim();
  if (trimmed.length <= MAX_TOPIC_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_TOPIC_LENGTH);
}

/** Build API topic for a drill from the current stack and clicked label. */
export function composeChildTopic(
  ancestors: CheatSheetFrame[],
  target: DrillTarget,
): string {
  const label = normalizeDrillLabel(target.label);
  if (!label) return "";

  const root = ancestors[0];
  if (!root) return truncateTopic(label);

  const childLabels = ancestors.slice(1).map((frame) => frame.label);
  if (childLabels.length === 0) {
    return truncateTopic(`${root.topic} — ${label}`);
  }

  const path = [root.topic, ...childLabels].join(" › ");
  return truncateTopic(`${path} — ${label}`);
}

export function canDrillDeeper(stackLength: number): boolean {
  return stackLength < MAX_NAV_DEPTH;
}

export function codeDrillLabel(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  const base = firstLine || trimmed;
  return normalizeDrillLabel(
    base.length > 80 ? base.slice(0, 80) : base,
  );
}

export function createFrame(
  label: string,
  topic: string,
  response: CheatSheetResponse,
  retrialCount = agentRetrialCount(response),
): CheatSheetFrame {
  return {
    id: crypto.randomUUID(),
    label: normalizeDrillLabel(label) || topic.slice(0, 40),
    topic: truncateTopic(topic),
    response,
    retrialCount,
  };
}
