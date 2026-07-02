import { NextResponse } from "next/server";

export const runtime = "nodejs";
import {
  getFixtureForStyle,
  gitRebaseFixture,
} from "@/lib/cheat-sheet/fixture";
import {
  sanitizeRenderNode,
  validateRenderTree,
} from "@/lib/cheat-sheet/render-contract";
import { normalizeStyle } from "@/lib/cheat-sheet/styles";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type PostBody = {
  topic?: string;
  audience?: string;
  style?: string;
  /** @deprecated use style */
  depth?: string;
  parentContext?: string;
  useFixture?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    const style = normalizeStyle(body.style ?? body.depth);

    if (body.useFixture) {
      return NextResponse.json(getFixtureForStyle(style));
    }

    const topic = body.topic?.trim();
    if (!topic || topic.length > 200) {
      return NextResponse.json(
        { error: "topic is required (max 200 characters)" },
        { status: 400 },
      );
    }

    if (style === "roadmap" && body.parentContext?.trim()) {
      return NextResponse.json(
        { error: "Roadmap style does not support drill-down" },
        { status: 400 },
      );
    }

    const { generateCheatSheet } = await import("@/lib/cheat-sheet/orchestrate");
    const result = await generateCheatSheet({
      topic,
      audience: body.audience?.trim(),
      style,
      parentContext: body.parentContext?.trim(),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    const status = message.includes("CURSOR_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  const tree = sanitizeRenderNode(gitRebaseFixture.tree);
  if (!tree) {
    return NextResponse.json({ error: "Invalid fixture" }, { status: 500 });
  }
  const validation = validateRenderTree(tree);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 500 });
  }
  return NextResponse.json(gitRebaseFixture);
}
