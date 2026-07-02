"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { ConceptEdgeData } from "@/lib/cheat-sheet/concept-flow";

function ConceptEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as ConceptEdgeData | undefined;
  const highlighted = edgeData?.highlighted ?? false;
  const active = highlighted || selected;

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        strokeWidth: active ? 2.5 : 1.5,
        stroke: active ? "#8b5cf6" : "#a1a1aa",
      }}
      markerEnd={markerEnd}
      interactionWidth={20}
    />
  );
}

export const ConceptEdge = memo(ConceptEdgeComponent);
