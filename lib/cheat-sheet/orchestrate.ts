import { Agent, CursorAgentError } from "@cursor/sdk";
import path from "node:path";
import {
  buildFallbackConceptGraphTree,
  describeInvalidConceptGraphOutput,
  parseConceptGraphMap,
  parseConceptGraphWriterOutput,
  validateConceptGraphTree,
  type ConceptGraphMap,
} from "./concept-graph";
import type {
  CheatSheetMeta,
  CheatSheetResponse,
  CoverageMap,
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
  sanitizeRenderNode,
  shortSectionTitle,
  validateRenderTree,
} from "./render-contract";
import {
  loadStylePlaybooks,
  normalizeStyle,
  type KnowledgeStyle,
} from "./styles";
import {
  responseWithoutStage,
  responseWithStage,
  safeEmit,
  type StreamEmit,
} from "./stream-events";

export type GenerateOptions = {
  topic: string;
  audience?: string;
  style?: string;
  /** @deprecated use style */
  depth?: string;
  parentContext?: string;
  signal?: AbortSignal;
};

export class GenerationAbortedError extends Error {
  constructor() {
    super("Generation aborted");
    this.name = "AbortError";
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GenerationAbortedError();
  }
}

const WRITER_CONCURRENCY = 2;

const CHEATSHEET_JSON_RETRY_SUFFIX = `

IMPORTANT: Return ONLY one complete, valid JSON value. No markdown fences, no commentary before or after, no trailing commas. The coverage map must have exactly one section with 3–5 modules (each with required group: What|How|When|Watch|Compare), short topic phrase labels (not questions), visible hint titles, and 1–2 anchors per module. No section-level anchors. For curriculum/cert topics, modules = official syllabus areas.`;

const ROADMAP_JSON_RETRY_SUFFIX = `

IMPORTANT: Return ONLY one complete, valid JSON concept graph. No markdown fences. Must include graph.nodes (5–10) and graph.edges forming a DAG. Layer 0 = foundational roots. Short topic phrase labels (not questions).`;

const SECTION_WRITER_RETRY_SUFFIX = `

IMPORTANT: Your previous response was invalid or truncated JSON. Return ONE compact three-layer section subtree:
- Max 6 children: one text (goal) + up to 5 module nodes with nested anchors.
- Each module: id, label (drill topic phrase), group (What|How|When|Watch|Compare), hint (short visible title, ≤40 chars) + 1–2 anchor children (teachGoal + list/diagram/table covering mustCover).
- Do not emit moduleEdges or relationship rows.
- Vary presentation — not every anchor needs a table.
- Valid JSON only.`;

const SECTION_WRITER_RETRY_SUFFIX_STRICT = `

CRITICAL: JSON must be under 3000 characters total. Smallest valid three-layer section:
- text (goal) + one module (group "How") with one anchor (list child with 2–3 items).
- No code blocks. props.title: short topic label only.
- Valid JSON only.`;

const SECTION_WRITER_TEMPLATE_SUFFIX = `

Return ONLY this JSON shape (fill in; stay under 2500 characters total):
{"kind":"section","props":{"title":"SHORT_TITLE_HERE"},"layout":{"density":"compact"},"children":[{"kind":"text","props":{"content":"GOAL_HERE"}},{"kind":"module","props":{"id":"m1","label":"Core workflow","hint":"Everyday workflow","group":"How"},"children":[{"kind":"anchor","props":{"id":"a1","label":"Setup steps","teachGoal":"Start with environment setup."},"children":[{"kind":"list","props":{"items":["Step one","Step two"]}}]}]}]}`;

const GRAPH_WRITER_RETRY_SUFFIX = `

IMPORTANT: Return ONE conceptGraph JSON. Root kind "conceptGraph" with props.edges and conceptNode children (each with id, label, layer, teachGoal, list or diagram child). Max 10 nodes. Valid JSON only.`;

const GRAPH_WRITER_TEMPLATE_SUFFIX = `

Return ONLY this JSON shape (fill in; stay under 4000 characters):
{"kind":"conceptGraph","props":{"title":"TITLE","subtitle":"TOPIC","edges":[{"from":"n1","to":"n2","relation":"requires"}]},"children":[{"kind":"conceptNode","props":{"id":"n1","label":"Foundation","teachGoal":"One sentence.","layer":0},"children":[{"kind":"list","props":{"items":["Key point A","Key point B"]}}]}]}`;

function buildFramingBlock(audience: string | undefined, style: KnowledgeStyle): string {
  const audienceLine =
    audience?.trim() ||
    "Learner studying this topic for the first time; assume no insider vocabulary in titles.";

  if (style === "roadmap") {
    return `Audience: ${audienceLine}
Style: Interactive concept roadmap — show how ideas build on each other as a directed graph.
Labeling: plain-English question labels on nodes; layer 0 = foundations at the top.`;
  }

  return `Audience: ${audienceLine}
Style: Cheat sheet — scannable topic-area modules with visible hint titles (never questions).
Labeling: module \`hint\` = visible card title; \`label\` = short drill phrase (not a question).
Presentation: prefer \`list\` for enumerations, \`diagram\` (mermaid with \`caption\` beside the graph) for structure/flows/dependencies, \`table\` only for side-by-side comparisons — do not default every anchor to a table.
Curriculum & certification topics (CFA levels, CPA, exam syllabi): each module must map to a major official curriculum area or reading block; showcase the structure and contents of that curriculum — not generic exam tips, essay technique, or study advice unless the topic explicitly asks for that.`;
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
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  const apiKey = getApiKey();
  let agent: Awaited<ReturnType<typeof Agent.create>> | null = null;

  try {
    agent = await Agent.create(agentOptions(apiKey));
    throwIfAborted(signal);

    const run = await agent.send(prompt);
    const runId = run.id;

    const onAbort = () => {
      if (run.supports("cancel")) {
        void run.cancel().catch(() => undefined);
        return;
      }
      void Agent.cancelRun(runId, { cwd: process.cwd() }).catch(() => undefined);
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    let result: Awaited<ReturnType<typeof run.wait>>;
    try {
      throwIfAborted(signal);
      result = await run.wait();
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }

    throwIfAborted(signal);

    meta.phases.push({
      name: label,
      status: result.status === "finished" ? "ok" : "error",
      runId: result.id,
      error:
        result.status !== "finished"
          ? `Run ended with status: ${result.status}`
          : undefined,
    });

    if (result.status === "cancelled" || signal?.aborted) {
      throw new GenerationAbortedError();
    }
    if (result.status !== "finished") {
      throw new Error(`${label} failed: ${result.status}`);
    }
    if (!result.result?.trim()) {
      throw new Error(`${label} returned empty result`);
    }
    return result.result;
  } catch (err) {
    if (signal?.aborted || err instanceof GenerationAbortedError) {
      throw new GenerationAbortedError();
    }
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
  } finally {
    agent?.close();
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
  options?: { retrySuffix?: string; strictRetrySuffix?: string; signal?: AbortSignal },
): Promise<unknown> {
  const retrySuffix = options?.retrySuffix ?? CHEATSHEET_JSON_RETRY_SUFFIX;
  const strictRetrySuffix = options?.strictRetrySuffix;
  const signal = options?.signal;

  let text = await runAgentPrompt(label, prompt, meta, signal);
  try {
    return parseAgentJson(label, text);
  } catch (firstErr) {
    recordRetrial(meta);
    const retryLabel = `${label} (json-retry)`;
    text = await runAgentPrompt(retryLabel, `${prompt}${retrySuffix}`, meta, signal);
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
          signal,
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
  signal?: AbortSignal,
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
    throwIfAborted(signal);
    if (index > 0) {
      recordRetrial(meta);
    }
    const attempt = attempts[index]!;
    const text = await runAgentPrompt(attempt.label, attempt.prompt, meta, signal);
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

async function runGraphWriter(
  label: string,
  basePrompt: string,
  graphMap: ConceptGraphMap,
  meta: CheatSheetMeta,
  signal?: AbortSignal,
): Promise<RenderNode> {
  const attempts: Array<{ label: string; prompt: string }> = [
    { label, prompt: basePrompt },
    { label: `${label} (json-retry)`, prompt: `${basePrompt}${GRAPH_WRITER_RETRY_SUFFIX}` },
    {
      label: `${label} (template)`,
      prompt: `${basePrompt}${GRAPH_WRITER_TEMPLATE_SUFFIX.replace("TOPIC", graphMap.topic).replace("TITLE", graphMap.title)}`,
    },
  ];

  let lastError = "unknown error";

  for (let index = 0; index < attempts.length; index += 1) {
    throwIfAborted(signal);
    if (index > 0) {
      recordRetrial(meta);
    }
    const attempt = attempts[index]!;
    const text = await runAgentPrompt(attempt.label, attempt.prompt, meta, signal);
    try {
      const raw = parseAgentJson(attempt.label, text);
      const node = parseConceptGraphWriterOutput(raw, sanitizeRenderNode);
      if (node) {
        return node;
      }
      lastError = describeInvalidConceptGraphOutput(raw);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const fallback = buildFallbackConceptGraphTree(graphMap);
  meta.warnings ??= [];
  meta.warnings.push(
    `Concept graph used programmatic fallback after agent failures: ${lastError}`,
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
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      throwIfAborted(signal);
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!, index);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function emitPhase(
  emit: StreamEmit | undefined,
  name: string,
  status: "start" | "ok",
): void {
  if (!emit) return;
  safeEmit(emit, { type: "phase", name, status });
}

function emitPartial(
  emit: StreamEmit | undefined,
  response: CheatSheetResponse,
  stage: "skeleton" | "final",
): void {
  if (!emit) return;
  const staged = responseWithStage(response, stage);
  safeEmit(emit, {
    type: "partial",
    stage,
    tree: staged.tree,
    meta: staged.meta,
  });
}

/** Build a renderable skeleton from planner coverage output. */
export function buildCheatsheetSkeletonResponse(
  coverageMap: CoverageMap,
  meta: CheatSheetMeta,
): CheatSheetResponse {
  const sectionNodes = coverageMap.sections.map((section) =>
    buildFallbackSectionNode(section),
  );
  return responseWithStage(
    { tree: assembleCheatSheetTree(coverageMap, sectionNodes), meta },
    "skeleton",
  );
}

/** Build a renderable skeleton from roadmap planner output. */
export function buildRoadmapSkeletonResponse(
  graphMap: ConceptGraphMap,
  meta: CheatSheetMeta,
): CheatSheetResponse {
  return responseWithStage(
    { tree: buildFallbackConceptGraphTree(graphMap), meta },
    "skeleton",
  );
}

async function generateCheatsheetStyle(
  options: GenerateOptions,
  style: KnowledgeStyle,
  meta: CheatSheetMeta,
  emit?: StreamEmit,
): Promise<CheatSheetResponse> {
  const playbooks = await loadStylePlaybooks(style);
  const framingBlock = buildFramingBlock(options.audience, style);

  const parentContext = options.parentContext?.trim().slice(0, 500);
  const parentLine = parentContext
    ? `\nParent context: User drilled from "${parentContext}". Focus the outline on the module topic below; assign 1–2 anchors per module and split remaining coverage into 3–5 topic-area child modules (group: What|How|When|Watch|Compare). No section-level anchors.\n`
    : "\nAt this root level, produce exactly one section with goal framing only. Split the topic into 3–5 topic-area modules (each with required group and visible hint title); each module gets 1–2 anchors. No section-level anchors.\n";

  throwIfAborted(options.signal);
  const plannerPrompt = `${playbooks.coverage}

---
${parentLine}
Topic: ${options.topic}

${framingBlock}

Return only the coverage map JSON.`;

  emitPhase(emit, "planner", "start");
  const coverageRaw = await runAgentPromptForJson(
    "planner",
    plannerPrompt,
    meta,
    { signal: options.signal },
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
  emitPhase(emit, "planner", "ok");

  throwIfAborted(options.signal);
  const skeleton = buildCheatsheetSkeletonResponse(coverageMap, meta);
  emitPartial(emit, skeleton, "skeleton");

  emitPhase(emit, "section-writer", "start");
  const sectionNodes = await mapWithConcurrency(
    coverageMap.sections,
    WRITER_CONCURRENCY,
    async (section: CoverageSection, index: number) => {
      const threeLayer = hasThreeLayerSection(section);
      const writerPrompt = `${playbooks.writer}

---

Topic: ${coverageMap.topic}
Sheet title: ${coverageMap.title}

${framingBlock}

Write one RenderNode subtree for the section below. Return only that subtree JSON (no markdown fences, not an array).
${threeLayer ? "Use the three-layer anatomy: text (goal) + module nodes (each with 1–2 nested anchor children teaching mustCover). Module hints are visible titles (not questions). Vary presentation: list, diagram (mermaid), or table — do not use a table for every anchor. Only modules are drillable." : "Legacy section: use text + list/table from mustInclude."}
Keep the subtree compact (max 6 children) so the JSON is complete in one response.

Section:
${JSON.stringify(sectionPayloadForWriter(section), null, 2)}`;

      const label = `section-writer:${section.id || index}`;
      return runSectionWriter(label, writerPrompt, section, meta, options.signal);
    },
    options.signal,
  );
  throwIfAborted(options.signal);
  emitPhase(emit, "section-writer", "ok");

  if (sectionNodes.length !== coverageMap.sections.length) {
    throw new Error(
      `Section writers produced ${sectionNodes.length} subtrees, expected ${coverageMap.sections.length}`,
    );
  }

  const tree = assembleCheatSheetTree(coverageMap, sectionNodes);
  meta.phases.push({ name: "layout-assembler", status: "ok" });

  const validation = validateRenderTree(tree);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid render tree");
  }

  const response: CheatSheetResponse = { tree, meta };
  emitPartial(emit, response, "final");
  return response;
}

async function generateRoadmapStyle(
  options: GenerateOptions,
  meta: CheatSheetMeta,
  emit?: StreamEmit,
): Promise<CheatSheetResponse> {
  const playbooks = await loadStylePlaybooks("roadmap");
  const framingBlock = buildFramingBlock(options.audience, "roadmap");

  const plannerPrompt = `${playbooks.coverage}

---
Topic: ${options.topic}

${framingBlock}

Return only the concept graph JSON.`;

  emitPhase(emit, "roadmap-planner", "start");
  throwIfAborted(options.signal);
  const graphRaw = await runAgentPromptForJson("roadmap-planner", plannerPrompt, meta, {
    retrySuffix: ROADMAP_JSON_RETRY_SUFFIX,
    signal: options.signal,
  });

  const parsed = parseConceptGraphMap(graphRaw);
  if (!parsed) {
    throw new Error("Roadmap planner returned invalid concept graph JSON");
  }

  const graphMap = parsed.map;
  meta.conceptGraph = graphMap;
  emitPhase(emit, "roadmap-planner", "ok");

  throwIfAborted(options.signal);
  const skeleton = buildRoadmapSkeletonResponse(graphMap, meta);
  emitPartial(emit, skeleton, "skeleton");

  emitPhase(emit, "graph-writer", "start");
  const writerPrompt = `${playbooks.writer}

---

Topic: ${graphMap.topic}
Graph title: ${graphMap.title}

${framingBlock}

Write one conceptGraph RenderNode for the graph below. Return only that JSON (no markdown fences).

Graph:
${JSON.stringify(graphMap, null, 2)}`;

  const tree = await runGraphWriter(
    "graph-writer",
    writerPrompt,
    graphMap,
    meta,
    options.signal,
  );
  meta.phases.push({ name: "graph-assembler", status: "ok" });
  emitPhase(emit, "graph-writer", "ok");

  const countValidation = validateRenderTree(tree);
  if (!countValidation.ok) {
    throw new Error(countValidation.error ?? "Invalid render tree");
  }

  const graphValidation = validateConceptGraphTree(tree);
  if (!graphValidation.ok) {
    throw new Error(graphValidation.error ?? "Invalid concept graph");
  }

  const response: CheatSheetResponse = { tree, meta };
  emitPartial(emit, response, "final");
  return response;
}

export async function generateCheatSheetStream(
  options: GenerateOptions,
  emit: StreamEmit,
): Promise<CheatSheetResponse> {
  const style = normalizeStyle(options.style ?? options.depth);
  const meta: CheatSheetMeta = {
    source: "agent",
    style,
    phases: [],
    retrialCount: 0,
  };

  let response: CheatSheetResponse;

  try {
    if (style === "roadmap") {
      if (options.parentContext?.trim()) {
        throw new Error("Roadmap style does not support drill-down; generate at root level only.");
      }
      response = await generateRoadmapStyle(options, meta, emit);
    } else {
      response = await generateCheatsheetStyle(options, style, meta, emit);
    }
  } catch (err) {
    if (
      options.signal?.aborted ||
      err instanceof GenerationAbortedError ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new GenerationAbortedError();
    }
    throw err;
  }

  throwIfAborted(options.signal);

  const final = responseWithoutStage(response);
  safeEmit(emit, {
    type: "done",
    tree: final.tree,
    meta: final.meta,
  });
  return final;
}

export async function generateCheatSheet(
  options: GenerateOptions,
): Promise<CheatSheetResponse> {
  let result: CheatSheetResponse | null = null;
  let streamError: string | null = null;

  await generateCheatSheetStream(options, (event) => {
    if (event.type === "done") {
      result = { tree: event.tree, meta: event.meta };
    }
    if (event.type === "error") {
      streamError = event.message;
    }
  });

  if (streamError) {
    throw new Error(streamError);
  }
  if (!result) {
    throw new Error("Generation completed without result");
  }
  return result;
}

export function getRepoRoot(): string {
  return path.resolve(process.cwd());
}
