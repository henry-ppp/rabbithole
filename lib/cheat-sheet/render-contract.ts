import { jsonrepair } from "jsonrepair";

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
  /** True when the planner returned more sections than the parser safety ceiling. */
  sectionsTruncated?: boolean;
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
/** Safety ceiling only — not a planning guideline for the coverage planner. */
export const MAX_COVERAGE_SECTIONS = 24;
const MAX_MUST_INCLUDE_PER_SECTION = 16;

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

/** Deterministic layout: avoids sending full section subtrees to a layout agent (truncation). */
export function assembleCheatSheetTree(
  coverageMap: CoverageMap,
  sectionNodes: RenderNode[],
): RenderNode {
  const count = sectionNodes.length;
  const columns = count >= 8 ? 3 : count >= 3 ? 3 : count >= 2 ? 2 : 1;

  return {
    kind: "sheet",
    props: {
      title: coverageMap.title,
      subtitle: coverageMap.topic,
    },
    children: [
      {
        kind: "grid",
        props: { columns },
        children: sectionNodes.map((node, index) => ({
          ...node,
          layout: {
            ...node.layout,
            column: index % columns,
            density: node.layout?.density ?? "compact",
          },
        })),
      },
    ],
  };
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

export function parseCoverageMap(
  raw: unknown,
): { map: CoverageMap; sectionsTruncated: boolean } | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (typeof raw.topic !== "string" || typeof raw.title !== "string") {
    return null;
  }
  if (!Array.isArray(raw.sections)) {
    return null;
  }

  const sectionsTruncated = raw.sections.length > MAX_COVERAGE_SECTIONS;
  const sections: CoverageSection[] = [];
  for (const section of raw.sections.slice(0, MAX_COVERAGE_SECTIONS)) {
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
          .slice(0, MAX_MUST_INCLUDE_PER_SECTION)
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
    map: {
      topic: raw.topic,
      title: raw.title,
      sections,
    },
    sectionsTruncated,
  };
}

/** Index after the closing `}` or `]` of a balanced JSON value, or null if truncated. */
export function findBalancedJsonEnd(text: string, start: number): number | null {
  const first = text[start];
  if (first !== "{" && first !== "[") {
    return null;
  }

  const stack: ("" | "}" | "]")[] = [first === "{" ? "}" : "]"];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      stack.push("}");
    } else if (ch === "[") {
      stack.push("]");
    } else if (ch === "}" || ch === "]") {
      const expected = stack.pop();
      if (expected !== ch) {
        return null;
      }
      if (stack.length === 0) {
        return i + 1;
      }
    }
  }
  return null;
}

function jsonStartIndex(text: string): number {
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  if (firstBrace === -1) return firstBracket;
  if (firstBracket === -1) return firstBrace;
  return Math.min(firstBrace, firstBracket);
}

/** Remove trailing commas before `}` or `]` (common agent mistake). */
function repairTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function parseJsonCandidate(json: string, context: string): unknown {
  const attempts: string[] = [json, repairTrailingCommas(json)];
  const seen = new Set<string>();

  for (const candidate of attempts) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next */
    }
  }

  try {
    return JSON.parse(jsonrepair(json));
  } catch (repairErr) {
    const detail =
      repairErr instanceof Error ? repairErr.message : String(repairErr);
    const preview =
      json.length > 120 ? `${json.slice(0, 120)}…` : json;
    throw new Error(`${context}: ${detail} (near: ${preview})`);
  }
}

function extractBalancedJsonSlice(text: string): string {
  const start = jsonStartIndex(text);
  if (start === -1) {
    throw new Error("No JSON object or array found in agent response");
  }
  const end = findBalancedJsonEnd(text, start);
  if (end !== null) {
    return text.slice(start, end);
  }
  const partial = text.slice(start).trim();
  try {
    return jsonrepair(partial);
  } catch {
    throw new Error(
      "Incomplete JSON in agent response (truncated — nested brackets or strings not closed)",
    );
  }
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
      const fenced = fenceMatch[1].trim();
      const start = jsonStartIndex(fenced);
      if (start !== -1) {
        const end = findBalancedJsonEnd(fenced, start);
        if (end !== null) {
          return parseJsonCandidate(fenced.slice(start, end), "Fenced JSON");
        }
      }
      return parseJsonCandidate(fenced, "Fenced JSON");
    }

    const slice = extractBalancedJsonSlice(trimmed);
    return parseJsonCandidate(slice, "Extracted JSON");
  }
}
