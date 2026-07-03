import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAgentOptions,
  ensureWritableHomeForServerless,
  resolveAgentRuntime,
} from "./agent-client";

describe("ensureWritableHomeForServerless", () => {
  it("redirects HOME to tmpdir on Vercel", () => {
    const prevVercel = process.env.VERCEL;
    const prevHome = process.env.HOME;
    const prevTmpdir = process.env.TMPDIR;

    process.env.VERCEL = "1";
    process.env.HOME = "/var/task";
    delete process.env.TMPDIR;

    ensureWritableHomeForServerless();

    assert.notEqual(process.env.HOME, "/var/task");
    assert.equal(process.env.TMPDIR, process.env.HOME);

    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = prevTmpdir;
  });
});

describe("resolveAgentRuntime", () => {
  it("defaults to local", () => {
    const prev = process.env.CURSOR_AGENT_RUNTIME;
    delete process.env.CURSOR_AGENT_RUNTIME;
    assert.equal(resolveAgentRuntime(), "local");
    if (prev === undefined) delete process.env.CURSOR_AGENT_RUNTIME;
    else process.env.CURSOR_AGENT_RUNTIME = prev;
  });
});

describe("buildAgentOptions", () => {
  it("builds local options by default", () => {
    const prev = process.env.CURSOR_AGENT_RUNTIME;
    delete process.env.CURSOR_AGENT_RUNTIME;
    const options = buildAgentOptions("test-key");
    assert.equal(options.apiKey, "test-key");
    assert.ok(options.local?.cwd);
    assert.equal(options.cloud, undefined);
    if (prev === undefined) delete process.env.CURSOR_AGENT_RUNTIME;
    else process.env.CURSOR_AGENT_RUNTIME = prev;
  });
});
