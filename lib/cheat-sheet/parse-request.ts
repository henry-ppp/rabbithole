import { normalizeStyle, type KnowledgeStyle } from "./styles";

export type CheatSheetRequestBody = {
  topic?: string;
  audience?: string;
  style?: string;
  /** @deprecated use style */
  depth?: string;
  parentContext?: string;
  useFixture?: boolean;
};

export type ParsedCheatSheetRequest =
  | {
      ok: true;
      topic: string;
      audience?: string;
      style: KnowledgeStyle;
      parentContext?: string;
      useFixture: boolean;
    }
  | { ok: false; error: string; status: number };

export function parseCheatSheetRequest(body: CheatSheetRequestBody): ParsedCheatSheetRequest {
  const style = normalizeStyle(body.style ?? body.depth);

  if (body.useFixture) {
    return {
      ok: true,
      topic: body.topic?.trim() || "fixture",
      style,
      useFixture: true,
    };
  }

  const topic = body.topic?.trim();
  if (!topic || topic.length > 200) {
    return {
      ok: false,
      error: "topic is required (max 200 characters)",
      status: 400,
    };
  }

  if (style === "roadmap" && body.parentContext?.trim()) {
    return {
      ok: false,
      error: "Roadmap style does not support drill-down",
      status: 400,
    };
  }

  return {
    ok: true,
    topic,
    audience: body.audience?.trim() || undefined,
    style,
    parentContext: body.parentContext?.trim() || undefined,
    useFixture: false,
  };
}
