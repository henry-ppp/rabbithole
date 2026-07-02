import type { ModuleEdge, RenderNode } from "./render-contract";

export type ConceptGraphNodeSpec = {
  id: string;
  label: string;
  layer: number;
  mustCover: string[];
  teachGoal?: string;
  hint?: string;
};

export type ConceptGraphMap = {
  topic: string;
  title: string;
  nodes: ConceptGraphNodeSpec[];
  edges: ModuleEdge[];
};

const MAX_CONCEPT_NODES = 10;
const MAX_CONCEPT_EDGES = 12;
const MAX_MUST_COVER = 4;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_RELATIONS = new Set(["requires", "leads-to", "contrasts", "part-of", "builds-on"]);

function parseEdgeList(raw: unknown): ModuleEdge[] {
  if (!Array.isArray(raw)) return [];
  const edges: ModuleEdge[] = [];
  for (const item of raw.slice(0, MAX_CONCEPT_EDGES)) {
    if (!isPlainObject(item)) continue;
    if (typeof item.from !== "string" || typeof item.to !== "string") continue;
    const relation =
      typeof item.relation === "string" && VALID_RELATIONS.has(item.relation)
        ? (item.relation as ModuleEdge["relation"] | "builds-on")
        : undefined;
    edges.push({
      from: item.from,
      to: item.to,
      ...(relation ? { relation: relation as ModuleEdge["relation"] } : {}),
    });
  }
  return edges;
}

export function parseConceptGraphMap(
  raw: unknown,
): { map: ConceptGraphMap } | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.topic !== "string" || typeof raw.title !== "string") return null;

  const graphRaw = raw.graph;
  if (!isPlainObject(graphRaw)) return null;

  const nodes: ConceptGraphNodeSpec[] = [];
  if (Array.isArray(graphRaw.nodes)) {
    for (const item of graphRaw.nodes.slice(0, MAX_CONCEPT_NODES)) {
      if (!isPlainObject(item)) continue;
      if (typeof item.id !== "string" || typeof item.label !== "string") continue;
      const layer =
        typeof item.layer === "number" && Number.isFinite(item.layer)
          ? Math.max(0, Math.min(4, Math.floor(item.layer)))
          : 0;
      const mustCover = Array.isArray(item.mustCover)
        ? item.mustCover
            .filter((entry): entry is string => typeof entry === "string")
            .slice(0, MAX_MUST_COVER)
            .map((s) => s.trim().slice(0, 160))
        : [];
      nodes.push({
        id: item.id,
        label: item.label.slice(0, 80),
        layer,
        mustCover,
        ...(typeof item.teachGoal === "string"
          ? { teachGoal: item.teachGoal.slice(0, 200) }
          : {}),
        ...(typeof item.hint === "string"
          ? { hint: item.hint.slice(0, 40) }
          : {}),
      });
    }
  }

  if (nodes.length === 0) return null;

  const edges = parseEdgeList(graphRaw.edges);

  return {
    map: {
      topic: raw.topic,
      title: raw.title,
      nodes,
      edges,
    },
  };
}

function buildFallbackConceptNode(node: ConceptGraphNodeSpec): RenderNode {
  const items = node.mustCover.filter(Boolean).slice(0, MAX_MUST_COVER);
  const children: RenderNode[] = [];

  if (items.length >= 2) {
    children.push({
      kind: "table",
      props: {
        headers: ["Term", "Plain meaning"],
        rows: items.map((item) => {
          const colon = item.indexOf(":");
          if (colon > 0 && colon < 50) {
            return [item.slice(0, colon).trim(), item.slice(colon + 1).trim()];
          }
          const dash = item.indexOf(" — ");
          if (dash > 0) {
            return [item.slice(0, dash).trim(), item.slice(dash + 3).trim()];
          }
          return [item.slice(0, 40), item.slice(40) || "—"];
        }),
      },
    });
  } else if (items.length > 0) {
    children.push({ kind: "list", props: { items } });
  }

  return {
    kind: "conceptNode",
    props: {
      id: node.id,
      label: node.label,
      layer: node.layer,
      ...(node.teachGoal ? { teachGoal: node.teachGoal } : {}),
      ...(node.hint ? { hint: node.hint } : {}),
    },
    ...(children.length > 0 ? { children } : {}),
  };
}

export function buildFallbackConceptGraphTree(map: ConceptGraphMap): RenderNode {
  return {
    kind: "conceptGraph",
    props: {
      title: map.title,
      subtitle: map.topic,
      edges: map.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        ...(edge.relation ? { relation: edge.relation } : {}),
      })),
    },
    children: map.nodes.map((node) => buildFallbackConceptNode(node)),
  };
}

const GRAPH_WRAPPER_KEYS = ["conceptGraph", "graph", "tree", "data", "result"] as const;

export function coerceConceptGraphRenderNode(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;

  if (Array.isArray(raw)) {
    const objects = raw.filter(isPlainObject);
    if (objects.length === 1) {
      return coerceConceptGraphRenderNode(objects[0]);
    }
    return raw;
  }

  if (!isPlainObject(raw)) return raw;

  for (const key of GRAPH_WRAPPER_KEYS) {
    if (key in raw && isPlainObject(raw[key])) {
      return coerceConceptGraphRenderNode(raw[key]);
    }
  }

  if (typeof raw.kind !== "string" && Array.isArray(raw.children)) {
    return {
      kind: "conceptGraph",
      props: isPlainObject(raw.props) ? raw.props : {},
      children: raw.children,
    };
  }

  return raw;
}

export function describeInvalidConceptGraphOutput(raw: unknown): string {
  if (!isPlainObject(raw)) {
    return `expected a JSON object, got ${raw === null ? "null" : typeof raw}`;
  }
  return `could not sanitize conceptGraph (kind: ${String(raw.kind)})`;
}

export function parseConceptGraphWriterOutput(
  raw: unknown,
  sanitize: (value: unknown) => RenderNode | null,
): RenderNode | null {
  const coerced = coerceConceptGraphRenderNode(raw);
  const node = sanitize(coerced);
  if (!node || node.kind !== "conceptGraph") return null;
  return node;
}

export function graphEdgesFromNode(node: RenderNode): ModuleEdge[] {
  const raw = node.props?.edges;
  if (!Array.isArray(raw)) return [];
  return parseEdgeList(raw);
}

export function validateConceptGraphTree(node: RenderNode): {
  ok: boolean;
  error?: string;
} {
  if (node.kind !== "conceptGraph") {
    return { ok: false, error: "Root must be conceptGraph" };
  }

  const conceptNodes = (node.children ?? []).filter((c) => c.kind === "conceptNode");
  if (conceptNodes.length === 0) {
    return { ok: false, error: "conceptGraph has no conceptNode children" };
  }

  const ids = new Set<string>();
  for (const child of conceptNodes) {
    const id = child.props?.id;
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, error: "conceptNode missing id" };
    }
    ids.add(id);
  }

  const edges = graphEdgesFromNode(node);
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      return {
        ok: false,
        error: `Edge references unknown node: ${edge.from} -> ${edge.to}`,
      };
    }
  }

  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const next of adj.get(id) ?? []) {
      if (!dfs(next)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  }

  for (const id of ids) {
    if (!dfs(id)) {
      return { ok: false, error: "Graph contains a cycle" };
    }
  }

  const layerInputs = conceptNodes.map((child) => ({
    id: typeof child.props?.id === "string" ? child.props.id : "",
    layer:
      typeof child.props?.layer === "number" ? child.props.layer : undefined,
  }));
  const layerById = resolveLayersById(layerInputs, edges);

  for (const edge of edges) {
    const fromLayer = layerById.get(edge.from) ?? 0;
    const toLayer = layerById.get(edge.to) ?? 0;
    if (toLayer !== fromLayer + 1) {
      return {
        ok: false,
        error: `Edge must connect adjacent layers: ${edge.from} (L${fromLayer}) -> ${edge.to} (L${toLayer})`,
      };
    }
  }

  return { ok: true };
}

export type LayoutPoint = { x: number; y: number };

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;
const LAYER_GAP_Y = 80;
const NODE_GAP_X = 48;

/** Minimum vertical pitch between layer bands (must exceed typical card height). */
export const LAYER_BAND_GAP_PX = 48;

/** Resolve effective layer per node, bumping targets below sources when edges require it. */
export function resolveLayersById(
  nodes: Array<{ id: string; layer?: number }>,
  edges: ModuleEdge[],
): Map<string, number> {
  const layerById = new Map<string, number>();
  for (const node of nodes) {
    layerById.set(node.id, node.layer ?? 0);
  }

  for (const edge of edges) {
    const fromLayer = layerById.get(edge.from) ?? 0;
    const toLayer = layerById.get(edge.to) ?? 0;
    if (toLayer <= fromLayer) {
      layerById.set(edge.to, fromLayer + 1);
    }
  }

  return layerById;
}

/** Group node ids by resolved layer index (sorted ascending when iterated). */
export function groupNodesByLayer(
  nodes: Array<{ id: string; layer?: number }>,
  edges: ModuleEdge[],
): Map<number, string[]> {
  const layerById = resolveLayersById(nodes, edges);
  const byLayer = new Map<number, string[]>();
  for (const node of nodes) {
    const layer = layerById.get(node.id) ?? 0;
    const bucket = byLayer.get(layer) ?? [];
    bucket.push(node.id);
    byLayer.set(layer, bucket);
  }
  return byLayer;
}

/** Layered DAG layout: layer 0 at top, increasing downward. */
export function layoutConceptGraph(
  nodes: Array<{ id: string; layer?: number }>,
  edges: ModuleEdge[],
): Map<string, LayoutPoint> {
  const byLayer = groupNodesByLayer(nodes, edges);

  const positions = new Map<string, LayoutPoint>();
  const layers = Array.from(byLayer.keys()).sort((a, b) => a - b);

  for (const layer of layers) {
    const ids = byLayer.get(layer) ?? [];
    const rowWidth =
      ids.length * NODE_WIDTH + Math.max(0, ids.length - 1) * NODE_GAP_X;
    let x = -rowWidth / 2 + NODE_WIDTH / 2;
    const y = layer * (NODE_HEIGHT + LAYER_GAP_Y);

    for (const id of ids) {
      positions.set(id, { x, y });
      x += NODE_WIDTH + NODE_GAP_X;
    }
  }

  return positions;
}

export function layoutBounds(
  positions: Map<string, LayoutPoint>,
): { width: number; height: number; minX: number; minY: number } {
  let minX = 0;
  let maxX = NODE_WIDTH;
  let minY = 0;
  let maxY = NODE_HEIGHT;

  for (const point of positions.values()) {
    minX = Math.min(minX, point.x - NODE_WIDTH / 2);
    maxX = Math.max(maxX, point.x + NODE_WIDTH / 2);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y + NODE_HEIGHT);
  }

  return {
    minX,
    minY,
    width: maxX - minX + 80,
    height: maxY - minY + 80,
  };
}

export { NODE_WIDTH, NODE_HEIGHT };
