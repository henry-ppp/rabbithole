import { Agent, CursorAgentError } from "@cursor/sdk";
import path from "node:path";
import type {
  CheatSheetMeta,
  CheatSheetResponse,
  CoverageSection,
  RenderNode,
} from "./render-contract";
import {
  extractJsonFromAgentText,
  parseCoverageMap,
  sanitizeRenderNode,
  validateRenderTree,
} from "./render-contract";
import { loadPlaybook } from "./playbooks";

export type GenerateOptions = {
  topic: string;
  audience?: string;
  depth?: string;
};

const WRITER_CONCURRENCY = 4;

const JSON_RETRY_SUFFIX = `

IMPORTANT: Return ONLY one complete, valid JSON value. No markdown fences, no commentary before or after, no trailing commas. If the outline is large, keep each mustInclude list concise (8–12 bullets per section) so the JSON fits in one response.`;

function getApiKey(): string {
  const key = process.env.CURSOR_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      "CURSOR_API_KEY is not set. Add it to .env.local for agent generation.",
    );
  }
  return key.trim();
}

function agentOptions(apiKey: string) {
  return {
    apiKey,
    model: { id: "composer-2" as const },
    local: {
      cwd: process.cwd(),
      settingSources: [],
    },
  };
}

async function runAgentPrompt(
  label: string,
  prompt: string,
  meta: CheatSheetMeta,
): Promise<string> {
  const apiKey = getApiKey();
  try {
    const result = await Agent.prompt(prompt, agentOptions(apiKey));
    meta.phases.push({
      name: label,
      status: result.status === "finished" ? "ok" : "error",
      runId: result.id,
      error:
        result.status !== "finished"
          ? `Run ended with status: ${result.status}`
          : undefined,
    });
    if (result.status !== "finished") {
      throw new Error(`${label} failed: ${result.status}`);
    }
    if (!result.result?.trim()) {
      throw new Error(`${label} returned empty result`);
    }
    return result.result;
  } catch (err) {
    if (err instanceof CursorAgentError) {
      meta.phases.push({
        name: label,
        status: "error",
        error: err.message,
      });
      throw new Error(`${label} startup failed: ${err.message}`);
    }
    const existing = meta.phases.find((p) => p.name === label);
    if (!existing) {
      meta.phases.push({
        name: label,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}

function parseAgentJson(label: string, text: string): unknown {
  try {
    return extractJsonFromAgentText(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${label}: ${detail}`);
  }
}

async function runAgentPromptForJson(
  label: string,
  prompt: string,
  meta: CheatSheetMeta,
): Promise<unknown> {
  let text = await runAgentPrompt(label, prompt, meta);
  try {
    return parseAgentJson(label, text);
  } catch (firstErr) {
    const retryLabel = `${label} (json-retry)`;
    text = await runAgentPrompt(
      retryLabel,
      `${prompt}${JSON_RETRY_SUFFIX}`,
      meta,
    );
    try {
      return parseAgentJson(retryLabel, text);
    } catch {
      throw firstErr;
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function generateCheatSheet(
  options: GenerateOptions,
): Promise<CheatSheetResponse> {
  const meta: CheatSheetMeta = {
    source: "agent",
    phases: [],
  };

  const [coveragePlaybook, writerPlaybook, layoutPlaybook] = await Promise.all([
    loadPlaybook("coverage"),
    loadPlaybook("writer"),
    loadPlaybook("layout"),
  ]);

  const constraints = [
    options.audience ? `Audience: ${options.audience}` : null,
    options.depth ? `Depth: ${options.depth}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const plannerPrompt = `${coveragePlaybook}

---

Topic: ${options.topic}
${constraints ? `\n${constraints}` : ""}

Return only the coverage map JSON.`;

  const coverageRaw = await runAgentPromptForJson(
    "planner",
    plannerPrompt,
    meta,
  );
  const parsed = parseCoverageMap(coverageRaw);
  if (!parsed) {
    throw new Error("Planner returned invalid coverage map JSON");
  }
  const coverageMap = parsed.map;
  meta.coverageMap = coverageMap;
  if (parsed.sectionsTruncated) {
    meta.sectionsTruncated = true;
  }

  const sectionNodes = await mapWithConcurrency(
    coverageMap.sections,
    WRITER_CONCURRENCY,
    async (section: CoverageSection, index: number) => {
      const writerPrompt = `${writerPlaybook}

---

Topic: ${coverageMap.topic}
Sheet title: ${coverageMap.title}

Write one RenderNode subtree for the section below. Return only that subtree JSON (no markdown fences, not an array).

Section:
${JSON.stringify(section, null, 2)}`;

      const label = `section-writer:${section.id || index}`;
      const writerRaw = await runAgentPromptForJson(label, writerPrompt, meta);
      const node = sanitizeRenderNode(writerRaw);
      if (!node) {
        throw new Error(
          `Section writer for "${section.title}" returned invalid render node`,
        );
      }
      return node;
    },
  );

  if (sectionNodes.length !== coverageMap.sections.length) {
    throw new Error(
      `Section writers produced ${sectionNodes.length} subtrees, expected ${coverageMap.sections.length}`,
    );
  }

  const layoutPrompt = `${layoutPlaybook}

---

Coverage map:
${JSON.stringify(coverageMap, null, 2)}

Section subtrees:
${JSON.stringify(sectionNodes, null, 2)}

Return the final sheet RenderNode tree JSON only.`;

  const layoutRaw = await runAgentPromptForJson(
    "layout-director",
    layoutPrompt,
    meta,
  );
  const tree = sanitizeRenderNode(layoutRaw);
  if (!tree) {
    throw new Error("Layout director returned invalid render tree");
  }

  const validation = validateRenderTree(tree);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid render tree");
  }

  return { tree, meta };
}

export function getRepoRoot(): string {
  return path.resolve(process.cwd());
}
