"use client";

import { useEffect, useId, useRef } from "react";
import { RichText } from "@/lib/cheat-sheet/math-render";

type MermaidDiagramProps = {
  source: string;
  caption?: string;
  compact?: boolean;
};

const DIAGRAM_FONT = {
  compact: "11px",
  regular: "12px",
} as const;

export function MermaidDiagram({ source, caption, compact = false }: MermaidDiagramProps) {
  const graphRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, "");
  const trimmedSource = source.trim();
  const trimmedCaption = caption?.trim() ?? "";

  useEffect(() => {
    if (!trimmedSource) return;

    let cancelled = false;

    void (async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        fontFamily: "inherit",
        flowchart: { useMaxWidth: false, htmlLabels: true },
        mindmap: { useMaxWidth: false },
        themeVariables: {
          fontSize: compact ? DIAGRAM_FONT.compact : DIAGRAM_FONT.regular,
          fontFamily: "inherit",
        },
      });

      if (cancelled || !graphRef.current) return;

      try {
        const { svg } = await mermaid.render(`mermaid-${reactId}`, trimmedSource);
        if (!cancelled && graphRef.current) {
          graphRef.current.innerHTML = svg;
          const svgEl = graphRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.setAttribute("role", "img");
            svgEl.style.display = "block";
            svgEl.style.marginInline = "auto";
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";

            const labelSize = compact ? DIAGRAM_FONT.compact : DIAGRAM_FONT.regular;
            svgEl.querySelectorAll("text").forEach((node) => {
              node.setAttribute("font-size", labelSize);
              if (node.closest(".node")) {
                node.setAttribute("text-anchor", "middle");
              }
            });
            svgEl.querySelectorAll("foreignObject").forEach((fo) => {
              fo.querySelectorAll(":scope > div").forEach((node) => {
                if (node instanceof HTMLElement) {
                  node.style.width = "100%";
                  node.style.height = "100%";
                  node.style.display = "flex";
                  node.style.alignItems = "center";
                  node.style.justifyContent = "center";
                  node.style.textAlign = "center";
                  node.style.fontSize = labelSize;
                  node.style.lineHeight = "1.45";
                }
              });
              fo.querySelectorAll("span, p").forEach((node) => {
                if (node instanceof HTMLElement) {
                  node.style.textAlign = "center";
                  node.style.fontSize = labelSize;
                  node.style.lineHeight = "1.45";
                }
              });
            });
          }
        }
      } catch {
        if (!cancelled && graphRef.current) {
          graphRef.current.textContent = trimmedSource;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trimmedSource, reactId, compact]);

  if (!trimmedSource) return null;

  const captionClass = compact
    ? "text-[0.6875rem] leading-[1.45]"
    : "text-xs leading-relaxed";

  return (
    <div
      className={`cheat-sheet-diagram flex overflow-hidden rounded-lg border border-zinc-200/60 bg-white/80 dark:border-zinc-700 dark:bg-zinc-950/40 ${captionClass}`}
      aria-label={trimmedCaption || "Diagram"}
    >
      <div className="flex min-w-0 flex-1 items-center justify-center p-3">
        <div
          ref={graphRef}
          className="mx-auto w-fit max-w-full [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full"
        />
      </div>
      {trimmedCaption ? (
        <aside
          className={`w-[10.5rem] shrink-0 border-l border-zinc-200/60 px-3 py-3 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300 ${captionClass}`}
        >
          <RichText text={trimmedCaption} />
        </aside>
      ) : null}
    </div>
  );
}
