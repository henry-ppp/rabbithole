export type LayoutHint = {
  column?: number;
  span?: number;
  priority?: "primary" | "secondary";
  density?: "compact" | "normal";
};

export type RenderNode = {
  kind: string;
  props?: Record<string, unknown>;
  children?: RenderNode[];
  layout?: LayoutHint;
};

export type CoverageSection = {
  id: string;
  title: string;
  goal: string;
  mustInclude: string[];
  density?: "compact" | "normal";
  order?: number;
};

export type CoverageMap = {
  topic: string;
  title: string;
  sections: CoverageSection[];
};

export type CheatSheetMeta = {
  coverageMap?: CoverageMap;
  phases: Array<{
    name: string;
    status: "ok" | "error" | "skipped";
    runId?: string;
    error?: string;
  }>;
  source: "agent" | "fixture";
};

export type CheatSheetResponse = {
  tree: RenderNode;
  meta: CheatSheetMeta;
};

const MAX_DEPTH = 12;
const MAX_NODES = 500;
const MAX_STRING_LENGTH = 8_000;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeRenderNode(raw: unknown, depth = 0): RenderNode | null {
  if (depth > MAX_DEPTH || raw === null || raw === undefined) {
    return null;
  }

  if (!isPlainObject(raw) || typeof raw.kind !== "string" || !raw.kind.trim()) {
    return null;
  }

  const kind = raw.kind.trim().slice(0, 64);
  const props = sanitizeProps(raw.props);
  const layout = sanitizeLayout(raw.layout);
  const children: RenderNode[] = [];

  if (Array.isArray(raw.children)) {
    for (const child of raw.children) {
      const sanitized = sanitizeRenderNode(child, depth + 1);
      if (sanitized) {
        children.push(sanitized);
      }
    }
  }

  const node: RenderNode = { kind };
  if (props && Object.keys(props).length > 0) {
    node.props = props;
  }
  if (layout) {
    node.layout = layout;
  }
  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

function sanitizeProps(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof key !== "string" || key.length > 64) {
      continue;
    }
    const sanitized = sanitizePropValue(val);
    if (sanitized !== undefined) {
      out[key] = sanitized;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizePropValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value.slice(0, MAX_STRING_LENGTH);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 64)
      .map((item) => sanitizePropValue(item))
      .filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const nested: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= 32) break;
      nested[k] = sanitizePropValue(v);
      count += 1;
    }
    return nested;
  }
  return undefined;
}

function sanitizeLayout(value: unknown): LayoutHint | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const layout: LayoutHint = {};
  if (typeof value.column === "number" && Number.isFinite(value.column)) {
    layout.column = Math.max(0, Math.min(5, Math.floor(value.column)));
  }
  if (typeof value.span === "number" && Number.isFinite(value.span)) {
    layout.span = Math.max(1, Math.min(3, Math.floor(value.span)));
  }
  if (value.priority === "primary" || value.priority === "secondary") {
    layout.priority = value.priority;
  }
  if (value.density === "compact" || value.density === "normal") {
    layout.density = value.density;
  }
  return Object.keys(layout).length > 0 ? layout : undefined;
}

export function countNodes(node: RenderNode): number {
  let count = 1;
  for (const child of node.children ?? []) {
    count += countNodes(child);
  }
  return count;
}

export function validateRenderTree(node: RenderNode): {
  ok: boolean;
  error?: string;
} {
  const total = countNodes(node);
  if (total > MAX_NODES) {
    return { ok: false, error: `Tree exceeds max nodes (${MAX_NODES})` };
  }
  return { ok: true };
}

export function parseCoverageMap(raw: unknown): CoverageMap | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (typeof raw.topic !== "string" || typeof raw.title !== "string") {
    return null;
  }
  if (!Array.isArray(raw.sections)) {
    return null;
  }

  const sections: CoverageSection[] = [];
  for (const section of raw.sections.slice(0, 8)) {
    if (!isPlainObject(section)) continue;
    if (
      typeof section.id !== "string" ||
      typeof section.title !== "string" ||
      typeof section.goal !== "string"
    ) {
      continue;
    }
    const mustInclude = Array.isArray(section.mustInclude)
      ? section.mustInclude
          .filter((item): item is string => typeof item === "string")
          .slice(0, 12)
      : [];
    sections.push({
      id: section.id,
      title: section.title,
      goal: section.goal,
      mustInclude,
      density:
        section.density === "compact" || section.density === "normal"
          ? section.density
          : undefined,
      order: typeof section.order === "number" ? section.order : undefined,
    });
  }

  if (sections.length === 0) {
    return null;
  }

  return {
    topic: raw.topic,
    title: raw.title,
    sections,
  };
}

export function extractJsonFromAgentText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty agent response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim());
    }
    const firstBrace = trimmed.indexOf("{");
    const firstBracket = trimmed.indexOf("[");
    const start =
      firstBrace === -1
        ? firstBracket
        : firstBracket === -1
          ? firstBrace
          : Math.min(firstBrace, firstBracket);
    if (start === -1) {
      throw new Error("No JSON object found in agent response");
    }
    const slice = trimmed.slice(start);
    const lastBrace = slice.lastIndexOf("}");
    const lastBracket = slice.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    if (end === -1) {
      throw new Error("Incomplete JSON in agent response");
    }
    return JSON.parse(slice.slice(0, end + 1));
  }
}
