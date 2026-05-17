import {
  coveragePlaybook,
  layoutPlaybook,
  writerPlaybook,
} from "./playbook-content";

export async function loadPlaybook(
  name: "coverage" | "writer" | "layout",
): Promise<string> {
  switch (name) {
    case "coverage":
      return coveragePlaybook;
    case "writer":
      return writerPlaybook;
    case "layout":
      return layoutPlaybook;
    default:
      throw new Error(`Unknown playbook: ${name}`);
  }
}
