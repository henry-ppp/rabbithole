import { getFixtureForStyle } from "@/lib/cheat-sheet/fixture";
import {
  buildCheatsheetSkeletonResponse,
  buildRoadmapSkeletonResponse,
  generateCheatSheetStream,
} from "@/lib/cheat-sheet/orchestrate";
import { parseCheatSheetRequest, type ParsedCheatSheetRequest } from "@/lib/cheat-sheet/parse-request";
import type { CheatSheetMeta } from "@/lib/cheat-sheet/render-contract";
import {
  responseWithoutStage,
  responseWithStage,
  safeEmit,
  type StreamEmit,
} from "@/lib/cheat-sheet/stream-events";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function streamFixture(
  parsed: Extract<ParsedCheatSheetRequest, { ok: true }>,
  emit: StreamEmit,
): void {
  const fixture = getFixtureForStyle(parsed.style);
  const meta: CheatSheetMeta = {
    ...fixture.meta,
    source: "fixture",
    phases: [{ name: "fixture", status: "ok" }],
  };

  safeEmit(emit, { type: "phase", name: "planner", status: "start" });
  safeEmit(emit, { type: "phase", name: "planner", status: "ok" });

  let skeleton;
  if (parsed.style === "roadmap" && meta.conceptGraph) {
    skeleton = buildRoadmapSkeletonResponse(meta.conceptGraph, meta);
  } else if (meta.coverageMap) {
    skeleton = buildCheatsheetSkeletonResponse(meta.coverageMap, meta);
  } else {
    skeleton = responseWithStage(fixture, "skeleton");
  }

  safeEmit(emit, {
    type: "partial",
    stage: "skeleton",
    tree: skeleton.tree,
    meta: skeleton.meta,
  });

  safeEmit(emit, { type: "phase", name: "writer", status: "start" });
  safeEmit(emit, { type: "phase", name: "writer", status: "ok" });

  const finalStaged = responseWithStage(fixture, "final");
  safeEmit(emit, {
    type: "partial",
    stage: "final",
    tree: finalStaged.tree,
    meta: finalStaged.meta,
  });

  const final = responseWithoutStage(fixture);
  safeEmit(emit, {
    type: "done",
    tree: final.tree,
    meta: final.meta,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Parameters<typeof parseCheatSheetRequest>[0];
    const parsed = parseCheatSheetRequest(body);

    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: parsed.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit: StreamEmit = (event) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          if (parsed.useFixture) {
            streamFixture(parsed, emit);
          } else {
            await generateCheatSheetStream(
              {
                topic: parsed.topic,
                audience: parsed.audience,
                style: parsed.style,
                parentContext: parsed.parentContext,
              },
              emit,
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Generation failed";
          safeEmit(emit, { type: "error", message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    const status = message.includes("CURSOR_API_KEY") ? 503 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
