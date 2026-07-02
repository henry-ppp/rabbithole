import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_TOPIC_LENGTH,
  cacheKey,
  canDrillDeeper,
  codeDrillLabel,
  resolveFrameLabel,
  withSheetDisplayTitle,
  normalizeDrillLabel,
  createFrame,
  composeChildTopic,
  truncateTopic,
} from "./navigation";
import type { CheatSheetFrame } from "./navigation";
import type { CheatSheetResponse } from "./render-contract";

function stubResponse(): CheatSheetResponse {
  return {
    tree: { kind: "sheet", props: { title: "Test" } },
    meta: { source: "fixture", phases: [] },
  };
}

function frame(label: string, topic: string): CheatSheetFrame {
  return createFrame(label, topic, stubResponse());
}

describe("normalizeDrillLabel", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normalizeDrillLabel("  foo   bar  "), "foo bar");
  });

  it("returns empty for whitespace-only", () => {
    assert.equal(normalizeDrillLabel("   "), "");
  });
});

describe("composeChildTopic", () => {
  it("builds depth-1 topic from root", () => {
    const root = frame("Git rebase", "Git rebase");
    const topic = composeChildTopic([root], {
      label: "Interactive rebase",
      sourceKind: "section",
    });
    assert.equal(topic, "Git rebase — Interactive rebase");
  });

  it("joins deeper path with middle dot separators", () => {
    const root = frame("Git rebase", "Git rebase");
    const child = frame("Interactive rebase", "Git rebase — Interactive rebase");
    const topic = composeChildTopic([root, child], {
      label: "git rebase -i",
      sourceKind: "table",
    });
    assert.equal(
      topic,
      "Git rebase › Interactive rebase — git rebase -i",
    );
  });

  it("truncates to max topic length", () => {
    const long = "a".repeat(150);
    const root = frame("root", long);
    const topic = composeChildTopic([root], {
      label: "b".repeat(100),
      sourceKind: "list",
    });
    assert.equal(topic.length, MAX_TOPIC_LENGTH);
  });
});

describe("cacheKey", () => {
  it("is stable for same inputs", () => {
    const a = cacheKey("Topic", "devs", "cheatsheet");
    const b = cacheKey("Topic", "devs", "cheatsheet");
    assert.equal(a, b);
  });

  it("differs when style changes", () => {
    const cheatsheet = cacheKey("Topic", "", "cheatsheet");
    const roadmap = cacheKey("Topic", "", "roadmap");
    assert.notEqual(cheatsheet, roadmap);
  });

  it("differs when topic changes", () => {
    assert.notEqual(cacheKey("A"), cacheKey("B"));
  });
});

describe("truncateTopic", () => {
  it("leaves short topics unchanged", () => {
    assert.equal(truncateTopic("hello"), "hello");
  });
});

describe("canDrillDeeper", () => {
  it("allows drill until max depth", () => {
    assert.equal(canDrillDeeper(7), true);
    assert.equal(canDrillDeeper(8), false);
  });
});

describe("codeDrillLabel", () => {
  it("uses first line up to 80 chars", () => {
    assert.equal(codeDrillLabel("git rebase -i HEAD~3\nmore"), "git rebase -i HEAD~3");
  });
});

describe("resolveFrameLabel", () => {
  it("prefers displayLabel over drill label", () => {
    assert.equal(
      resolveFrameLabel({
        label: "How do I squash commits?",
        displayLabel: "Interactive rebase",
        sourceKind: "module",
      }),
      "Interactive rebase",
    );
  });
});

describe("withSheetDisplayTitle", () => {
  it("overrides sheet title with clicked module title", () => {
    const patched = withSheetDisplayTitle(stubResponse(), "Everyday workflow");
    assert.equal(patched.tree.props?.title, "Everyday workflow");
  });

  it("hides nested section titles so only the sheet header shows", () => {
    const response: CheatSheetResponse = {
      tree: {
        kind: "sheet",
        props: { title: "Wrong" },
        children: [
          {
            kind: "grid",
            props: { columns: 1 },
            children: [
              {
                kind: "section",
                props: { title: "Agent title" },
                children: [],
              },
            ],
          },
        ],
      },
      meta: { source: "fixture", phases: [] },
    };
    const patched = withSheetDisplayTitle(response, "Asset Allocation & Wealth Planning");
    assert.equal(patched.tree.props?.title, "Asset Allocation & Wealth Planning");
    const section = patched.tree.children?.[0]?.children?.[0];
    assert.equal(section?.kind, "section");
    assert.equal(section?.props?.hideTitle, true);
  });
});
