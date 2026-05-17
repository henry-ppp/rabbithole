"use client";

import type { RenderNode } from "./render-contract";

type RenderNodeProps = {
  node: RenderNode;
  depth?: number;
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

export function RenderNodeView({ node, depth = 0 }: RenderNodeProps) {
  const { kind, props = {}, children = [] } = node;
  const compact = node.layout?.density === "compact";

  if (!KNOWN_KINDS.has(kind)) {
    return <FallbackNode node={node} />;
  }

  switch (kind) {
    case "sheet":
      return (
        <article className="cheat-sheet-root flex flex-col gap-4 overflow-hidden p-8">
          {children.length > 0 ? (
            children.map((child, i) => (
              <RenderNodeView key={i} node={child} depth={depth + 1} />
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
              <RenderNodeView node={child} depth={depth + 1} />
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
              {str(props.title)}
            </h2>
          ) : null}
          <div className="flex flex-col gap-2">
            {children.map((child, i) => (
              <RenderNodeView key={i} node={child} depth={depth + 1} />
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
                      className="break-words border border-zinc-200 px-2 py-1 align-top font-mono text-[0.65rem] leading-snug dark:border-zinc-700"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
      );
    }

    case "code":
      return (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-zinc-900 px-3 py-2 font-mono text-[0.7rem] leading-relaxed text-zinc-100">
          <code>{str(props.content)}</code>
        </pre>
      );

    case "callout": {
      const tone = str(props.tone, "info");
      const toneClass =
        tone === "warning"
          ? "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
          : tone === "tip"
            ? "border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
            : "border-blue-500/50 bg-blue-50 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100";
      return (
        <aside
          className={`rounded-md border-l-4 px-3 py-2 text-xs ${toneClass}`}
        >
          {props.title ? (
            <p className="mb-1 font-semibold">{str(props.title)}</p>
          ) : null}
          {children.length > 0
            ? children.map((child, i) => (
                <RenderNodeView key={i} node={child} depth={depth + 1} />
              ))
            : props.content
              ? <p>{str(props.content)}</p>
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
              {item}
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
