import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFallbackConceptGraphTree,
  groupNodesByLayer,
  layoutConceptGraph,
  NODE_HEIGHT,
  LAYER_BAND_GAP_PX,
  parseConceptGraphMap,
  resolveLayersById,
  validateConceptGraphTree,
} from "./concept-graph";
import { sanitizeRenderNode } from "./render-contract";
import { normalizeStyle, styleLabel, styleSupportsDrill } from "./styles";

describe("normalizeStyle", () => {
  it("defaults to cheatsheet", () => {
    assert.equal(normalizeStyle(), "cheatsheet");
    assert.equal(normalizeStyle(""), "cheatsheet");
  });

  it("accepts roadmap", () => {
    assert.equal(normalizeStyle("roadmap"), "roadmap");
  });

  it("accepts concept-graph aliases", () => {
    assert.equal(normalizeStyle("concept-graph"), "roadmap");
    assert.equal(normalizeStyle("concept_graph"), "roadmap");
  });

  it("maps legacy depth values to cheatsheet", () => {
    assert.equal(normalizeStyle("reference"), "cheatsheet");
    assert.equal(normalizeStyle("exam"), "cheatsheet");
    assert.equal(normalizeStyle("on-call"), "cheatsheet");
  });
});

describe("styleSupportsDrill", () => {
  it("enables drill only for cheatsheet", () => {
    assert.equal(styleSupportsDrill("cheatsheet"), true);
    assert.equal(styleSupportsDrill("roadmap"), false);
  });
});

describe("styleLabel", () => {
  it("uses Concept graph for roadmap style", () => {
    assert.equal(styleLabel("roadmap"), "Concept graph");
    assert.equal(styleLabel("cheatsheet"), "Cheat sheet");
  });
});

describe("parseConceptGraphMap", () => {
  it("parses nodes and edges", () => {
    const parsed = parseConceptGraphMap({
      topic: "Git rebase",
      title: "Git Rebase — Concept Map",
      graph: {
        nodes: [
          {
            id: "commits",
            label: "What is a commit chain?",
            layer: 0,
            mustCover: ["commit = snapshot"],
          },
          {
            id: "rebase",
            label: "What does rebase do?",
            layer: 1,
            mustCover: ["git rebase main"],
          },
        ],
        edges: [{ from: "commits", to: "rebase", relation: "requires" }],
      },
    });

    assert.ok(parsed);
    assert.equal(parsed!.map.nodes.length, 2);
    assert.equal(parsed!.map.edges.length, 1);
    assert.equal(parsed!.map.nodes[0].layer, 0);
  });
});

describe("buildFallbackConceptGraphTree", () => {
  it("builds a valid conceptGraph tree", () => {
    const parsed = parseConceptGraphMap({
      topic: "Git",
      title: "Git — Concept Map",
      graph: {
        nodes: [
          {
            id: "a",
            label: "What is A?",
            layer: 0,
            mustCover: ["fact one", "fact two"],
          },
        ],
        edges: [],
      },
    });
    assert.ok(parsed);
    const tree = buildFallbackConceptGraphTree(parsed!.map);
    assert.equal(tree.kind, "conceptGraph");
    assert.equal(tree.children?.[0]?.kind, "conceptNode");
    const validation = validateConceptGraphTree(tree);
    assert.equal(validation.ok, true);
  });
});

describe("layoutConceptGraph", () => {
  it("places layer 0 above layer 1", () => {
    const positions = layoutConceptGraph(
      [
        { id: "root", layer: 0 },
        { id: "child", layer: 1 },
      ],
      [{ from: "root", to: "child", relation: "requires" }],
    );
    const root = positions.get("root");
    const child = positions.get("child");
    assert.ok(root && child);
    assert.ok(child.y > root.y);
  });

  it("keeps adjacent layers separated by at least one card height plus gap", () => {
    const nodes = [
      { id: "l0", layer: 0 },
      { id: "l1", layer: 1 },
      { id: "l2", layer: 2 },
      { id: "l3", layer: 3 },
      { id: "l4", layer: 4 },
    ];
    const edges = [
      { from: "l0", to: "l1", relation: "requires" as const },
      { from: "l1", to: "l2", relation: "requires" as const },
      { from: "l2", to: "l3", relation: "requires" as const },
      { from: "l3", to: "l4", relation: "requires" as const },
    ];
    const positions = layoutConceptGraph(nodes, edges);
    const layers = resolveLayersById(nodes, edges);
    const sortedLayerIndices = Array.from(new Set(layers.values())).sort(
      (a, b) => a - b,
    );

    for (let i = 0; i < sortedLayerIndices.length - 1; i++) {
      const upperLayer = sortedLayerIndices[i];
      const lowerLayer = sortedLayerIndices[i + 1];
      const upperIds = nodes
        .filter((n) => (layers.get(n.id) ?? 0) === upperLayer)
        .map((n) => n.id);
      const lowerIds = nodes
        .filter((n) => (layers.get(n.id) ?? 0) === lowerLayer)
        .map((n) => n.id);

      const maxUpperBottom = Math.max(
        ...upperIds.map((id) => {
          const pos = positions.get(id);
          assert.ok(pos);
          return pos.y + NODE_HEIGHT;
        }),
      );
      const minLowerTop = Math.min(
        ...lowerIds.map((id) => {
          const pos = positions.get(id);
          assert.ok(pos);
          return pos.y;
        }),
      );
      assert.ok(
        minLowerTop >= maxUpperBottom,
        `layer ${lowerLayer} overlaps layer ${upperLayer}`,
      );
    }
  });
});

describe("groupNodesByLayer", () => {
  it("groups nodes by resolved layer", () => {
    const grouped = groupNodesByLayer(
      [
        { id: "a", layer: 0 },
        { id: "b", layer: 0 },
        { id: "c", layer: 1 },
      ],
      [{ from: "a", to: "c", relation: "requires" }],
    );
    assert.deepEqual(grouped.get(0), ["a", "b"]);
    assert.deepEqual(grouped.get(1), ["c"]);
  });

  it("bumps target layer when edge violates ordering", () => {
    const grouped = groupNodesByLayer(
      [
        { id: "root", layer: 0 },
        { id: "child", layer: 0 },
      ],
      [{ from: "root", to: "child", relation: "requires" }],
    );
    assert.deepEqual(grouped.get(0), ["root"]);
    assert.deepEqual(grouped.get(1), ["child"]);
  });

  it("returns layers in ascending order when iterated", () => {
    const grouped = groupNodesByLayer(
      [
        { id: "a", layer: 2 },
        { id: "b", layer: 0 },
        { id: "c", layer: 1 },
      ],
      [],
    );
    const layers = Array.from(grouped.keys()).sort((a, b) => a - b);
    assert.deepEqual(layers, [0, 1, 2]);
  });

  it("uses flex band gap constant large enough for typical cards", () => {
    assert.ok(LAYER_BAND_GAP_PX >= 40);
  });
});

describe("validateConceptGraphTree", () => {
  it("rejects cycles", () => {
    const tree = sanitizeRenderNode({
      kind: "conceptGraph",
      props: {
        edges: [
          { from: "a", to: "b", relation: "requires" },
          { from: "b", to: "a", relation: "requires" },
        ],
      },
      children: [
        { kind: "conceptNode", props: { id: "a", label: "A", layer: 0 } },
        { kind: "conceptNode", props: { id: "b", label: "B", layer: 1 } },
      ],
    });
    assert.ok(tree);
    const validation = validateConceptGraphTree(tree!);
    assert.equal(validation.ok, false);
  });
});
