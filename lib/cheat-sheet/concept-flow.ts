import type { Edge, Node } from "@xyflow/react";
import type { ModuleEdge } from "./render-contract";
import type { RenderNode } from "./render-contract";
import {
  graphEdgesFromNode,
  groupNodesByLayer,
  resolveLayersById,
} from "./concept-graph";

export type ConceptNodeData = {
  id: string;
  label: string;
  hint: string;
  layer: number;
  teachGoal: string;
  keyTerms: string[];
  expanded: boolean;
  dimmed: boolean;
};

export type ConceptEdgeData = {
  highlighted: boolean;
};

export type NodeSize = { width: number; height: number };

const COLLAPSED_WIDTH = 148;
const COLLAPSED_HEIGHT = 52;
const EXPANDED_WIDTH = 200;
const EXPANDED_HEIGHT = 118;
const BAND_GAP_X = 48;
const BAND_GAP_Y = 80;
const CANVAS_PADDING_X = 32;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function tableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell)));
}

function keyTermsFromNode(child: RenderNode): string[] {
  const terms: string[] = [];
  for (const content of child.children ?? []) {
    if (content.kind === "table") {
      for (const row of tableRows(content.props?.rows).slice(0, 3)) {
        const cell = row[0]?.trim();
        if (cell) {
          const colon = cell.indexOf("=");
          terms.push(colon > 0 ? cell.slice(0, colon).trim() : cell.slice(0, 40));
        }
      }
    } else if (content.kind === "list") {
      const items = content.props?.items;
      if (Array.isArray(items)) {
        for (const item of items.slice(0, 3)) {
          if (typeof item === "string" && item.trim()) {
            terms.push(item.trim().slice(0, 40));
          }
        }
      }
    }
  }
  return terms.slice(0, 3);
}

function defaultNodeSize(expanded: boolean): NodeSize {
  return expanded
    ? { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
    : { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT };
}

function nodeSize(
  id: string,
  expanded: boolean,
  measured?: Map<string, NodeSize>,
): NodeSize {
  return measured?.get(id) ?? defaultNodeSize(expanded);
}

function barycenter(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Order node ids within each layer so connected pairs align vertically. */
export function orderNodesByBarycenter(
  layerGroups: Map<number, string[]>,
  edges: ModuleEdge[],
  layerById: Map<string, number>,
): Map<number, string[]> {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const out = outgoing.get(edge.from) ?? [];
    out.push(edge.to);
    outgoing.set(edge.from, out);
    const inc = incoming.get(edge.to) ?? [];
    inc.push(edge.from);
    incoming.set(edge.to, inc);
  }

  const ordered = new Map<number, string[]>();
  for (const [layer, ids] of layerGroups) {
    ordered.set(layer, [...ids]);
  }

  const layers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
  if (layers.length === 0) return ordered;

  const indexInLayer = (layer: number, id: string): number => {
    const list = ordered.get(layer) ?? [];
    return list.indexOf(id);
  };

  for (let pass = 0; pass < 4; pass++) {
    for (const layer of layers) {
      if (layer === layers[0]) continue;
      const ids = [...(ordered.get(layer) ?? [])];
      const scored = ids.map((id) => {
        const parents = incoming.get(id) ?? [];
        const parentLayer = layer - 1;
        const parentIndices = parents
          .filter((parentId) => (layerById.get(parentId) ?? 0) === parentLayer)
          .map((parentId) => indexInLayer(parentLayer, parentId));
        return { id, score: barycenter(parentIndices) };
      });
      scored.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
      ordered.set(
        layer,
        scored.map((entry) => entry.id),
      );
    }

    for (let i = layers.length - 2; i >= 0; i--) {
      const layer = layers[i]!;
      const ids = [...(ordered.get(layer) ?? [])];
      const scored = ids.map((id) => {
        const children = outgoing.get(id) ?? [];
        const childLayer = layer + 1;
        const childIndices = children
          .filter((childId) => (layerById.get(childId) ?? 0) === childLayer)
          .map((childId) => indexInLayer(childLayer, childId));
        return { id, score: barycenter(childIndices) };
      });
      scored.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
      ordered.set(
        layer,
        scored.map((entry) => entry.id),
      );
    }
  }

  return ordered;
}

export function parseConceptNodesFromTree(node: RenderNode): Omit<
  ConceptNodeData,
  "expanded" | "dimmed"
>[] {
  const result: Omit<ConceptNodeData, "expanded" | "dimmed">[] = [];
  for (const child of node.children ?? []) {
    if (child.kind !== "conceptNode") continue;
    const id = str(child.props?.id);
    if (!id) continue;

    result.push({
      id,
      label: str(child.props?.label, id),
      hint: str(child.props?.hint),
      layer: typeof child.props?.layer === "number" ? child.props.layer : 0,
      teachGoal: str(child.props?.teachGoal),
      keyTerms: keyTermsFromNode(child),
    });
  }
  return result;
}

export function upstreamPath(
  targetId: string,
  edges: Array<{ from: string; to: string }>,
): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.to) ?? [];
    list.push(edge.from);
    incoming.set(edge.to, list);
  }

  const path = new Set<string>([targetId]);
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const parent of incoming.get(current) ?? []) {
      if (!path.has(parent)) {
        path.add(parent);
        queue.push(parent);
      }
    }
  }

  return path;
}

export function layoutConceptFlowByLayer(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  graphEdges: ModuleEdge[],
  measured?: Map<string, NodeSize>,
): Node<ConceptNodeData>[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const layerInputs = nodes.map((node) => ({
    id: node.id,
    layer: node.data.layer,
  }));
  const layerById = resolveLayersById(layerInputs, graphEdges);
  const layerGroups = groupNodesByLayer(layerInputs, graphEdges);
  const orderedLayers = orderNodesByBarycenter(layerGroups, graphEdges, layerById);

  const bandHeights = new Map<number, number>();
  const bandWidths = new Map<number, number>();
  const layers = Array.from(orderedLayers.keys()).sort((a, b) => a - b);

  for (const layer of layers) {
    const ids = orderedLayers.get(layer) ?? [];
    let maxHeight = 0;
    let totalWidth = 0;
    ids.forEach((id, index) => {
      const node = nodeById.get(id);
      const size = nodeSize(id, node?.data.expanded ?? false, measured);
      maxHeight = Math.max(maxHeight, size.height);
      totalWidth += size.width;
      if (index > 0) totalWidth += BAND_GAP_X;
    });
    bandHeights.set(layer, maxHeight);
    bandWidths.set(layer, totalWidth);
  }

  const canvasWidth =
    Math.max(...Array.from(bandWidths.values()), COLLAPSED_WIDTH) +
    CANVAS_PADDING_X * 2;

  let y = CANVAS_PADDING_X;
  const positions = new Map<string, { x: number; y: number }>();

  for (const layer of layers) {
    const ids = orderedLayers.get(layer) ?? [];
    const bandHeight = bandHeights.get(layer) ?? COLLAPSED_HEIGHT;
    const rowWidth = bandWidths.get(layer) ?? COLLAPSED_WIDTH;
    let x = (canvasWidth - rowWidth) / 2;

    for (const id of ids) {
      const node = nodeById.get(id);
      const size = nodeSize(id, node?.data.expanded ?? false, measured);
      positions.set(id, { x, y });
      x += size.width + BAND_GAP_X;
    }

    y += bandHeight + BAND_GAP_Y;
  }

  return nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return { ...node, position: pos };
  });
}

export function conceptGraphToFlowElements(
  tree: RenderNode,
  expandedId: string | null,
  highlightIds: Set<string> | null,
  measured?: Map<string, NodeSize>,
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const concepts = parseConceptNodesFromTree(tree);
  const graphEdges = graphEdgesFromNode(tree);

  const nodes: Node<ConceptNodeData>[] = concepts.map((concept) => ({
    id: concept.id,
    type: "concept",
    position: { x: 0, y: 0 },
    data: {
      ...concept,
      expanded: expandedId === concept.id,
      dimmed:
        highlightIds !== null &&
        expandedId !== null &&
        !highlightIds.has(concept.id),
    },
  }));

  const edges: Edge[] = graphEdges.map((edge, index) => {
    const highlighted =
      highlightIds !== null &&
      highlightIds.has(edge.from) &&
      highlightIds.has(edge.to);

    return {
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      type: "concept",
      animated: false,
      data: {
        highlighted,
      } satisfies ConceptEdgeData,
    };
  });

  const laidOutNodes = layoutConceptFlowByLayer(
    nodes,
    edges,
    graphEdges,
    measured,
  );

  return { nodes: laidOutNodes, edges };
}

/** @deprecated Use layoutConceptFlowByLayer via conceptGraphToFlowElements */
export function layoutConceptFlow(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  graphEdges: ModuleEdge[] = [],
  measured?: Map<string, NodeSize>,
): Node<ConceptNodeData>[] {
  if (graphEdges.length === 0) {
    graphEdges = edges.map((edge) => ({
      from: edge.source,
      to: edge.target,
    }));
  }
  return layoutConceptFlowByLayer(nodes, edges, graphEdges, measured);
}

export {
  BAND_GAP_X,
  BAND_GAP_Y,
  COLLAPSED_WIDTH,
  COLLAPSED_HEIGHT,
  EXPANDED_WIDTH,
  EXPANDED_HEIGHT,
};
