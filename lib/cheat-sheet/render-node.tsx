"use client";

import { useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { DrillSourceKind, DrillTarget } from "./navigation";
import { normalizeDrillLabel } from "./navigation";
import type { RenderNode } from "./render-contract";
import { MathSpan, RichText } from "./math-render";
import {
  QUESTION_FRAME_LABELS,
  QUESTION_FRAMES,
} from "./playbook-content";

export type { DrillTarget };

type RenderNodeProps = {
  node: RenderNode;
  depth?: number;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
  isStreamingSkeleton?: boolean;
};

const KNOWN_KINDS = new Set([
  "sheet",
  "title",
  "grid",
  "section",
  "module",
  "anchor",
  "moduleMap",
  "topicMap",
  "conceptGraph",
  "conceptNode",
  "table",
  "code",
  "callout",
  "text",
  "list",
  "math",
  "spacer",
]);

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function tableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell)));
}

type ModuleMapNode = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  highlighted?: boolean;
};

type ModuleMapEdge = {
  from: string;
  to: string;
  relation?: string;
};

function moduleMapNodes(value: unknown): ModuleMapNode[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item) => ({
      id: str(item.id),
      label: str(item.label),
      ...(typeof item.hint === "string" ? { hint: item.hint } : {}),
      ...(typeof item.group === "string" ? { group: item.group } : {}),
      ...(item.highlighted === true ? { highlighted: true } : {}),
    }))
    .filter((node) => node.id && node.label);
}

function moduleMapEdges(value: unknown): ModuleMapEdge[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item) => ({
      from: str(item.from),
      to: str(item.to),
      ...(typeof item.relation === "string" ? { relation: item.relation } : {}),
    }))
    .filter((edge) => edge.from && edge.to);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const QUESTION_FRAME_ORDER = [...QUESTION_FRAMES];

function isQuestionFrameGroup(group: string): boolean {
  return (QUESTION_FRAMES as readonly string[]).includes(group);
}

const RELATION_LABELS: Record<string, string> = {
  requires: "requires",
  "leads-to": "leads to",
  "builds-on": "builds on",
  contrasts: "contrasts",
  "part-of": "part of",
};

type CollapsibleModuleProps = {
  label: string;
  hint: string;
  group: string;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
  compact?: boolean;
  isStreamingSkeleton?: boolean;
  children: ReactNode;
};

function CollapsibleModule({
  label,
  hint,
  group,
  onDrill,
  drilling,
  compact,
  isStreamingSkeleton,
  children,
}: CollapsibleModuleProps) {
  const [expanded, setExpanded] = useState(false);
  const showGroupTag = Boolean(group) && !isQuestionFrameGroup(group);
  const hasChildren = Array.isArray(children) ? (children as ReactNode[]).length > 0 : Boolean(children);

  return (
    <div
      className={[
        "rounded-lg border border-zinc-200/80 bg-white/80 dark:border-zinc-700 dark:bg-zinc-950/40",
        compact ? "text-xs" : "text-sm",
        isStreamingSkeleton ? "animate-pulse" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start gap-1.5 p-3">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse module" : "Expand module"}
          >
            <span
              className={`inline-block text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
              aria-hidden
            >
              ›
            </span>
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <Drillable
              label={label}
              sourceKind="module"
              onDrill={onDrill}
              drilling={drilling}
              as="span"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {label}
            </Drillable>
            {hint ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.65rem] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {hint}
              </span>
            ) : null}
            {showGroupTag ? (
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {group}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {expanded && hasChildren ? (
        <div className="flex flex-col gap-2 border-t border-zinc-100 px-3 pb-3 pt-2 dark:border-zinc-800">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type DrillableProps = {
  label: string;
  sourceKind: DrillSourceKind;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
  className?: string;
  as?: "span" | "button";
  children: ReactNode;
};

function Drillable({
  label,
  sourceKind,
  onDrill,
  drilling = false,
  className = "",
  as = "button",
  children,
}: DrillableProps) {
  const normalized = normalizeDrillLabel(label);
  const interactive = Boolean(onDrill && normalized && !drilling);

  const handlePointerDown = (event: PointerEvent) => {
    if (!interactive) return;
    event.stopPropagation();
  };

  const handleClick = (event: MouseEvent) => {
    if (!interactive || !onDrill) return;
    event.stopPropagation();
    onDrill({ label: normalized, sourceKind });
  };

  const sharedClass = [
    className,
    interactive
      ? "cursor-pointer rounded-sm underline decoration-transparent decoration-1 underline-offset-2 transition-colors hover:bg-violet-100/80 hover:decoration-violet-500 dark:hover:bg-violet-950/40 dark:hover:decoration-violet-400"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!interactive) {
    return <span className={className}>{children}</span>;
  }

  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={0}
        title="Explore this topic"
        className={sharedClass}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onDrill?.({ label: normalized, sourceKind });
          }
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      title="Explore this topic"
      className={`text-left ${sharedClass}`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

export function RenderNodeView({
  node,
  depth = 0,
  onDrill,
  drilling = false,
  isStreamingSkeleton = false,
}: RenderNodeProps) {
  const { kind, props = {}, children = [] } = node;
  const compact = node.layout?.density === "compact";
  const childProps = { onDrill, drilling, isStreamingSkeleton };

  if (!KNOWN_KINDS.has(kind)) {
    return <FallbackNode node={node} />;
  }

  switch (kind) {
    case "sheet":
      return (
        <article className="cheat-sheet-root flex flex-col gap-4 overflow-hidden p-8">
          {children.length > 0 ? (
            children.map((child, i) => (
              <RenderNodeView key={i} node={child} depth={depth + 1} {...childProps} />
            ))
          ) : (
            <SheetHeader props={props} />
          )}
        </article>
      );

    case "title":
      return <SheetHeader props={props} />;

    case "grid": {
      const columns = Math.min(3, Math.max(1, Number(props.columns) || 3));
      const columnBuckets: RenderNode[][] = Array.from({ length: columns }, () => []);
      const fullWidth: RenderNode[] = [];

      children.forEach((child, i) => {
        const span = child.layout?.span ?? 1;
        if (span >= columns) {
          fullWidth.push(child);
          return;
        }
        const column =
          child.layout?.column !== undefined
            ? child.layout.column % columns
            : i % columns;
        columnBuckets[column].push(child);
      });

      return (
        <div className="flex flex-col gap-4">
          {fullWidth.map((child, i) => (
            <div key={`full-${i}`} className="min-w-0">
              <RenderNodeView node={child} depth={depth + 1} {...childProps} />
            </div>
          ))}
          <div className="flex items-start gap-4">
            {columnBuckets.map((bucket, col) => (
              <div key={col} className="flex min-w-0 flex-1 flex-col gap-4">
                {bucket.map((child, i) => (
                  <RenderNodeView
                    key={i}
                    node={child}
                    depth={depth + 1}
                    {...childProps}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "section": {
      const showTitle = props.title && props.hideTitle !== true;
      const moduleEdges = moduleMapEdges(props.moduleEdges);
      const nonModules: RenderNode[] = [];
      const modules: RenderNode[] = [];

      for (const child of children) {
        if (child.kind === "module") {
          modules.push(child);
        } else {
          nonModules.push(child);
        }
      }

      const modulesByFrame = new Map<string, RenderNode[]>();
      const ungroupedModules: RenderNode[] = [];

      for (const moduleNode of modules) {
        const group = str(moduleNode.props?.group);
        if (group && isQuestionFrameGroup(group)) {
          const bucket = modulesByFrame.get(group) ?? [];
          bucket.push(moduleNode);
          modulesByFrame.set(group, bucket);
        } else {
          ungroupedModules.push(moduleNode);
        }
      }

      return (
        <section
          className={`flex flex-col gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {showTitle ? (
            <h2 className="border-b border-zinc-200 pb-1 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
              {str(props.title)}
            </h2>
          ) : null}
          {moduleEdges.length > 0 ? (
            <ModuleEdgeRow
              edges={moduleEdges}
              modules={modules}
              compact={compact}
            />
          ) : null}
          <div className="flex flex-col gap-2">
            {nonModules.map((child, i) => (
              <RenderNodeView key={`pre-${i}`} node={child} depth={depth + 1} {...childProps} />
            ))}
            {QUESTION_FRAME_ORDER.map((frame) => {
              const bucket = modulesByFrame.get(frame);
              if (!bucket?.length) return null;
              const frameLabel =
                QUESTION_FRAME_LABELS[frame as keyof typeof QUESTION_FRAME_LABELS] ??
                frame;
              return (
                <QuestionFrameBand key={frame} label={frameLabel} compact={compact}>
                  {bucket.map((child, i) => (
                    <RenderNodeView
                      key={`${frame}-${i}`}
                      node={child}
                      depth={depth + 1}
                      {...childProps}
                    />
                  ))}
                </QuestionFrameBand>
              );
            })}
            {ungroupedModules.map((child, i) => (
              <RenderNodeView
                key={`ungrouped-${i}`}
                node={child}
                depth={depth + 1}
                {...childProps}
              />
            ))}
          </div>
        </section>
      );
    }

    case "module": {
      return (
        <CollapsibleModule
          label={str(props.label)}
          hint={str(props.hint)}
          group={str(props.group)}
          onDrill={onDrill}
          drilling={drilling}
          compact={compact}
          isStreamingSkeleton={isStreamingSkeleton}
        >
          {children.map((child, i) => (
            <RenderNodeView
              key={i}
              node={child}
              depth={depth + 1}
              onDrill={onDrill}
              drilling={drilling}
              isStreamingSkeleton={isStreamingSkeleton}
            />
          ))}
        </CollapsibleModule>
      );
    }

    case "anchor": {
      const label = str(props.label);
      const teachGoal = str(props.teachGoal);
      return (
        <div
          className={`rounded-md border-l-4 border-violet-500/70 bg-white/80 px-3 py-2 dark:bg-zinc-950/40 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          <div className="mb-1">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {label}
            </span>
            {teachGoal ? (
              <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-300">
                <RichText text={teachGoal} />
              </p>
            ) : null}
          </div>
          {children.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {children.map((child, i) => (
                <RenderNodeView key={i} node={child} depth={depth + 1} drilling={drilling} />
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    case "moduleMap":
    case "topicMap":
      return (
        <ModuleMapView
          nodes={moduleMapNodes(props.nodes)}
          edges={moduleMapEdges(props.edges)}
          compact={compact}
          onDrill={onDrill}
          drilling={drilling}
        />
      );

    case "table": {
      const headers = strArray(props.headers);
      const rows = tableRows(props.rows);
      return (
        <table className="w-full table-fixed border-collapse text-left">
          {headers.length > 0 ? (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="break-words border border-zinc-200 bg-zinc-100 px-2 py-1 font-semibold dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="break-words border border-zinc-200 px-2 py-1 align-top text-[0.65rem] leading-snug dark:border-zinc-700"
                  >
                    <RichText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    case "code": {
      const content = str(props.content);
      return (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-zinc-900 px-3 py-2 font-mono text-[0.7rem] leading-relaxed text-zinc-100">
          <code>{content}</code>
        </pre>
      );
    }

    case "callout": {
      const tone = str(props.tone, "info");
      const toneClass =
        tone === "warning"
          ? "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          : tone === "tip"
            ? "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
            : "border-blue-500/50 bg-blue-50 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100";
      const title = str(props.title);
      const content = str(props.content);

      return (
        <aside
          className={`rounded-md border-l-4 px-3 py-2 text-xs ${toneClass}`}
        >
          {title ? (
            <p className="mb-1 font-semibold">{title}</p>
          ) : content ? (
            <p>
              <RichText text={content} />
            </p>
          ) : null}
          {children.length > 0
            ? children.map((child, i) => (
                <RenderNodeView key={i} node={child} depth={depth + 1} drilling={drilling} />
              ))
            : null}
        </aside>
      );
    }

    case "text":
      return (
        <p
          className={`leading-snug text-zinc-700 dark:text-zinc-300 ${compact ? "text-xs" : "text-sm"}`}
        >
          <RichText text={str(props.content)} />
        </p>
      );

    case "math":
      return (
        <MathSpan
          latex={str(props.latex)}
          display={props.display !== false}
        />
      );

    case "list": {
      const items = strArray(props.items);
      const ordered = props.ordered === true;
      const ListTag = ordered ? "ol" : "ul";
      return (
        <ListTag
          className={`list-inside space-y-0.5 pl-1 ${ordered ? "list-decimal" : "list-disc"} ${compact ? "text-xs" : "text-sm"}`}
        >
          {items.map((item, i) => (
            <li key={i} className="text-zinc-700 dark:text-zinc-300">
              <RichText text={item} />
            </li>
          ))}
        </ListTag>
      );
    }

    case "spacer":
      return (
        <div aria-hidden style={{ height: Number(props.height) || 8 }} />
      );

    default:
      return <FallbackNode node={node} />;
  }
}

function QuestionFrameBand({
  label,
  compact = false,
  children,
}: {
  label: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md border border-zinc-200/60 bg-white/50 p-2 dark:border-zinc-700/80 dark:bg-zinc-950/20 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        {label}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SheetHeader({ props }: { props: Record<string, unknown> }) {
  return (
    <header className="border-b-2 border-zinc-800 pb-3 dark:border-zinc-200">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {str(props.title, "Cheat Sheet")}
      </h1>
      {props.subtitle ? (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {str(props.subtitle)}
        </p>
      ) : null}
    </header>
  );
}

function ModuleEdgeRow({
  edges,
  modules,
  compact = false,
}: {
  edges: ModuleMapEdge[];
  modules: RenderNode[];
  compact?: boolean;
}) {
  const labelById = new Map<string, string>();
  for (const moduleNode of modules) {
    const id = str(moduleNode.props?.id);
    const label = str(moduleNode.props?.label);
    if (id && label) {
      labelById.set(id, label);
    }
  }

  return (
    <div
      className={`space-y-1 rounded-md border border-dashed border-zinc-300/80 bg-zinc-100/50 p-2 dark:border-zinc-700 dark:bg-zinc-900/30 ${
        compact ? "text-[0.65rem]" : "text-xs"
      }`}
    >
      {edges.map((edge, i) => {
        const fromLabel = labelById.get(edge.from) ?? edge.from;
        const toLabel = labelById.get(edge.to) ?? edge.to;
        const relationLabel = edge.relation
          ? RELATION_LABELS[edge.relation] ?? edge.relation
          : "→";
        return (
          <div
            key={`${edge.from}-${edge.to}-${i}`}
            className="flex flex-wrap items-center gap-1 text-zinc-600 dark:text-zinc-400"
          >
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{fromLabel}</span>
            <span className="px-0.5 text-[0.6rem] text-zinc-400">{relationLabel}</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{toLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

type ModuleMapViewProps = {
  nodes: ModuleMapNode[];
  edges: ModuleMapEdge[];
  compact?: boolean;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
};

function ModuleMapView({
  nodes,
  edges,
  compact = false,
  onDrill,
  drilling = false,
}: ModuleMapViewProps) {
  if (nodes.length === 0) {
    return null;
  }

  const groups = new Map<string, ModuleMapNode[]>();
  const ungrouped: ModuleMapNode[] = [];

  for (const node of nodes) {
    if (node.group) {
      const bucket = groups.get(node.group) ?? [];
      bucket.push(node);
      groups.set(node.group, bucket);
    } else {
      ungrouped.push(node);
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div
      className={`rounded-md border border-dashed border-zinc-300/80 bg-zinc-100/50 p-2 dark:border-zinc-700 dark:bg-zinc-900/30 ${
        compact ? "text-[0.65rem]" : "text-xs"
      }`}
    >
      <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Modules
      </p>

      {edges.length > 0 ? (
        <div className="mb-2 space-y-1">
          {edges.map((edge, i) => {
            const fromNode = nodeById.get(edge.from);
            const toNode = nodeById.get(edge.to);
            if (!fromNode || !toNode) return null;
            const relationLabel = edge.relation
              ? RELATION_LABELS[edge.relation] ?? edge.relation
              : "→";
            return (
              <div
                key={`${edge.from}-${edge.to}-${i}`}
                className="flex flex-wrap items-center gap-1 text-zinc-600 dark:text-zinc-400"
              >
                <ModuleCard
                  node={fromNode}
                  onDrill={onDrill}
                  drilling={drilling}
                  inline
                />
                <span className="px-0.5 text-[0.6rem] text-zinc-400">{relationLabel}</span>
                <ModuleCard
                  node={toNode}
                  onDrill={onDrill}
                  drilling={drilling}
                  inline
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {Array.from(groups.entries()).map(([groupName, groupNodes]) => (
          <div
            key={groupName}
            className="min-w-[7rem] flex-1 rounded border border-zinc-200/80 bg-white/60 p-1.5 dark:border-zinc-700 dark:bg-zinc-950/30"
          >
            <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {groupName}
            </p>
            <div className="flex flex-col gap-1">
              {groupNodes.map((node) => (
                <ModuleCard
                  key={node.id}
                  node={node}
                  onDrill={onDrill}
                  drilling={drilling}
                />
              ))}
            </div>
          </div>
        ))}

        {ungrouped.length > 0 ? (
          <div className="flex min-w-[7rem] flex-1 flex-col gap-1">
            {ungrouped.map((node) => (
              <ModuleCard
                key={node.id}
                node={node}
                onDrill={onDrill}
                drilling={drilling}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ModuleCardProps = {
  node: ModuleMapNode;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
  inline?: boolean;
};

function ModuleCard({
  node,
  onDrill,
  drilling = false,
  inline = false,
}: ModuleCardProps) {
  const highlighted = node.highlighted;
  return (
    <div
      className={[
        "rounded border px-2 py-1",
        highlighted
          ? "border-violet-300/80 bg-violet-50/80 dark:border-violet-800 dark:bg-violet-950/30"
          : "border-zinc-200/60 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/50",
        inline ? "inline-flex flex-col" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Drillable
        label={node.label}
        sourceKind="module"
        onDrill={onDrill}
        drilling={drilling}
        as="span"
        className="font-medium text-zinc-800 dark:text-zinc-100"
      >
        {node.label}
      </Drillable>
      {node.hint ? (
        <span className="text-[0.6rem] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {node.hint}
        </span>
      ) : null}
    </div>
  );
}

function FallbackNode({ node }: { node: RenderNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-400 bg-zinc-100 p-2 dark:border-zinc-600 dark:bg-zinc-900">
      <p className="mb-1 font-mono text-xs font-semibold text-zinc-500">
        Unknown: {node.kind}
      </p>
      <pre className="whitespace-pre-wrap break-words font-mono text-[0.65rem] text-zinc-700 dark:text-zinc-300">
        {JSON.stringify(node, null, 2)}
      </pre>
    </div>
  );
}
