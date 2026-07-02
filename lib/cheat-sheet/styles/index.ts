import { coveragePlaybook, writerPlaybook } from "../playbook-content";
import { roadmapCoveragePlaybook, roadmapWriterPlaybook } from "./roadmap-playbooks";

export type KnowledgeStyle = "cheatsheet" | "roadmap";

export const KNOWLEDGE_STYLES: KnowledgeStyle[] = ["cheatsheet", "roadmap"];

const LEGACY_DEPTH_TO_STYLE: Record<string, KnowledgeStyle> = {
  reference: "cheatsheet",
  exam: "cheatsheet",
  "on-call": "cheatsheet",
};

export function normalizeStyle(raw?: string): KnowledgeStyle {
  const value = raw?.trim().toLowerCase();
  if (!value) return "cheatsheet";
  if (value === "cheatsheet" || value === "roadmap") {
    return value;
  }
  return LEGACY_DEPTH_TO_STYLE[value] ?? "cheatsheet";
}

export function styleSupportsDrill(style: KnowledgeStyle): boolean {
  return style === "cheatsheet";
}

export function styleLabel(style: KnowledgeStyle): string {
  switch (style) {
    case "roadmap":
      return "Roadmap";
    case "cheatsheet":
    default:
      return "Cheat sheet";
  }
}

export async function loadStylePlaybooks(
  style: KnowledgeStyle,
): Promise<{ coverage: string; writer: string }> {
  switch (style) {
    case "roadmap":
      return {
        coverage: roadmapCoveragePlaybook,
        writer: roadmapWriterPlaybook,
      };
    case "cheatsheet":
    default:
      return {
        coverage: coveragePlaybook,
        writer: writerPlaybook,
      };
  }
}
