import type { KnowledgeStyle } from "./styles";

export type LandingCopy = {
  headline: string;
  instruction: string;
  placeholder: string;
  hint: string;
};

export function landingCopy(style: KnowledgeStyle): LandingCopy {
  if (style === "roadmap") {
    return {
      headline: "What should we map out?",
      instruction:
        "Enter a subject and we'll build a concept graph of key topics, prerequisites, and how they connect.",
      placeholder:
        'Try "Evolutionary biology", "Macroeconomics", or "Political theory"…',
      hint: "Press Enter or click Generate. Click nodes to expand key terms and see prerequisites.",
    };
  }

  return {
    headline: "What do you want to learn?",
    instruction:
      "Enter a topic or keyword. We'll turn it into a visual cheat sheet you can explore and drill into.",
    placeholder: 'Try "Organic chemistry", "Constitutional law", or "Linear algebra"…',
    hint: "Press Enter or click Generate. Click module titles on the canvas to go deeper.",
  };
}
