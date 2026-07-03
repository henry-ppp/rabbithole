import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCheatSheetRequest } from "./parse-request";

describe("parseCheatSheetRequest", () => {
  it("accepts a valid cheatsheet request", () => {
    const parsed = parseCheatSheetRequest({
      topic: "  Git branching  ",
      audience: " beginners ",
      style: "cheatsheet",
      parentContext: "Git",
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.topic, "Git branching");
    assert.equal(parsed.audience, "beginners");
    assert.equal(parsed.style, "cheatsheet");
    assert.equal(parsed.parentContext, "Git");
    assert.equal(parsed.useFixture, false);
  });

  it("accepts concept-graph as a roadmap alias", () => {
    const parsed = parseCheatSheetRequest({
      topic: "Machine learning",
      style: "concept-graph",
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.style, "roadmap");
  });

  it("rejects missing or overlong topics", () => {
    assert.equal(parseCheatSheetRequest({ topic: "  " }).ok, false);
    assert.equal(parseCheatSheetRequest({ topic: "x".repeat(201) }).ok, false);
  });

  it("rejects roadmap drill-down via parentContext", () => {
    const parsed = parseCheatSheetRequest({
      topic: "Subtopic",
      style: "roadmap",
      parentContext: "Parent",
    });

    assert.equal(parsed.ok, false);
    if (parsed.ok) return;

    assert.equal(parsed.status, 400);
    assert.match(parsed.error, /drill-down/i);
  });

  it("allows fixture mode without a topic", () => {
    const parsed = parseCheatSheetRequest({
      useFixture: true,
      style: "roadmap",
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.topic, "fixture");
    assert.equal(parsed.useFixture, true);
    assert.equal(parsed.style, "roadmap");
  });

  it("maps legacy depth to style", () => {
    const parsed = parseCheatSheetRequest({
      topic: "Topic",
      depth: "exam",
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.style, "cheatsheet");
  });
});
