import katex from "katex";

export type RichTextSegment =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "display"; content: string };

function coalesceTextSegments(segments: RichTextSegment[]): RichTextSegment[] {
  const out: RichTextSegment[] = [];
  for (const segment of segments) {
    const last = out[out.length - 1];
    if (segment.type === "text" && last?.type === "text") {
      last.content += segment.content;
    } else {
      out.push({ ...segment });
    }
  }
  return out;
}

function parseInlineSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let i = 0;

  while (i < text.length) {
    const inlineStart = text.indexOf("$", i);
    if (inlineStart === -1) {
      const rest = text.slice(i);
      if (rest) {
        segments.push({ type: "text", content: rest });
      }
      break;
    }

    if (inlineStart > i) {
      segments.push({ type: "text", content: text.slice(i, inlineStart) });
    }

    const nextChar = text[inlineStart + 1];
    if (nextChar !== undefined && nextChar >= "0" && nextChar <= "9") {
      const last = segments[segments.length - 1];
      if (last?.type === "text") {
        last.content += "$";
      } else {
        segments.push({ type: "text", content: "$" });
      }
      i = inlineStart + 1;
      continue;
    }

    const inlineEnd = text.indexOf("$", inlineStart + 1);
    if (inlineEnd === -1) {
      segments.push({ type: "text", content: text.slice(inlineStart) });
      break;
    }

    const latex = text.slice(inlineStart + 1, inlineEnd);
    if (latex.trim()) {
      segments.push({ type: "inline", content: latex.trim() });
    }

    i = inlineEnd + 1;
  }

  return coalesceTextSegments(segments);
}

/** Split text on $$...$$ (display) then $...$ (inline) delimiters. */
export function parseRichTextSegments(text: string): RichTextSegment[] {
  if (!text) {
    return [];
  }

  const segments: RichTextSegment[] = [];
  let i = 0;

  while (i < text.length) {
    const displayStart = text.indexOf("$$", i);
    if (displayStart === -1) {
      segments.push(...parseInlineSegments(text.slice(i)));
      break;
    }

    if (displayStart > i) {
      segments.push(...parseInlineSegments(text.slice(i, displayStart)));
    }

    const displayEnd = text.indexOf("$$", displayStart + 2);
    if (displayEnd === -1) {
      segments.push({ type: "text", content: text.slice(displayStart) });
      break;
    }

    const latex = text.slice(displayStart + 2, displayEnd);
    if (latex.trim()) {
      segments.push({ type: "display", content: latex.trim() });
    }

    i = displayEnd + 2;
  }

  return coalesceTextSegments(segments);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderLatex(latex: string, display: boolean): string {
  if (!latex.trim()) {
    return "";
  }

  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      output: "html",
    });
  } catch {
    return display ? `<span>${escapeHtml(latex)}</span>` : escapeHtml(latex);
  }
}
