"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ConceptNodeData } from "@/lib/cheat-sheet/concept-flow";

function ConceptFlowNodeComponent({ data }: NodeProps<Node<ConceptNodeData>>) {
  return (
    <div
      className={[
        "rounded-lg border bg-white px-3 py-2 text-left shadow-sm transition-all dark:bg-zinc-950",
        data.expanded
          ? "border-violet-500 ring-2 ring-violet-400/30 dark:border-violet-400"
          : "border-zinc-200/80 dark:border-zinc-700",
        data.dimmed ? "opacity-35" : "opacity-100",
        data.expanded ? "min-w-[200px]" : "min-w-[148px]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <p className="text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
        {data.label}
      </p>
      {data.hint ? (
        <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {data.hint}
        </span>
      ) : null}
      {data.expanded ? (
        <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {data.teachGoal ? (
            <p className="text-[0.65rem] leading-snug text-zinc-600 dark:text-zinc-300">
              {data.teachGoal}
            </p>
          ) : null}
          {data.keyTerms.length > 0 ? (
            <ul className="list-inside list-disc text-[0.65rem] leading-snug text-zinc-700 dark:text-zinc-300">
              {data.keyTerms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
    </div>
  );
}

export const ConceptFlowNode = memo(ConceptFlowNodeComponent);
