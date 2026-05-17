import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleCheatSheetTree,
  extractJsonFromAgentText,
  findBalancedJsonEnd,
} from "./render-contract";

describe("findBalancedJsonEnd", () => {
  it("closes at root when nested objects and arrays are present", () => {
    const json =
      '{"kind":"section","children":[{"kind":"list","props":{"items":["a","b"]}}]}';
    const end = findBalancedJsonEnd(json, 0);
    assert.equal(end, json.length);
  });

  it("does not close early on inner braces (regression)", () => {
    const json =
      '{"kind":"section","props":{"title":"Economics"},"children":[{"kind":"text","props":{"content":"x"}}]}';
    const end = findBalancedJsonEnd(json, 0);
    assert.equal(end, json.length);
    const slice = json.slice(0, end);
    assert.doesNotThrow(() => JSON.parse(slice));
  });

  it("returns null for truncated JSON", () => {
    const truncated =
      '{"kind":"section","children":[{"kind":"list","props":{"items":["a","b"';
    assert.equal(findBalancedJsonEnd(truncated, 0), null);
  });
});

describe("assembleCheatSheetTree", () => {
  it("wraps sections in a grid sheet", () => {
    const tree = assembleCheatSheetTree(
      { topic: "cfa", title: "CFA L2", sections: [] },
      [
        { kind: "section", props: { title: "A" } },
        { kind: "section", props: { title: "B" } },
      ],
    );
    assert.equal(tree.kind, "sheet");
    assert.equal(tree.children?.[0]?.kind, "grid");
    assert.equal(tree.children?.[0]?.children?.length, 2);
  });
});

describe("extractJsonFromAgentText", () => {
  it("extracts nested section subtree from prose wrapper", () => {
    const inner =
      '{"kind":"section","props":{"title":"Ethics"},"children":[{"kind":"list","props":{"items":["I","II"]}}]}';
    const raw = `Here is the section:\n${inner}\nDone.`;
    const parsed = extractJsonFromAgentText(raw) as { kind: string };
    assert.equal(parsed.kind, "section");
  });

  it("repairs trailing commas in arrays", () => {
    const raw = '{"items":["a","b",]}';
    const parsed = extractJsonFromAgentText(raw) as { items: string[] };
    assert.deepEqual(parsed.items, ["a", "b"]);
  });

  it("repairs truncated JSON via jsonrepair fallback", () => {
    const truncated =
      '{"kind":"section","props":{"title":"Economics"},"children":[{"kind":"list","props":{"items":["a","b"';
    const parsed = extractJsonFromAgentText(truncated) as {
      kind: string;
      props: { title: string };
    };
    assert.equal(parsed.kind, "section");
    assert.equal(parsed.props.title, "Economics");
  });
});
