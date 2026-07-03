import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getFixtureForStyle, gitRebaseFixture, gitRebaseRoadmapFixture } from "./fixture";
import {
  buildCheatsheetSkeletonResponse,
  buildRoadmapSkeletonResponse,
} from "./orchestrate";
import { parseNdjsonEvents, streamingStatusLabel } from "./stream-client";
import {
  responseWithoutStage,
  responseWithStage,
  safeEmit,
  type CheatSheetStreamEvent,
} from "./stream-events";

describe("buildCheatsheetSkeletonResponse", () => {
  it("builds a sheet tree with skeleton stage", () => {
    const coverageMap = gitRebaseFixture.meta.coverageMap!;
    const result = buildCheatsheetSkeletonResponse(coverageMap, {
      source: "agent",
      style: "cheatsheet",
      phases: [],
    });

    assert.equal(result.meta.streamingStage, "skeleton");
    assert.equal(result.tree.kind, "sheet");
    assert.ok(result.tree.children?.length);
  });
});

describe("buildRoadmapSkeletonResponse", () => {
  it("builds a concept graph with skeleton stage", () => {
    const graphMap = gitRebaseRoadmapFixture.meta.conceptGraph!;
    const result = buildRoadmapSkeletonResponse(graphMap, {
      source: "agent",
      style: "roadmap",
      phases: [],
    });

    assert.equal(result.meta.streamingStage, "skeleton");
    assert.equal(result.tree.kind, "conceptGraph");
    assert.ok((result.tree.children?.length ?? 0) > 0);
  });
});

describe("stream event helpers", () => {
  it("responseWithoutStage strips streamingStage", () => {
    const staged = responseWithStage(getFixtureForStyle("cheatsheet"), "final");
    assert.equal(staged.meta.streamingStage, "final");
    const cleaned = responseWithoutStage(staged);
    assert.equal(cleaned.meta.streamingStage, undefined);
  });

  it("safeEmit swallows consumer throws", () => {
    const events: CheatSheetStreamEvent[] = [];
    safeEmit((event) => {
      events.push(event);
      throw new Error("client disconnected");
    }, { type: "phase", name: "planner", status: "start" });
    assert.equal(events.length, 1);
  });
});

describe("parseNdjsonEvents", () => {
  it("parses fixture-style skeleton and done events", () => {
    const fixture = getFixtureForStyle("cheatsheet");
    const coverageMap = fixture.meta.coverageMap!;
    const skeleton = buildCheatsheetSkeletonResponse(coverageMap, {
      source: "fixture",
      style: "cheatsheet",
      phases: [{ name: "fixture", status: "ok" }],
    });
    const final = responseWithoutStage(fixture);

    const ndjson = [
      JSON.stringify({
        type: "partial",
        stage: "skeleton",
        tree: skeleton.tree,
        meta: skeleton.meta,
      }),
      JSON.stringify({
        type: "done",
        tree: final.tree,
        meta: final.meta,
      }),
    ].join("\n");

    const events = parseNdjsonEvents(ndjson);
    assert.equal(events.length, 2);
    assert.equal(events[0]?.type, "partial");
    assert.equal(events[1]?.type, "done");
    if (events[0]?.type === "partial") {
      assert.equal(events[0].stage, "skeleton");
    }
  });
});

describe("streamingStatusLabel", () => {
  it("returns planning copy for skeleton stage", () => {
    assert.equal(streamingStatusLabel("skeleton", "roadmap"), "Planning concept graph…");
    assert.equal(streamingStatusLabel("skeleton", "cheatsheet"), "Planning outline…");
  });

  it("returns writing copy for final stage", () => {
    assert.equal(streamingStatusLabel("final", "roadmap"), "Writing content…");
  });

  it("returns null when not streaming", () => {
    assert.equal(streamingStatusLabel(undefined, "roadmap"), null);
  });
});
