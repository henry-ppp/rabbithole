import type { CheatSheetMeta, CheatSheetResponse, RenderNode } from "./render-contract";

export type StreamingStage = "skeleton" | "final";

export type CheatSheetPhaseEvent = {
  type: "phase";
  name: string;
  status: "start" | "ok";
};

export type CheatSheetPartialEvent = {
  type: "partial";
  stage: StreamingStage;
  tree: RenderNode;
  meta: CheatSheetMeta;
};

export type CheatSheetDoneEvent = {
  type: "done";
  tree: RenderNode;
  meta: CheatSheetMeta;
};

export type CheatSheetErrorEvent = {
  type: "error";
  message: string;
};

export type CheatSheetStreamEvent =
  | CheatSheetPhaseEvent
  | CheatSheetPartialEvent
  | CheatSheetDoneEvent
  | CheatSheetErrorEvent;

export type StreamEmit = (event: CheatSheetStreamEvent) => void;

export function safeEmit(emit: StreamEmit, event: CheatSheetStreamEvent): void {
  try {
    emit(event);
  } catch {
    /* client disconnected — keep generating server-side */
  }
}

export function responseWithStage(
  response: CheatSheetResponse,
  stage: StreamingStage,
): CheatSheetResponse {
  return {
    tree: response.tree,
    meta: { ...response.meta, streamingStage: stage },
  };
}

export function responseWithoutStage(response: CheatSheetResponse): CheatSheetResponse {
  const { streamingStage: _removed, ...restMeta } = response.meta;
  return { tree: response.tree, meta: restMeta };
}
