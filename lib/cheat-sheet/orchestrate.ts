import { Agent, CursorAgentError } from "@cursor/sdk";
import path from "node:path";
import type {
  CheatSheetMeta,
  CheatSheetResponse,
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

  const plannerText = await runAgentPrompt("planner", plannerPrompt, meta);
  const coverageRaw = extractJsonFromAgentText(plannerText);
  const coverageMap = parseCoverageMap(coverageRaw);
  if (!coverageMap) {
    throw new Error("Planner returned invalid coverage map JSON");
  }
  meta.coverageMap = coverageMap;

  const writerPrompt = `${writerPlaybook}

---

Topic: ${coverageMap.topic}
Sheet title: ${coverageMap.title}

Write one RenderNode subtree per section below. Return a JSON array of subtrees in the same order as sections (no markdown fences).

Sections:
${JSON.stringify(coverageMap.sections, null, 2)}`;

  const writerText = await runAgentPrompt("section-writers", writerPrompt, meta);
  const writerRaw = extractJsonFromAgentText(writerText);
  const sectionNodes: RenderNode[] = [];

  const rawList = Array.isArray(writerRaw) ? writerRaw : [writerRaw];
  for (const item of rawList) {
    const node = sanitizeRenderNode(item);
    if (node) {
      sectionNodes.push(node);
    }
  }

  if (sectionNodes.length === 0) {
    throw new Error("Section writers returned no valid render nodes");
  }

  const layoutPrompt = `${layoutPlaybook}

---

Coverage map:
${JSON.stringify(coverageMap, null, 2)}

Section subtrees:
${JSON.stringify(sectionNodes, null, 2)}

Return the final sheet RenderNode tree JSON only.`;

  const layoutText = await runAgentPrompt("layout-director", layoutPrompt, meta);
  const layoutRaw = extractJsonFromAgentText(layoutText);
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
