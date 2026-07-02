import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conceptGraphToFlowElements,
  layoutConceptFlow,
  orderNodesByBarycenter,
  parseConceptNodesFromTree,
  upstreamPath,
} from "./concept-flow";
import { groupNodesByLayer, resolveLayersById, validateConceptGraphTree } from "./concept-graph";
import { sanitizeRenderNode } from "./render-contract";
import { cfaLevel3RoadmapFixture, gitRebaseRoadmapFixture } from "./fixture";

describe("parseConceptNodesFromTree", () => {
  it("extracts compact concept nodes with key terms", () => {
    const nodes = parseConceptNodesFromTree(gitRebaseRoadmapFixture.tree);
    assert.equal(nodes.length, 6);
    assert.equal(nodes[0]?.label, "Commit chain");
    assert.equal(nodes[0]?.hint, "commits");
    assert.deepEqual(nodes[0]?.keyTerms, ["commit", "branch", "tip"]);
  });
});

describe("orderNodesByBarycenter", () => {
  it("aligns targets under their primary source on CFA fixture", () => {
    const concepts = parseConceptNodesFromTree(cfaLevel3RoadmapFixture.tree);
    const edges = cfaLevel3RoadmapFixture.tree.props?.edges as Array<{
      from: string;
      to: string;
    }>;
    const layerById = resolveLayersById(
      concepts.map((c) => ({ id: c.id, layer: c.layer })),
      edges,
    );
    const groups = groupNodesByLayer(
      concepts.map((c) => ({ id: c.id, layer: c.layer })),
      edges,
    );
    const ordered = orderNodesByBarycenter(groups, edges, layerById);
    const layer1 = ordered.get(1) ?? [];
    assert.ok(layer1.indexOf("asset-allocation") < layer1.indexOf("risk-management"));
  });
});

describe("conceptGraphToFlowElements", () => {
  it("builds nodes and bezier concept edges from a concept graph tree", () => {
    const { nodes, edges } = conceptGraphToFlowElements(
      gitRebaseRoadmapFixture.tree,
      null,
      null,
    );
    assert.equal(nodes.length, 6);
    assert.equal(edges.length, 6);
    assert.ok(nodes.every((node) => node.type === "concept"));
    assert.ok(edges.every((edge) => edge.type === "concept"));
    assert.ok(
      edges.every(
        (edge) =>
          (edge.data as { highlighted: boolean }).highlighted === false,
      ),
    );
  });

  it("marks non-path nodes as dimmed when expanded", () => {
    const graphEdges = [
      { from: "commits", to: "rebase" },
      { from: "rebase", to: "interactive" },
      { from: "interactive", to: "onto" },
      { from: "commits", to: "merge" },
    ];
    const { nodes } = conceptGraphToFlowElements(
      gitRebaseRoadmapFixture.tree,
      "onto",
      upstreamPath("onto", graphEdges),
    );
    const merge = nodes.find((node) => node.id === "merge");
    const rebase = nodes.find((node) => node.id === "rebase");
    assert.equal(merge?.data.dimmed, true);
    assert.equal(rebase?.data.dimmed, false);
  });

  it("creates one edge per source-target pair on CFA fan-in", () => {
    const { edges } = conceptGraphToFlowElements(
      cfaLevel3RoadmapFixture.tree,
      null,
      null,
    );
    const keys = edges.map((edge) => `${edge.source}->${edge.target}`);
    assert.equal(keys.length, new Set(keys).size);
    assert.equal(keys.length, 7);
  });
});

describe("layoutConceptFlow", () => {
  it("places CFA nodes in four distinct layer bands", () => {
    const { nodes, edges } = conceptGraphToFlowElements(
      cfaLevel3RoadmapFixture.tree,
      null,
      null,
    );
    const graphEdges = cfaLevel3RoadmapFixture.tree.props?.edges as Array<{
      from: string;
      to: string;
    }>;
    const laidOut = layoutConceptFlow(nodes, edges, graphEdges);

    const byLayer = new Map<number, number[]>();
    for (const node of laidOut) {
      const bucket = byLayer.get(node.data.layer) ?? [];
      bucket.push(node.position.y);
      byLayer.set(node.data.layer, bucket);
    }

    const layerYs = Array.from(byLayer.entries()).sort(([a], [b]) => a - b);
    for (let i = 0; i < layerYs.length - 1; i++) {
      const maxUpper = Math.max(...layerYs[i]![1]);
      const minLower = Math.min(...layerYs[i + 1]![1]);
      assert.ok(minLower > maxUpper);
    }
  });
});

describe("validateConceptGraphTree", () => {
  it("rejects skip-layer edges", () => {
    const tree = sanitizeRenderNode({
      kind: "conceptGraph",
      props: {
        edges: [{ from: "a", to: "c", relation: "requires" }],
      },
      children: [
        {
          kind: "conceptNode",
          props: { id: "a", label: "A", layer: 0 },
        },
        {
          kind: "conceptNode",
          props: { id: "b", label: "B", layer: 1 },
        },
        {
          kind: "conceptNode",
          props: { id: "c", label: "C", layer: 2 },
        },
      ],
    });
    assert.ok(tree);
    const validation = validateConceptGraphTree(tree!);
    assert.equal(validation.ok, false);
    assert.match(String(validation.error), /adjacent layers/);
  });

  it("accepts CFA Level 3 fixture graph", () => {
    const validation = validateConceptGraphTree(cfaLevel3RoadmapFixture.tree);
    assert.equal(validation.ok, true);
  });
});
