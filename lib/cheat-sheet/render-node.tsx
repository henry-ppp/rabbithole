"use client";

import { Fragment, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { DrillSourceKind, DrillTarget } from "./navigation";
import { normalizeDrillLabel } from "./navigation";
import type { RenderNode } from "./render-contract";
import { MathSpan, RichText } from "./math-render";
import { MermaidDiagram } from "@/components/cheat-sheet/MermaidDiagram";

export type { DrillTarget };

type RenderNodeProps = {
  node: RenderNode;
  depth?: number;
  moduleTintIndex?: number;
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
  "diagram",
  "mermaid",
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

function moduleDisplayTitle(label: string, hint: string): string {
  const trimmedHint = hint.trim();
  if (trimmedHint) {
    return trimmedHint;
  }
  return label.replace(/\?+$/, "").trim();
}

function moduleGridSpan(moduleNode: RenderNode): 1 | 2 {
  const layoutSpan = moduleNode.layout?.span;
  if (layoutSpan !== undefined && layoutSpan >= 2) {
    return 2;
  }

  const anchors = (moduleNode.children ?? []).filter((child) => child.kind === "anchor");
  if (anchors.length >= 2) {
    return 2;
  }

  if (anchors.length === 1) {
    const anchor = anchors[0];
    const childCount = anchor.children?.length ?? 0;
    const table = anchor.children?.find((child) => child.kind === "table");
    const diagram = anchor.children?.find(
      (child) => child.kind === "diagram" || child.kind === "mermaid",
    );
    const rows = tableRows(table?.props?.rows);
    if (diagram || childCount > 2 || rows.length > 3) {
      return 2;
    }
  }

  return 1;
}

function moduleSurfaceClass(tintIndex: number): string {
  return tintIndex % 2 === 0 ? "module-panel module-panel--a" : "module-panel module-panel--b";
}

type ModulePanelProps = {
  label: string;
  hint: string;
  tintIndex?: number;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
  compact?: boolean;
  isStreamingSkeleton?: boolean;
  children: ReactNode;
};

function ModulePanel({
  label,
  hint,
  tintIndex = 0,
  onDrill,
  drilling,
  compact,
  isStreamingSkeleton,
  children,
}: ModulePanelProps) {
  const title = moduleDisplayTitle(label, hint);
  const childList = Array.isArray(children) ? (children as ReactNode[]) : [children];
  const hasChildren = childList.some(Boolean);

  return (
    <div
      className={[
        "flex h-full flex-col rounded-xl p-4",
        moduleSurfaceClass(tintIndex),
        compact ? "text-xs" : "text-sm",
        isStreamingSkeleton ? "animate-pulse" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Drillable
        label={label}
        displayLabel={title}
        sourceKind="module"
        onDrill={onDrill}
        drilling={drilling}
        as="span"
        className="mb-3 block text-[0.8125rem] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        {title}
      </Drillable>
      {hasChildren ? (
        <div className="flex flex-1 flex-col gap-3">
          {childList.map((child, index) =>
            child ? (
              <Fragment key={index}>
                {index > 0 ? (
                  <hr className="border-zinc-900/5 dark:border-zinc-100/10" />
                ) : null}
                {child}
              </Fragment>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

type DrillableProps = {
  label: string;
  displayLabel?: string;
  sourceKind: DrillSourceKind;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
  className?: string;
  as?: "span" | "button";
  children: ReactNode;
};

function Drillable({
  label,
  displayLabel,
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
    onDrill({
      label: normalized,
      displayLabel: displayLabel?.trim() || undefined,
      sourceKind,
    });
  };

  const sharedClass = [
    className,
    interactive
      ? "cursor-pointer rounded-md transition-colors hover:text-violet-700 dark:hover:text-violet-300"
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
            onDrill?.({
              label: normalized,
              displayLabel: displayLabel?.trim() || undefined,
              sourceKind,
            });
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
  moduleTintIndex = 0,
  onDrill,
  drilling = false,
  isStreamingSkeleton = false,
}: RenderNodeProps) {
  const { kind, props = {}, children = [] } = node;
  const compact = node.layout?.density === "compact";
  const childProps = { onDrill, drilling, isStreamingSkeleton, moduleTintIndex };

  if (!KNOWN_KINDS.has(kind)) {
    return <FallbackNode node={node} />;
  }

  switch (kind) {
    case "sheet": {
      const sheetTitle = str(props.title);
      return (
        <article className="cheat-sheet-root flex flex-col gap-6 overflow-hidden p-10">
          {sheetTitle ? <SheetHeader props={props} /> : null}
          {children.map((child, i) => (
            <RenderNodeView key={i} node={child} depth={depth + 1} {...childProps} />
          ))}
        </article>
      );
    }

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
      const nonModules: RenderNode[] = [];
      const modules: RenderNode[] = [];

      for (const child of children) {
        if (child.kind === "module") {
          modules.push(child);
        } else {
          nonModules.push(child);
        }
      }

      return (
        <section
          className={`flex flex-col gap-3 ${compact ? "text-xs" : "text-sm"}`}
        >
          {showTitle ? (
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {str(props.title)}
            </h2>
          ) : null}
          {nonModules.map((child, i) => (
            <RenderNodeView key={`pre-${i}`} node={child} depth={depth + 1} {...childProps} />
          ))}
          {modules.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {modules.map((moduleNode, i) => (
                <div
                  key={`module-${i}`}
                  className={moduleGridSpan(moduleNode) === 2 ? "col-span-2" : "col-span-1"}
                >
                  <RenderNodeView
                    node={moduleNode}
                    depth={depth + 1}
                    {...childProps}
                    moduleTintIndex={i}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    case "module": {
      return (
        <ModulePanel
          label={str(props.label)}
          hint={str(props.hint)}
          tintIndex={moduleTintIndex}
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
        </ModulePanel>
      );
    }

    case "anchor": {
      const teachGoal = str(props.teachGoal);
      return (
        <div className={compact ? "text-xs" : "text-sm"}>
          {teachGoal ? (
            <p className="mb-2 leading-relaxed text-zinc-600 dark:text-zinc-300">
              <RichText text={teachGoal} />
            </p>
          ) : null}
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
        <table className="cheat-sheet-table w-full table-fixed border-collapse text-left">
          {headers.length > 0 ? (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="break-words text-left">
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
                  <td key={ci} className="break-words align-top text-zinc-700">
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
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-zinc-900/95 px-3.5 py-2.5 font-mono text-[0.6875rem] leading-relaxed text-zinc-100 shadow-inner">
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
          className={`leading-relaxed text-zinc-600 dark:text-zinc-300 ${compact ? "text-xs" : "text-sm"}`}
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

    case "diagram":
    case "mermaid":
      return (
        <MermaidDiagram
          source={str(props.source) || str(props.content)}
          caption={
            str(props.caption) ||
            str(props.note) ||
            str(props.explain) ||
            str(props.description)
          }
          compact={compact}
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

function SheetHeader({ props }: { props: Record<string, unknown> }) {
  return (
    <header className="border-b border-zinc-900/8 pb-6">
      <h1 className="text-[1.625rem] font-semibold tracking-tight text-zinc-900">
        {str(props.title, "Cheat Sheet")}
      </h1>
      {props.subtitle ? (
        <p className="mt-1.5 text-sm font-normal text-zinc-400">
          {str(props.subtitle)}
        </p>
      ) : null}
    </header>
  );
}

const RELATION_LABELS: Record<string, string> = {
  requires: "requires",
  "leads-to": "leads to",
  "builds-on": "builds on",
  contrasts: "contrasts",
  "part-of": "part of",
};

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
        displayLabel={node.hint?.trim() || moduleDisplayTitle(node.label, "")}
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
