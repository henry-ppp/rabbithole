import { layoutPlaybook } from "./playbook-content";
import {
  loadStylePlaybooks,
  type KnowledgeStyle,
} from "./styles";

export async function loadPlaybook(
  name: "coverage" | "writer" | "layout",
  style: KnowledgeStyle = "cheatsheet",
): Promise<string> {
  if (name === "layout") {
    return layoutPlaybook;
  }

  const playbooks = await loadStylePlaybooks(style);
  return name === "coverage" ? playbooks.coverage : playbooks.writer;
}
