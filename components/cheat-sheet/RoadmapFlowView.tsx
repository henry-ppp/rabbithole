"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  MarkerType,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RenderNode } from "@/lib/cheat-sheet/render-contract";
import {
  conceptGraphToFlowElements,
  upstreamPath,
  type ConceptNodeData,
  type NodeSize,
} from "@/lib/cheat-sheet/concept-flow";
import { graphEdgesFromNode } from "@/lib/cheat-sheet/concept-graph";
import { ConceptFlowNode } from "@/components/cheat-sheet/ConceptFlowNode";
import { ConceptEdge } from "@/components/cheat-sheet/ConceptEdge";
import { CanvasToolbar } from "@/components/cheat-sheet/CanvasToolbar";

const nodeTypes = { concept: ConceptFlowNode };
const edgeTypes = { concept: ConceptEdge };

type RoadmapFlowViewProps = {
  node: RenderNode;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
  retrialCount?: number;
  breadcrumbs?: ReactNode;
  streamingStatus?: string | null;
  isStreamingSkeleton?: boolean;
};

function MeasuredLayoutSync({
  tree,
  expandedId,
  highlightIds,
  onLayout,
}: {
  tree: RenderNode;
  expandedId: string | null;
  highlightIds: Set<string> | null;
  onLayout: (nodes: Node<ConceptNodeData>[], edges: ReturnType<typeof conceptGraphToFlowElements>["edges"]) => void;
}) {
  const nodesInitialized = useNodesInitialized();
  const { getNodes } = useReactFlow();
  const lastMeasuredKeyRef = useRef("");

  useEffect(() => {
    lastMeasuredKeyRef.current = "";
  }, [expandedId, tree]);

  useEffect(() => {
    if (!nodesInitialized) return;

    const measured = new Map<string, NodeSize>();
    for (const flowNode of getNodes()) {
      const width = flowNode.measured?.width ?? flowNode.width;
      const height = flowNode.measured?.height ?? flowNode.height;
      if (width && height) {
        measured.set(flowNode.id, { width, height });
      }
    }

    if (measured.size === 0) return;

    const measuredKey = [...measured.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, size]) => `${id}:${size.width}x${size.height}`)
      .join("|");
    if (measuredKey === lastMeasuredKeyRef.current) return;
    lastMeasuredKeyRef.current = measuredKey;

    const { nodes, edges } = conceptGraphToFlowElements(
      tree,
      expandedId,
      highlightIds,
      measured,
    );
    onLayout(nodes, edges);
  }, [nodesInitialized, tree, expandedId, highlightIds, getNodes, onLayout]);

  return null;
}

export function RoadmapFlowView({
  node,
  onRegenerate,
  regenerateDisabled,
  retrialCount = 0,
  breadcrumbs,
  streamingStatus,
  isStreamingSkeleton = false,
}: RoadmapFlowViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const graphEdges = useMemo(() => graphEdgesFromNode(node), [node]);

  const highlightIds = useMemo(
    () => (expandedId ? upstreamPath(expandedId, graphEdges) : null),
    [expandedId, graphEdges],
  );

  const initialFlow = useMemo(
    () => conceptGraphToFlowElements(node, expandedId, highlightIds),
    [node, expandedId, highlightIds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  const applyLayout = useCallback(
    (
      nextNodes: Node<ConceptNodeData>[],
      nextEdges: typeof initialFlow.edges,
    ) => {
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [setNodes, setEdges],
  );

  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = conceptGraphToFlowElements(
      node,
      expandedId,
      highlightIds,
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [node, expandedId, highlightIds, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, clicked: Node<ConceptNodeData>) => {
      setExpandedId((prev) => (prev === clicked.id ? null : clicked.id));
    },
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CanvasToolbar
        variant="graph"
        onRegenerate={onRegenerate}
        regenerateDisabled={regenerateDisabled}
        retrialCount={retrialCount}
        breadcrumbs={breadcrumbs}
        streamingStatus={streamingStatus}
      />
      <div
        className={[
          "min-h-0 flex-1 bg-zinc-200/60 dark:bg-zinc-950",
          isStreamingSkeleton ? "[&_.react-flow__node]:animate-pulse" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
            },
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.25}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <MeasuredLayoutSync
            tree={node}
            expandedId={expandedId}
            highlightIds={highlightIds}
            onLayout={applyLayout}
          />
          <Background gap={20} size={1} className="!bg-transparent" />
          <Controls showInteractive={false} className="!shadow-sm" />
        </ReactFlow>
      </div>
    </div>
  );
}
