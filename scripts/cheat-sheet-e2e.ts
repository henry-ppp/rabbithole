/**
 * End-to-end cheat sheet generation test (calls Cursor agents).
 *
 * Usage:
 *   pnpm test:cheat-sheet:e2e
 *   pnpm test:cheat-sheet:e2e -- --topic "cfa level 2" --style cheatsheet
 *   pnpm test:cheat-sheet:e2e -- --topic "git rebase" --style roadmap
 *
 * Requires CURSOR_API_KEY in .env or .env.local
 */
import { validateConceptGraphTree } from "../lib/cheat-sheet/concept-graph";
import { generateCheatSheet } from "../lib/cheat-sheet/orchestrate";
import { countNodes, validateRenderTree } from "../lib/cheat-sheet/render-contract";
import { normalizeStyle } from "../lib/cheat-sheet/styles";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const topic =
    readArg("--topic") ?? process.env.CHEAT_SHEET_E2E_TOPIC ?? "cfa level 2";
  const style = normalizeStyle(
    readArg("--style") ??
      readArg("--depth") ??
      process.env.CHEAT_SHEET_E2E_STYLE ??
      "cheatsheet",
  );

  if (!process.env.CURSOR_API_KEY?.trim()) {
    console.error("CURSOR_API_KEY is not set (.env or .env.local)");
    process.exit(1);
  }

  console.log(`E2E generation: topic="${topic}" style="${style}"`);
  const started = Date.now();

  const { tree, meta } = await generateCheatSheet({ topic, style });

  const countValidation = validateRenderTree(tree);
  if (!countValidation.ok) {
    throw new Error(countValidation.error ?? "Invalid render tree");
  }

  if (style === "roadmap") {
    const graphValidation = validateConceptGraphTree(tree);
    if (!graphValidation.ok) {
      throw new Error(graphValidation.error ?? "Invalid concept graph");
    }
  }

  const nodeCount = countNodes(tree);

  console.log(`OK in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (style === "roadmap") {
    console.log(`  Concept nodes: ${meta.conceptGraph?.nodes.length ?? "?"}`);
  } else {
    console.log(
      `  Modules planned: ${meta.coverageMap?.sections[0]?.modules?.length ?? "?"}`,
    );
  }
  console.log(`  Render tree nodes: ${nodeCount}`);
  if (meta.sectionsTruncated) {
    console.warn("  Warning: coverage sections were truncated at safety ceiling");
  }

  const failed = meta.phases.filter((p) => p.status === "error");
  if (failed.length > 0) {
    console.error("Failed phases:", failed);
    process.exit(1);
  }

  if (meta.warnings?.length) {
    console.warn(`Warnings (${meta.warnings.length}):`);
    for (const w of meta.warnings) {
      console.warn(`  - ${w}`);
    }
  }

  const fallbacks = meta.phases.filter((p) => p.name.includes("(fallback)"));
  if (fallbacks.length > 0) {
    console.warn(
      `Note: ${fallbacks.length} sheet(s) used programmatic fallback (still valid).`,
    );
  }

  console.log("Phases:", meta.phases.map((p) => p.name).join(", "));
}

main().catch((err) => {
  console.error("E2E failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
