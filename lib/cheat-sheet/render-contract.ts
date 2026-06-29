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

export type ModuleEdge = {
  from: string;
  to: string;
  relation?: "requires" | "leads-to" | "contrasts" | "part-of";
};

export type ModuleNode = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  /** 1–2 teach-now concepts owned by this module. */
  anchors?: AnchorKnowledge[];
};

export type AnchorKnowledge = {
  id: string;
  label: string;
  teachGoal: string;
  mustCover: string[];
};

export type CoverageSection = {
  id: string;
  title: string;
  goal: string;
  /** MECE drill modules (3–5 per sheet), each with inline anchor previews. */
  modules?: ModuleNode[];
  edges?: ModuleEdge[];
  /** Legacy dense mode when anchors/modules are absent. */
  mustInclude?: string[];
  density?: "compact" | "normal";
  order?: number;
};

/** @deprecated Use ModuleEdge */
export type SubtopicEdge = ModuleEdge;
/** @deprecated Use ModuleNode */
export type SubtopicNode = ModuleNode;

export function hasThreeLayerSection(section: CoverageSection): boolean {
  return (section.modules?.length ?? 0) > 0;
}

export type CoverageMap = {
  topic: string;
  title: string;
  sections: CoverageSection[];
};

export type CheatSheetMeta = {
  coverageMap?: CoverageMap;
  /** True when the planner returned more sections than the parser safety ceiling. */
  sectionsTruncated?: boolean;
  /** Agent JSON parse retries during this generation (excludes the initial attempt). */
  retrialCount?: number;
  /** Non-fatal issues (e.g. agent fallback sections). */
  warnings?: string[];
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
/** Planner guideline: one section per sheet. */
export const MAX_SECTIONS_PER_SHEET = 1;
export const MAX_COVERAGE_SECTIONS = 24;
const MAX_MUST_INCLUDE_PER_SECTION = 16;
export const MAX_ANCHORS_PER_MODULE = 2;
const MAX_MODULES_PER_SECTION = 5;
const MAX_EDGES_PER_SECTION = 4;
const MAX_MUST_COVER_PER_ANCHOR = 6;

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

const SECTION_WRAPPER_KEYS = [
  "section",
  "subtree",
  "node",
  "renderNode",
  "RenderNode",
  "data",
  "result",
  "output",
] as const;

/** Normalize common agent mistakes before sanitizeRenderNode. */
export function coerceSectionRenderNode(
  raw: unknown,
  fallbackTitle?: string,
): unknown {
  if (raw === null || raw === undefined) {
    return raw;
  }

  if (Array.isArray(raw)) {
    const objects = raw.filter(isPlainObject);
    if (objects.length === 0) {
      return raw;
    }
    if (objects.length === 1) {
      return coerceSectionRenderNode(objects[0], fallbackTitle);
    }
    const first = objects[0];
    if (
      typeof first.kind === "string" &&
      first.kind === "section" &&
      Array.isArray(first.children)
    ) {
      return coerceSectionRenderNode(first, fallbackTitle);
    }
    return {
      kind: "section",
      props: {
        title:
          fallbackTitle ??
          (typeof first.props === "object" &&
          first.props !== null &&
          !Array.isArray(first.props) &&
          typeof (first.props as Record<string, unknown>).title === "string"
            ? (first.props as Record<string, unknown>).title
            : "Section"),
      },
      children: objects,
    };
  }

  if (!isPlainObject(raw)) {
    return raw;
  }

  for (const key of SECTION_WRAPPER_KEYS) {
    if (key in raw && isPlainObject(raw[key])) {
      return coerceSectionRenderNode(raw[key], fallbackTitle);
    }
  }

  if (typeof raw.kind !== "string") {
    const withChildren = Array.isArray(raw.children);
    const title =
      typeof raw.title === "string"
        ? raw.title
        : isPlainObject(raw.props) && typeof raw.props.title === "string"
          ? raw.props.title
          : fallbackTitle;
    if (withChildren || title) {
      const props =
        isPlainObject(raw.props) && typeof raw.props === "object"
          ? { ...raw.props }
          : {};
      if (title && typeof props.title !== "string") {
        props.title = title;
      }
      return {
        kind: "section",
        props: Object.keys(props).length > 0 ? props : { title: fallbackTitle ?? "Section" },
        children: raw.children,
        layout: raw.layout,
      };
    }
  }

  if (
    typeof raw.kind === "string" &&
    raw.kind !== "section" &&
    Array.isArray(raw.children)
  ) {
    return { ...raw, kind: "section" };
  }

  return raw;
}

export function describeInvalidSectionOutput(raw: unknown): string {
  if (Array.isArray(raw)) {
    return `expected one section object, got an array of length ${raw.length}`;
  }
  if (!isPlainObject(raw)) {
    return `expected a JSON object, got ${raw === null ? "null" : typeof raw}`;
  }
  const keys = Object.keys(raw).slice(0, 8).join(", ");
  if (typeof raw.kind !== "string" || !raw.kind.trim()) {
    return `missing or empty "kind" (keys: ${keys})`;
  }
  return `could not sanitize subtree with kind "${raw.kind}" (keys: ${keys})`;
}

/** Display label for props.title; preserves parenthetical context, truncates only when over maxLen. */
export function shortSectionTitle(title: string, maxLen = 48): string {
  const trimmed = title.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function sheetSubtitle(coverageMap: CoverageMap): string {
  const sectionTitle = coverageMap.sections[0]?.title?.trim();
  if (sectionTitle && !titlesMatch(sectionTitle, coverageMap.title)) {
    return sectionTitle;
  }
  return coverageMap.topic;
}

function buildFallbackAnchorNode(anchor: AnchorKnowledge): RenderNode {
  const items = anchor.mustCover
    .filter((item) => item.trim())
    .slice(0, MAX_MUST_COVER_PER_ANCHOR)
    .map((item) => item.trim().slice(0, 160));

  const children: RenderNode[] = [];
  if (anchor.teachGoal.trim()) {
    children.push({
      kind: "text",
      props: { content: anchor.teachGoal.trim().slice(0, 200) },
    });
  }
  if (items.length > 0) {
    children.push({
      kind: "list",
      props: { items },
    });
  }

  return {
    kind: "anchor",
    props: {
      id: anchor.id,
      label: anchor.label.slice(0, 80),
      teachGoal: anchor.teachGoal.slice(0, 200),
    },
    children,
  };
}

function buildFallbackModuleNode(module: ModuleNode): RenderNode {
  const children: RenderNode[] = [];
  for (const anchor of (module.anchors ?? []).slice(0, MAX_ANCHORS_PER_MODULE)) {
    children.push(buildFallbackAnchorNode(anchor));
  }

  return {
    kind: "module",
    props: {
      id: module.id,
      label: module.label.slice(0, 80),
      ...(module.hint ? { hint: module.hint.slice(0, 40) } : {}),
      ...(module.group ? { group: module.group.slice(0, 40) } : {}),
    },
    ...(children.length > 0 ? { children } : {}),
  };
}

function serializeModuleEdges(edges: ModuleEdge[]): Record<string, unknown>[] {
  return edges.slice(0, MAX_EDGES_PER_SECTION).map((edge) => ({
    from: edge.from,
    to: edge.to,
    ...(edge.relation ? { relation: edge.relation } : {}),
  }));
}

/** Deterministic section when the agent returns truncated or invalid JSON. */
export function buildFallbackSectionNode(section: CoverageSection): RenderNode {
  const title = shortSectionTitle(section.title);
  const children: RenderNode[] = [];

  if (section.goal.trim()) {
    children.push({
      kind: "text",
      props: { content: section.goal.trim().slice(0, 200) },
    });
  }

  if (hasThreeLayerSection(section)) {
    for (const module of (section.modules ?? []).slice(0, MAX_MODULES_PER_SECTION)) {
      children.push(buildFallbackModuleNode(module));
    }

    if (children.length === 0) {
      children.push({
        kind: "text",
        props: { content: "Content unavailable — regenerate this section." },
      });
    }

    const edges = section.edges ?? [];
    return {
      kind: "section",
      props: {
        title,
        ...(edges.length > 0
          ? { moduleEdges: serializeModuleEdges(edges) }
          : {}),
      },
      layout: { density: section.density ?? "compact" },
      children,
    };
  }

  const items = (section.mustInclude ?? [])
    .filter((item) => typeof item === "string" && item.trim())
    .slice(0, 16)
    .map((item) => item.trim().slice(0, 160));

  if (items.length >= 6) {
    children.push({
      kind: "table",
      props: {
        headers: ["Point", "Notes"],
        rows: items.map((item) => {
          const colon = item.indexOf(":");
          if (colon > 0 && colon < 60) {
            return [
              item.slice(0, colon).trim().slice(0, 48),
              item.slice(colon + 1).trim().slice(0, 120),
            ];
          }
          return [item.slice(0, 48), item.slice(48, 168) || "—"];
        }),
      },
    });
  } else if (items.length > 0) {
    children.push({
      kind: "list",
      props: { items },
    });
  } else {
    children.push({
      kind: "text",
      props: { content: "Content unavailable — regenerate this section." },
    });
  }

  return {
    kind: "section",
    props: { title },
    layout: { density: section.density ?? "compact" },
    children,
  };
}

export function parseSectionWriterOutput(
  raw: unknown,
  sectionTitle: string,
): RenderNode | null {
  const coerced = coerceSectionRenderNode(raw, sectionTitle);
  const node = sanitizeRenderNode(coerced);
  if (node) {
    if (node.kind === "section" && node.props?.title === undefined && sectionTitle) {
      node.props = { ...node.props, title: sectionTitle };
    }
    return node;
  }
  return null;
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

function sectionHasModuleMap(node: RenderNode): boolean {
  if (node.kind === "moduleMap" || node.kind === "topicMap") {
    return true;
  }
  return (node.children ?? []).some((child) => sectionHasModuleMap(child));
}

function titlesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Deterministic layout: one full-width section per sheet. */
export function assembleCheatSheetTree(
  coverageMap: CoverageMap,
  sectionNodes: RenderNode[],
): RenderNode {
  const primarySection = sectionNodes[0];
  if (!primarySection) {
    return {
      kind: "sheet",
      props: {
        title: coverageMap.title,
        subtitle: sheetSubtitle(coverageMap),
      },
      children: [],
    };
  }

  const sectionTitle = String(primarySection.props?.title ?? "");
  const hideTitle =
    titlesMatch(sectionTitle, coverageMap.title) ||
    titlesMatch(sectionTitle, coverageMap.topic);

  const sectionNode: RenderNode = {
    ...primarySection,
    props: {
      ...primarySection.props,
      ...(hideTitle ? { hideTitle: true } : {}),
    },
    layout: {
      ...primarySection.layout,
      column: 0,
      span: 1,
      density: primarySection.layout?.density ?? "compact",
    },
  };

  return {
    kind: "sheet",
    props: {
      title: coverageMap.title,
      subtitle: sheetSubtitle(coverageMap),
    },
    children: [
      {
        kind: "grid",
        props: { columns: 1 },
        children: [sectionNode],
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

const VALID_EDGE_RELATIONS = new Set([
  "requires",
  "leads-to",
  "contrasts",
  "part-of",
]);

type LegacyAnchorKnowledge = AnchorKnowledge & {
  linkedModules?: string[];
};

function parseAnchorKnowledgeList(
  raw: unknown,
  maxCount = MAX_ANCHORS_PER_MODULE,
): AnchorKnowledge[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const anchors: AnchorKnowledge[] = [];
  for (const item of raw.slice(0, maxCount)) {
    if (!isPlainObject(item)) continue;
    if (
      typeof item.id !== "string" ||
      typeof item.label !== "string" ||
      typeof item.teachGoal !== "string"
    ) {
      continue;
    }

    const mustCover = Array.isArray(item.mustCover)
      ? item.mustCover
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, MAX_MUST_COVER_PER_ANCHOR)
      : [];

    anchors.push({
      id: item.id,
      label: item.label,
      teachGoal: item.teachGoal,
      mustCover,
    });
  }

  return anchors;
}

function parseLegacyAnchorList(raw: unknown): LegacyAnchorKnowledge[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const anchors: LegacyAnchorKnowledge[] = [];
  for (const item of raw.slice(0, MAX_MODULES_PER_SECTION * MAX_ANCHORS_PER_MODULE)) {
    if (!isPlainObject(item)) continue;
    if (
      typeof item.id !== "string" ||
      typeof item.label !== "string" ||
      typeof item.teachGoal !== "string"
    ) {
      continue;
    }

    const mustCover = Array.isArray(item.mustCover)
      ? item.mustCover
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, MAX_MUST_COVER_PER_ANCHOR)
      : [];

    const linkedModules = Array.isArray(item.linkedModules)
      ? item.linkedModules
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, 8)
      : Array.isArray(item.linkedSubtopics)
        ? item.linkedSubtopics
            .filter((entry): entry is string => typeof entry === "string")
            .slice(0, 8)
        : undefined;

    anchors.push({
      id: item.id,
      label: item.label,
      teachGoal: item.teachGoal,
      mustCover,
      ...(linkedModules && linkedModules.length > 0 ? { linkedModules } : {}),
    });
  }

  return anchors;
}

function distributeLegacySectionAnchors(
  modules: ModuleNode[],
  legacyAnchors: LegacyAnchorKnowledge[],
): ModuleNode[] {
  if (legacyAnchors.length === 0) {
    return modules;
  }

  const result: ModuleNode[] = modules.map((module) => ({
    ...module,
    anchors: [...(module.anchors ?? [])],
  }));

  if (result.length === 0) {
    return [
      {
        id: "overview",
        label: "Overview",
        anchors: legacyAnchors
          .slice(0, MAX_ANCHORS_PER_MODULE)
          .map(({ linkedModules: _, ...anchor }) => anchor),
      },
    ];
  }

  const unassigned: LegacyAnchorKnowledge[] = [];

  for (const anchor of legacyAnchors) {
    const linked = anchor.linkedModules ?? [];
    let placed = false;

    for (const id of linked) {
      const target = result.find((module) => module.id === id);
      if (!target) continue;
      target.anchors ??= [];
      if (target.anchors.length >= MAX_ANCHORS_PER_MODULE) continue;
      const { linkedModules: _, ...rest } = anchor;
      target.anchors.push(rest);
      placed = true;
    }

    if (!placed) {
      unassigned.push(anchor);
    }
  }

  for (const anchor of unassigned) {
    const target =
      result.find(
        (module) => (module.anchors?.length ?? 0) < MAX_ANCHORS_PER_MODULE,
      ) ?? result[0];
    target.anchors ??= [];
    if (target.anchors.length >= MAX_ANCHORS_PER_MODULE) continue;
    const { linkedModules: _, ...rest } = anchor;
    target.anchors.push(rest);
  }

  return result;
}

function parseModuleNodeList(raw: unknown, legacyRaw?: unknown): ModuleNode[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(legacyRaw)
      ? legacyRaw
      : null;
  if (!source) {
    return [];
  }

  const nodes: ModuleNode[] = [];
  for (const item of source.slice(0, MAX_MODULES_PER_SECTION)) {
    if (!isPlainObject(item)) continue;
    if (typeof item.id !== "string" || typeof item.label !== "string") {
      continue;
    }

    const anchors = parseAnchorKnowledgeList(item.anchors);
    nodes.push({
      id: item.id,
      label: item.label,
      ...(typeof item.hint === "string" ? { hint: item.hint.slice(0, 40) } : {}),
      ...(typeof item.group === "string" ? { group: item.group.slice(0, 40) } : {}),
      ...(anchors.length > 0 ? { anchors } : {}),
    });
  }

  return nodes;
}

function parseModuleEdgeList(raw: unknown): ModuleEdge[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const edges: ModuleEdge[] = [];
  for (const item of raw.slice(0, MAX_EDGES_PER_SECTION)) {
    if (!isPlainObject(item)) continue;
    if (typeof item.from !== "string" || typeof item.to !== "string") {
      continue;
    }

    const relation =
      typeof item.relation === "string" &&
      VALID_EDGE_RELATIONS.has(item.relation)
        ? (item.relation as ModuleEdge["relation"])
        : undefined;

    edges.push({
      from: item.from,
      to: item.to,
      ...(relation ? { relation } : {}),
    });
  }

  return edges;
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

  const sectionsTruncated =
    raw.sections.length > MAX_SECTIONS_PER_SHEET ||
    raw.sections.length > MAX_COVERAGE_SECTIONS;
  const sections: CoverageSection[] = [];
  for (const section of raw.sections.slice(0, MAX_SECTIONS_PER_SHEET)) {
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

    const legacyAnchors = parseLegacyAnchorList(section.anchors);
    let modules = parseModuleNodeList(section.modules, section.subtopics);
    if (legacyAnchors.length > 0) {
      modules = distributeLegacySectionAnchors(modules, legacyAnchors);
    }
    const edges = parseModuleEdgeList(section.edges);

    const parsed: CoverageSection = {
      id: section.id,
      title: section.title,
      goal: section.goal,
      density:
        section.density === "compact" || section.density === "normal"
          ? section.density
          : undefined,
      order: typeof section.order === "number" ? section.order : undefined,
    };

    if (modules.length > 0) {
      parsed.modules = modules;
    }
    if (edges.length > 0) {
      parsed.edges = edges;
    }
    if (mustInclude.length > 0) {
      parsed.mustInclude = mustInclude;
    }

    sections.push(parsed);
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
    const closed = closeTruncatedJson(partial);
    if (closed) {
      try {
        return jsonrepair(closed);
      } catch {
        /* fall through */
      }
    }
    throw new Error(
      "Incomplete JSON in agent response (truncated — nested brackets or strings not closed)",
    );
  }
}

/** Close open strings/brackets so jsonrepair has a chance on hard truncation. */
function closeTruncatedJson(partial: string): string | null {
  let inString = false;
  let escaped = false;
  const stack: ("" | "}" | "]")[] = [];

  for (let i = 0; i < partial.length; i++) {
    const ch = partial[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      const expected = stack.pop();
      if (expected !== ch) return null;
    }
  }

  let closed = partial;
  if (inString) closed += '"';
  while (stack.length > 0) {
    closed += stack.pop();
  }
  return closed.length > partial.length ? closed : null;
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
