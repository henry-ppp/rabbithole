import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleCheatSheetTree,
  buildFallbackSectionNode,
  extractJsonFromAgentText,
  findBalancedJsonEnd,
  MAX_ANCHORS_PER_MODULE,
  MAX_SECTIONS_PER_SHEET,
  parseCoverageMap,
  parseSectionWriterOutput,
  sanitizeRenderNode,
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
  it("preserves parenthetical context when under max length", () => {
    assert.equal(
      shortSectionTitle("Fixed Income (term structure, valuation)"),
      "Fixed Income (term structure, valuation)",
    );
  });

  it("truncates long titles without stripping parentheses", () => {
    const long = "A".repeat(50) + " (extra context)";
    assert.equal(shortSectionTitle(long, 48).endsWith("…"), true);
    assert.equal(shortSectionTitle(long, 48).length, 48);
  });
});

describe("parseCoverageMap", () => {
  it("parses modules with nested anchors and question-frame groups", () => {
    const parsed = parseCoverageMap({
      topic: "Git rebase",
      title: "Git Rebase",
      sections: [
        {
          id: "main",
          title: "Git rebase",
          goal: "Core rebase workflow",
          modules: [
            {
              id: "m1",
              label: "How do I rebase onto main?",
              group: "How",
              hint: "rebase",
              anchors: [
                {
                  id: "a1",
                  label: "Which command replays my branch?",
                  teachGoal: "git rebase main replays your commits onto main.",
                  mustCover: ["git rebase main"],
                },
              ],
            },
          ],
          edges: [{ from: "m1", to: "m2", relation: "leads-to" }],
        },
      ],
    });

    assert.ok(parsed);
    const section = parsed!.map.sections[0];
    assert.equal(parsed!.map.sections.length, 1);
    assert.equal(section.modules?.length, 1);
    assert.equal(section.modules?.[0].group, "How");
    assert.equal(section.modules?.[0].anchors?.length, 1);
    assert.equal(section.edges?.length, 1);
    assert.equal((section as { anchors?: unknown }).anchors, undefined);
  });

  it("accepts standard question-frame group values", () => {
    for (const group of ["What", "How", "When", "Watch", "Compare"]) {
      const parsed = parseCoverageMap({
        topic: "Test",
        title: "Test",
        sections: [
          {
            id: "main",
            title: "Test",
            goal: "Goal",
            modules: [{ id: "m1", label: "Sample question?", group, anchors: [] }],
          },
        ],
      });
      assert.equal(parsed!.map.sections[0].modules?.[0].group, group);
    }
  });

  it("migrates legacy section anchors into modules via linkedModules", () => {
    const parsed = parseCoverageMap({
      topic: "Git",
      title: "Git",
      sections: [
        {
          id: "main",
          title: "Git",
          goal: "Goal",
          anchors: [
            {
              id: "a1",
              label: "Basics",
              teachGoal: "Learn basics",
              mustCover: ["git init"],
              linkedModules: ["m1"],
            },
          ],
          modules: [{ id: "m1", label: "Everyday" }],
        },
      ],
    });
    assert.equal(parsed!.map.sections[0].modules?.[0].anchors?.length, 1);
    assert.equal(parsed!.map.sections[0].modules?.[0].anchors?.[0].label, "Basics");
  });

  it("accepts legacy subtopics as modules", () => {
    const parsed = parseCoverageMap({
      topic: "Git",
      title: "Git",
      sections: [
        {
          id: "main",
          title: "Git",
          goal: "Goal",
          subtopics: [{ id: "m1", label: "Basics" }],
        },
      ],
    });
    assert.equal(parsed!.map.sections[0].modules?.length, 1);
  });

  it("truncates to one section when planner returns multiple", () => {
    const parsed = parseCoverageMap({
      topic: "Git",
      title: "Git",
      sections: [
        { id: "a", title: "A", goal: "A" },
        { id: "b", title: "B", goal: "B" },
      ],
    });
    assert.equal(parsed!.map.sections.length, 1);
    assert.equal(parsed!.sectionsTruncated, true);
    assert.equal(MAX_SECTIONS_PER_SHEET, 1);
    assert.equal(MAX_ANCHORS_PER_MODULE, 2);
  });
});

describe("sanitizeRenderNode", () => {
  it("accepts math node kind", () => {
    const node = sanitizeRenderNode({
      kind: "math",
      props: { latex: "x^2", display: true },
    });
    assert.equal(node?.kind, "math");
    assert.equal(node?.props?.latex, "x^2");
  });

  it("accepts module node kind", () => {
    const node = sanitizeRenderNode({
      kind: "module",
      props: { id: "m1", label: "Basics" },
      children: [
        {
          kind: "anchor",
          props: { label: "Anchor", teachGoal: "Learn" },
        },
      ],
    });
    assert.equal(node?.kind, "module");
    assert.equal(node?.children?.[0]?.kind, "anchor");
  });

  it("accepts moduleMap node kind for legacy trees", () => {
    const node = sanitizeRenderNode({
      kind: "moduleMap",
      props: { nodes: [{ id: "m1", label: "Basics" }] },
    });
    assert.equal(node?.kind, "moduleMap");
  });
});

describe("buildFallbackSectionNode", () => {
  it("builds module cards with nested anchors", () => {
    const node = buildFallbackSectionNode({
      id: "main",
      title: "Git rebase",
      goal: "Core rebase workflow",
      modules: [
        {
          id: "m1",
          label: "How do I rebase onto main?",
          group: "How",
          anchors: [
            {
              id: "a1",
              label: "Which command replays my branch?",
              teachGoal: "Replay commits onto a new base",
              mustCover: ["git rebase main", "git fetch first"],
            },
          ],
        },
        { id: "m2", label: "What if rebase goes wrong?", group: "Watch" },
      ],
      edges: [{ from: "m1", to: "m2", relation: "leads-to" }],
    });

    assert.equal(node.kind, "section");
    assert.equal(node.props?.title, "Git rebase");
    assert.equal(node.props?.moduleEdges, undefined);
    const kinds = (node.children ?? []).map((child) => child.kind);
    assert.ok(kinds.includes("text"));
    assert.ok(kinds.includes("module"));
    assert.equal(kinds.includes("anchor"), false);
    assert.equal(kinds.includes("moduleMap"), false);
    const firstModule = node.children?.find((child) => child.kind === "module");
    assert.equal(firstModule?.children?.[0]?.kind, "anchor");
  });

  it("builds legacy section from mustInclude when no modules", () => {
    const node = buildFallbackSectionNode({
      id: "fi",
      title: "Fixed Income (term structure)",
      goal: "Yield and credit basics",
      mustInclude: ["YTM", "duration", "credit spread"],
    });
    assert.equal(node.kind, "section");
    assert.equal(node.props?.title, "Fixed Income (term structure)");
    assert.ok((node.children?.length ?? 0) >= 1);
    assert.equal(node.children?.some((c) => c.kind === "module"), false);
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

  it("parses section with module and nested anchor", () => {
    const node = parseSectionWriterOutput(
      {
        kind: "section",
        props: { title: "Basics" },
        children: [
          { kind: "text", props: { content: "Framing sentence." } },
          {
            kind: "module",
            props: { id: "m1", label: "Module", group: "G" },
            children: [
              {
                kind: "anchor",
                props: { label: "Anchor", teachGoal: "Learn this" },
                children: [{ kind: "list", props: { items: ["a"] } }],
              },
            ],
          },
        ],
      },
      "Basics",
    );
    assert.equal(node?.kind, "section");
    assert.equal(node?.children?.length, 2);
    assert.equal(node?.children?.[1]?.kind, "module");
    assert.equal(node?.children?.[1]?.children?.[0]?.kind, "anchor");
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
  it("wraps a single section in a one-column grid", () => {
    const tree = assembleCheatSheetTree(
      { topic: "git", title: "Git Rebase", sections: [] },
      [{ kind: "section", props: { title: "Git rebase" } }],
    );
    assert.equal(tree.kind, "sheet");
    assert.equal(tree.children?.[0]?.kind, "grid");
    assert.equal(tree.children?.[0]?.props?.columns, 1);
    assert.equal(tree.children?.[0]?.children?.length, 1);
  });

  it("hides redundant section title when it matches sheet title", () => {
    const tree = assembleCheatSheetTree(
      { topic: "git rebase", title: "Git Rebase — Quick Reference", sections: [] },
      [{ kind: "section", props: { title: "Git Rebase — Quick Reference" } }],
    );
    const section = tree.children?.[0]?.children?.[0];
    assert.equal(section?.props?.hideTitle, true);
  });

  it("uses section title as subtitle when it adds context beyond sheet title", () => {
    const tree = assembleCheatSheetTree(
      {
        topic: "fixed income",
        title: "Fixed Income — Quick Reference",
        sections: [{ id: "main", title: "Fixed Income (term structure)", goal: "Goal" }],
      },
      [{ kind: "section", props: { title: "Fixed Income (term structure)" } }],
    );
    assert.equal(tree.props?.subtitle, "Fixed Income (term structure)");
  });

  it("uses only the first section when multiple nodes are passed", () => {
    const tree = assembleCheatSheetTree(
      { topic: "git", title: "Git", sections: [] },
      [
        { kind: "section", props: { title: "First" } },
        { kind: "section", props: { title: "Second" } },
      ],
    );
    assert.equal(tree.children?.[0]?.children?.length, 1);
    assert.equal(tree.children?.[0]?.children?.[0]?.props?.title, "First");
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
