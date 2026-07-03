import os from "node:os";
import type { AgentOptions } from "@cursor/sdk";

export type AgentRuntime = "local" | "cloud";

/**
 * Vercel/Lambda set HOME to the read-only deployment root (/var/task).
 * Local Cursor agents need a writable home for SQLite and run-store state.
 * Mutate process.env in-process — Vercel blocks overriding HOME in the dashboard.
 */
export function ensureWritableHomeForServerless(): void {
  if (process.env.VERCEL !== "1" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return;
  }

  const tmp = os.tmpdir();
  if (!process.env.HOME || process.env.HOME === "/var/task") {
    process.env.HOME = tmp;
  }
  if (!process.env.TMPDIR) {
    process.env.TMPDIR = tmp;
  }
}

/** Local unless CURSOR_AGENT_RUNTIME=cloud is explicitly set. */
export function resolveAgentRuntime(): AgentRuntime {
  const override = process.env.CURSOR_AGENT_RUNTIME?.trim().toLowerCase();
  if (override === "cloud") return "cloud";
  if (override === "local") return "local";
  return "local";
}

export function buildAgentOptions(apiKey: string): AgentOptions {
  const runtime = resolveAgentRuntime();
  const base = {
    apiKey,
    model: { id: "composer-2" as const },
  };

  if (runtime === "cloud") {
    return { ...base, cloud: {} };
  }

  return {
    ...base,
    local: {
      cwd: process.cwd(),
      settingSources: [],
    },
  };
}

ensureWritableHomeForServerless();
