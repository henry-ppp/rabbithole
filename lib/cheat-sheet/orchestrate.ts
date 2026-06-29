import { Agent, CursorAgentError } from "@cursor/sdk";
import path from "node:path";
import type {
  CheatSheetMeta,
  CheatSheetResponse,
  CoverageSection,
  RenderNode,
} from "./render-contract";
import {
  assembleCheatSheetTree,
  buildFallbackSectionNode,
  describeInvalidSectionOutput,
  extractJsonFromAgentText,
  hasThreeLayerSection,
  parseCoverageMap,
  parseSectionWriterOutput,
  shortSectionTitle,
  validateRenderTree,
} from "./render-contract";
import { loadPlaybook } from "./playbooks";

export type GenerateOptions = {
  topic: string;
  audience?: string;
  depth?: string;
  parentContext?: string;
};

/** Sequential-ish to reduce truncated parallel agent responses. */
const WRITER_CONCURRENCY = 2;

const JSON_RETRY_SUFFIX = `

IMPORTANT: Return ONLY one complete, valid JSON value. No markdown fences, no commentary before or after, no trailing commas. The coverage map must have exactly one section with 3–5 modules (each with required group: What|How|When|Watch|Compare), plain-English question labels, and 1–2 anchors per module. No section-level anchors.`;

const SECTION_WRITER_RETRY_SUFFIX = `

IMPORTANT: Your previous response was invalid or truncated JSON. Return ONE compact three-layer section subtree:
- Max 6 children: one text (goal) + up to 5 module nodes with nested anchors.
- Each module: id, label (plain question), group (What|How|When|Watch|Compare), optional hint (technical alias) + 1–2 anchor children (table with plain headers covering mustCover).
- Put moduleEdges in section props when edges exist.
- teachGoal = one-sentence direct answer; jargon only in table cells.
- Valid JSON only.`;

const SECTION_WRITER_RETRY_SUFFIX_STRICT = `

CRITICAL: JSON must be under 3000 characters total. Smallest valid three-layer section:
- text (goal) + one module (group "How", label as a question) with one anchor (table child, headers ["Term", "Meaning"]).
- No code blocks. props.title: short topic label only.
- Valid JSON only.`;

const SECTION_WRITER_TEMPLATE_SUFFIX = `

Return ONLY this JSON shape (fill in; stay under 2500 characters total):
{"kind":"section","props":{"title":"SHORT_TITLE_HERE"},"layout":{"density":"compact"},"children":[{"kind":"text","props":{"content":"GOAL_HERE"}},{"kind":"module","props":{"id":"m1","label":"How do I do the main task?","hint":"alias","group":"How"},"children":[{"kind":"anchor","props":{"id":"a1","label":"Which step comes first?","teachGoal":"Start with the setup command."},"children":[{"kind":"table","props":{"headers":["Command","What it does"],"rows":[["cmd","outcome"]]}}]}]}]}`;

function buildFramingBlock(audience?: string, depth?: string): string {
  const audienceLine =
    audience?.trim() ||
    "Learner studying this topic for the first time; assume no insider vocabulary in titles.";

  let depthLine =
    "Balance question labels with compact tables; all five question frames (What, How, When, Watch, Compare) are eligible.";
  switch (depth?.trim()) {
    case "exam":
      depthLine =
        "Prioritize What, Compare, and Watch frames; tables emphasize triggers, distinctions, and common mistakes.";
      break;
    case "on-call":
      depthLine =
        "Prioritize How, When, and Watch frames; tables emphasize commands and decision rules.";
      break;
    default:
      break;
  }

  return `Audience: ${audienceLine}
Depth framing: ${depthLine}
Labeling: module labels must be plain-English questions; group must be What|How|When|Watch|Compare; hint holds the technical alias only.`;
}

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

function recordRetrial(meta: CheatSheetMeta, count = 1): void {
  meta.retrialCount = (meta.retrialCount ?? 0) + count;
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
  options?: { retrySuffix?: string; strictRetrySuffix?: string },
): Promise<unknown> {
  const retrySuffix = options?.retrySuffix ?? JSON_RETRY_SUFFIX;
  const strictRetrySuffix = options?.strictRetrySuffix;

  let text = await runAgentPrompt(label, prompt, meta);
  try {
    return parseAgentJson(label, text);
  } catch (firstErr) {
    recordRetrial(meta);
    const retryLabel = `${label} (json-retry)`;
    text = await runAgentPrompt(retryLabel, `${prompt}${retrySuffix}`, meta);
    try {
      return parseAgentJson(retryLabel, text);
    } catch (retryErr) {
      if (strictRetrySuffix) {
        recordRetrial(meta);
        const strictLabel = `${label} (json-retry-strict)`;
        text = await runAgentPrompt(
          strictLabel,
          `${prompt}${strictRetrySuffix}`,
          meta,
        );
        try {
          return parseAgentJson(strictLabel, text);
        } catch {
          /* fall through */
        }
      }
      const first =
        firstErr instanceof Error ? firstErr.message : String(firstErr);
      const second =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(`${label}: ${first} (retry: ${second})`);
    }
  }
}

function sectionPayloadForWriter(section: CoverageSection): CoverageSection {
  const payload: CoverageSection = {
    ...section,
    title: shortSectionTitle(section.title),
  };

  if (section.modules) {
    payload.modules = section.modules.slice(0, 5).map((module) => ({
      ...module,
      anchors: module.anchors?.slice(0, 2).map((anchor) => ({
        ...anchor,
        mustCover: anchor.mustCover.slice(0, 6),
      })),
    }));
  }

  if (section.edges) {
    payload.edges = section.edges.slice(0, 4);
  }

  if (section.mustInclude) {
    payload.mustInclude = section.mustInclude.slice(0, 10);
  }

  return payload;
}

async function runSectionWriter(
  label: string,
  basePrompt: string,
  section: CoverageSection,
  meta: CheatSheetMeta,
): Promise<RenderNode> {
  const displayTitle = shortSectionTitle(section.title);
  const attempts: Array<{ label: string; prompt: string }> = [
    { label, prompt: basePrompt },
    { label: `${label} (json-retry)`, prompt: `${basePrompt}${SECTION_WRITER_RETRY_SUFFIX}` },
    {
      label: `${label} (json-retry-strict)`,
      prompt: `${basePrompt}${SECTION_WRITER_RETRY_SUFFIX_STRICT}`,
    },
    {
      label: `${label} (template)`,
      prompt: `${basePrompt}${SECTION_WRITER_TEMPLATE_SUFFIX.replace("SHORT_TITLE_HERE", displayTitle)}`,
    },
  ];

  let lastError = "unknown error";

  for (let index = 0; index < attempts.length; index += 1) {
    if (index > 0) {
      recordRetrial(meta);
    }
    const attempt = attempts[index]!;
    const text = await runAgentPrompt(attempt.label, attempt.prompt, meta);
    try {
      const raw = parseAgentJson(attempt.label, text);
      const node = parseSectionWriterOutput(raw, displayTitle);
      if (node) {
        return node;
      }
      lastError = describeInvalidSectionOutput(raw);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const fallback = buildFallbackSectionNode(section);
  meta.warnings ??= [];
  meta.warnings.push(
    `Section "${section.title}" used programmatic fallback after agent failures: ${lastError}`,
  );
  meta.phases.push({
    name: `${label} (fallback)`,
    status: "ok",
    error: lastError,
  });
  return fallback;
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
    retrialCount: 0,
  };

  const [coveragePlaybook, writerPlaybook] = await Promise.all([
    loadPlaybook("coverage"),
    loadPlaybook("writer"),
  ]);

  const framingBlock = buildFramingBlock(options.audience, options.depth);

  const parentContext = options.parentContext?.trim().slice(0, 500);
  const parentLine = parentContext
    ? `\nParent context: User drilled from "${parentContext}". Focus the outline on the module topic below; assign 1–2 anchors per module and split remaining coverage into 3–5 question-framed child modules (group: What|How|When|Watch|Compare). No section-level anchors.\n`
    : "\nAt this root level, produce exactly one section with goal framing only. Split the topic into 3–5 question-framed modules; each module gets a required group and 1–2 anchors with plain-English labels. No section-level anchors.\n";

  const plannerPrompt = `${coveragePlaybook}

---
${parentLine}
Topic: ${options.topic}

${framingBlock}

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
      const threeLayer = hasThreeLayerSection(section);
      const writerPrompt = `${writerPlaybook}

---

Topic: ${coverageMap.topic}
Sheet title: ${coverageMap.title}

${framingBlock}

Write one RenderNode subtree for the section below. Return only that subtree JSON (no markdown fences, not an array).
${threeLayer ? "Use the three-layer anatomy: text (goal) + module nodes (each with 1–2 nested anchor children teaching mustCover). Module labels are plain questions; tables use plain-English headers. Only modules are drillable." : "Legacy section: use text + list/table from mustInclude."}
Keep the subtree compact (max 6 children) so the JSON is complete in one response.

Section:
${JSON.stringify(sectionPayloadForWriter(section), null, 2)}`;

      const label = `section-writer:${section.id || index}`;
      return runSectionWriter(label, writerPrompt, section, meta);
    },
  );

  if (sectionNodes.length !== coverageMap.sections.length) {
    throw new Error(
      `Section writers produced ${sectionNodes.length} subtrees, expected ${coverageMap.sections.length}`,
    );
  }

  const tree = assembleCheatSheetTree(coverageMap, sectionNodes);
  meta.phases.push({
    name: "layout-assembler",
    status: "ok",
  });

  const validation = validateRenderTree(tree);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid render tree");
  }

  return { tree, meta };
}

export function getRepoRoot(): string {
  return path.resolve(process.cwd());
}
