"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import type { DrillSourceKind, DrillTarget } from "./navigation";
import { codeDrillLabel, normalizeDrillLabel } from "./navigation";
import type { RenderNode } from "./render-contract";

export type { DrillTarget };

type RenderNodeProps = {
  node: RenderNode;
  depth?: number;
  onDrill?: (target: DrillTarget) => void;
  drilling?: boolean;
};

const KNOWN_KINDS = new Set([
  "sheet",
  "title",
  "grid",
  "section",
  "table",
  "code",
  "callout",
  "text",
  "list",
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
}: RenderNodeProps) {
  const { kind, props = {}, children = [] } = node;
  const compact = node.layout?.density === "compact";
  const childProps = { onDrill, drilling };

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
      return (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {children.map((child, i) => (
            <div
              key={i}
              className="min-w-0"
              style={
                child.layout?.column !== undefined
                  ? { gridColumn: (child.layout.column % columns) + 1 }
                  : undefined
              }
            >
              <RenderNodeView node={child} depth={depth + 1} {...childProps} />
            </div>
          ))}
        </div>
      );
    }

    case "section":
      return (
        <section
          className={`flex flex-col gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {props.title ? (
            <h2 className="border-b border-zinc-200 pb-1 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
              <Drillable
                label={str(props.title)}
                sourceKind="section"
                onDrill={onDrill}
                drilling={drilling}
                as="span"
                className="font-semibold uppercase tracking-wide"
              >
                {str(props.title)}
              </Drillable>
            </h2>
          ) : null}
          <div className="flex flex-col gap-2">
            {children.map((child, i) => (
              <RenderNodeView key={i} node={child} depth={depth + 1} {...childProps} />
            ))}
          </div>
        </section>
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
                    <Drillable
                      label={h}
                      sourceKind="table"
                      onDrill={onDrill}
                      drilling={drilling}
                      as="span"
                    >
                      {h}
                    </Drillable>
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
                    className="break-words border border-zinc-200 px-2 py-1 align-top font-mono text-[0.65rem] leading-snug dark:border-zinc-700"
                  >
                    <Drillable
                      label={cell}
                      sourceKind="table"
                      onDrill={onDrill}
                      drilling={drilling}
                      as="span"
                    >
                      {cell}
                    </Drillable>
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
      const drillLabel = codeDrillLabel(content);
      return (
        <Drillable
          label={drillLabel}
          sourceKind="code"
          onDrill={onDrill}
          drilling={drilling}
          className="block w-full"
        >
          <pre className="whitespace-pre-wrap break-words rounded-md bg-zinc-900 px-3 py-2 font-mono text-[0.7rem] leading-relaxed text-zinc-100">
            <code>{content}</code>
          </pre>
        </Drillable>
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
      const calloutLabel =
        title || content.split(/\r?\n/)[0]?.trim() || content;

      return (
        <aside
          className={`rounded-md border-l-4 px-3 py-2 text-xs ${toneClass}`}
        >
          {title ? (
            <p className="mb-1 font-semibold">
              <Drillable
                label={title}
                sourceKind="callout"
                onDrill={onDrill}
                drilling={drilling}
                as="span"
                className="font-semibold"
              >
                {title}
              </Drillable>
            </p>
          ) : content ? (
            <Drillable
              label={calloutLabel}
              sourceKind="callout"
              onDrill={onDrill}
              drilling={drilling}
              className="block"
            >
              <p>{content}</p>
            </Drillable>
          ) : null}
          {children.length > 0
            ? children.map((child, i) => (
                <RenderNodeView key={i} node={child} depth={depth + 1} {...childProps} />
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
          {str(props.content)}
        </p>
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
              <Drillable
                label={item}
                sourceKind="list"
                onDrill={onDrill}
                drilling={drilling}
                as="span"
              >
                {item}
              </Drillable>
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
