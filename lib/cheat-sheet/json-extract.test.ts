import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleCheatSheetTree,
  buildFallbackSectionNode,
  extractJsonFromAgentText,
  findBalancedJsonEnd,
  parseCoverageMap,
  parseSectionWriterOutput,
  shortSectionTitle,
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

describe("shortSectionTitle", () => {
  it("strips parenthetical subtitles", () => {
    assert.equal(
      shortSectionTitle("Fixed Income (term structure, valuation)"),
      "Fixed Income",
    );
  });
});

describe("parseCoverageMap", () => {
  it("parses three-layer section with anchors and subtopics", () => {
    const parsed = parseCoverageMap({
      topic: "Git rebase",
      title: "Git Rebase",
      sections: [
        {
          id: "basics",
          title: "Basics",
          goal: "Core rebase workflow",
          anchors: [
            {
              id: "a1",
              label: "What rebase does",
              teachGoal: "Replay commits",
              mustCover: ["git rebase main"],
            },
          ],
          subtopics: [
            { id: "s1", label: "Recovery", group: "Advanced", hint: "Undo" },
          ],
          edges: [{ from: "s1", to: "s2", relation: "leads-to" }],
        },
      ],
    });

    assert.ok(parsed);
    const section = parsed!.map.sections[0];
    assert.equal(section.anchors?.length, 1);
    assert.equal(section.subtopics?.length, 1);
    assert.equal(section.edges?.length, 1);
  });
});

describe("buildFallbackSectionNode", () => {
  it("builds three-layer section from anchors and subtopics", () => {
    const node = buildFallbackSectionNode({
      id: "basics",
      title: "Basics",
      goal: "Core rebase workflow",
      anchors: [
        {
          id: "a1",
          label: "What rebase does",
          teachGoal: "Replay commits onto a new base",
          mustCover: ["git rebase main", "git fetch first"],
        },
      ],
      subtopics: [
        { id: "s1", label: "Recovery", group: "Advanced" },
        { id: "s2", label: "Rebase --onto", group: "Advanced" },
      ],
    });

    assert.equal(node.kind, "section");
    assert.equal(node.props?.title, "Basics");
    const kinds = (node.children ?? []).map((child) => child.kind);
    assert.ok(kinds.includes("text"));
    assert.ok(kinds.includes("anchor"));
    assert.ok(kinds.includes("topicMap"));
  });

  it("builds legacy section from mustInclude when no anchors/subtopics", () => {
    const node = buildFallbackSectionNode({
      id: "fi",
      title: "Fixed Income (term structure)",
      goal: "Yield and credit basics",
      mustInclude: ["YTM", "duration", "credit spread"],
    });
    assert.equal(node.kind, "section");
    assert.equal(node.props?.title, "Fixed Income");
    assert.ok((node.children?.length ?? 0) >= 1);
    assert.equal(node.children?.some((c) => c.kind === "topicMap"), false);
  });
});

describe("parseSectionWriterOutput", () => {
  it("unwraps a one-element array", () => {
    const node = parseSectionWriterOutput(
      [{ kind: "section", props: { title: "Ethics" }, children: [] }],
      "Ethics",
    );
    assert.equal(node?.kind, "section");
    assert.equal(node?.props?.title, "Ethics");
  });

  it("unwraps a section wrapper key", () => {
    const node = parseSectionWriterOutput(
      {
        section: {
          kind: "section",
          props: { title: "Exam format" },
          children: [{ kind: "list", props: { items: ["a"] } }],
        },
      },
      "Exam format",
    );
    assert.equal(node?.kind, "section");
    assert.equal(node?.children?.length, 1);
  });

  it("parses three-layer section with anchor and topicMap", () => {
    const node = parseSectionWriterOutput(
      {
        kind: "section",
        props: { title: "Basics" },
        children: [
          { kind: "text", props: { content: "Framing sentence." } },
          {
            kind: "anchor",
            props: { label: "Anchor", teachGoal: "Learn this" },
            children: [{ kind: "list", props: { items: ["a"] } }],
          },
          {
            kind: "topicMap",
            props: {
              nodes: [{ id: "s1", label: "Subtopic", group: "G" }],
            },
          },
        ],
      },
      "Basics",
    );
    assert.equal(node?.kind, "section");
    assert.equal(node?.children?.length, 3);
    assert.equal(node?.children?.[1]?.kind, "anchor");
    assert.equal(node?.children?.[2]?.kind, "topicMap");
  });

  it("infers section when kind is missing but children exist", () => {
    const node = parseSectionWriterOutput(
      {
        title: "Exam format & professional behaviours",
        children: [{ kind: "list", props: { items: ["CFA Institute"] } }],
      },
      "Exam format & professional behaviours",
    );
    assert.equal(node?.kind, "section");
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

  it("spans full width for sections with large topicMaps", () => {
    const tree = assembleCheatSheetTree(
      { topic: "git", title: "Git", sections: [] },
      [
        {
          kind: "section",
          props: { title: "Basics" },
          children: [
            { kind: "text", props: { content: "Goal" } },
            { kind: "anchor", props: { label: "A" }, children: [] },
            { kind: "anchor", props: { label: "B" }, children: [] },
            { kind: "topicMap", props: { nodes: [{ id: "s1", label: "S" }] } },
          ],
        },
      ],
    );
    const section = tree.children?.[0]?.children?.[0];
    assert.equal(section?.layout?.span, 1);
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
