import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRichTextSegments,
  renderLatex,
} from "./latex";

describe("renderLatex", () => {
  it("returns HTML with katex class for valid inline input", () => {
    const html = renderLatex("x^2", false);
    assert.match(html, /katex/);
  });

  it("returns HTML with katex class for valid display input", () => {
    const html = renderLatex("\\frac{a}{b}", true);
    assert.match(html, /katex/);
  });

  it("does not throw on invalid LaTeX", () => {
    assert.doesNotThrow(() => renderLatex("\\notavalidcommand", false));
    const html = renderLatex("\\notavalidcommand", false);
    assert.equal(typeof html, "string");
    assert.ok(html.length > 0);
  });

  it("returns empty string for blank input", () => {
    assert.equal(renderLatex("   ", false), "");
  });
});

describe("parseRichTextSegments", () => {
  it("parses inline math segments", () => {
    const segments = parseRichTextSegments("Duration $D \\approx 5$ years");
    assert.deepEqual(segments, [
      { type: "text", content: "Duration " },
      { type: "inline", content: "D \\approx 5" },
      { type: "text", content: " years" },
    ]);
  });

  it("parses display math segments", () => {
    const segments = parseRichTextSegments("Formula $$\\frac{a}{b}$$ end");
    assert.deepEqual(segments, [
      { type: "text", content: "Formula " },
      { type: "display", content: "\\frac{a}{b}" },
      { type: "text", content: " end" },
    ]);
  });

  it("leaves unpaired dollar signs as literal text", () => {
    const segments = parseRichTextSegments("Price $100 bond");
    assert.deepEqual(segments, [{ type: "text", content: "Price $100 bond" }]);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(parseRichTextSegments(""), []);
  });
});
