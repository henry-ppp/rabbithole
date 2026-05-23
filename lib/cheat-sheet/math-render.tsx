"use client";

import "katex/dist/katex.min.css";
import { parseRichTextSegments, renderLatex } from "./latex";

export { parseRichTextSegments, renderLatex } from "./latex";
export type { RichTextSegment } from "./latex";

type MathSpanProps = {
  latex: string;
  display?: boolean;
  className?: string;
};

export function MathSpan({ latex, display = false, className = "" }: MathSpanProps) {
  const html = renderLatex(latex, display);
  if (!html) {
    return null;
  }

  if (display) {
    return (
      <div
        className={`my-1 overflow-x-auto text-center ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type RichTextProps = {
  text: string;
  className?: string;
};

export function RichText({ text, className = "" }: RichTextProps) {
  const segments = parseRichTextSegments(text);

  if (segments.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.content}</span>;
        }
        return (
          <MathSpan
            key={index}
            latex={segment.content}
            display={segment.type === "display"}
          />
        );
      })}
    </span>
  );
}
