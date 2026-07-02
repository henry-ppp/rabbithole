import type { CheatSheetResponse, RenderNode } from "./render-contract";
import type { KnowledgeStyle } from "./styles";

/** Hand-authored flexible tree for renderer/viewport development without API calls. */
export const gitRebaseFixture: CheatSheetResponse = {
  meta: {
    source: "fixture",
    style: "cheatsheet",
    phases: [{ name: "fixture", status: "ok" }],
    coverageMap: {
      topic: "Git rebase",
      title: "Git Rebase — Quick Reference",
      sections: [
        {
          id: "main",
          title: "Git rebase",
          goal: "Replay commits onto a new base — rewrite history locally while keeping a linear story.",
          modules: [
            {
              id: "what-is",
              label: "What does rebase do?",
              hint: "rebase",
              group: "What",
              anchors: [
                {
                  id: "what-rebase",
                  label: "What happens to my commits?",
                  teachGoal:
                    "Rebase rewrites commit history by replaying your branch onto another base.",
                  mustCover: [
                    "git rebase main — replay onto main",
                    "git fetch origin && git rebase origin/main",
                  ],
                },
                {
                  id: "vs-merge",
                  label: "How is rebase different from merge?",
                  teachGoal:
                    "Rebase linearizes history; merge preserves branch topology with a merge commit.",
                  mustCover: [
                    "Rebase: replay commits, new SHAs",
                    "Merge: join tips, keeps parallel history",
                  ],
                },
              ],
            },
            {
              id: "everyday",
              label: "How do I rebase day to day?",
              hint: "workflow",
              group: "How",
              anchors: [
                {
                  id: "everyday-cmds",
                  label: "Which commands replay my branch?",
                  teachGoal: "Fetch the latest base, then replay your branch on top of it.",
                  mustCover: ["git rebase main", "git fetch && git rebase origin/main"],
                },
              ],
            },
            {
              id: "interactive",
              label: "How do I rewrite commit history?",
              hint: "interactive",
              group: "How",
              anchors: [
                {
                  id: "interactive-basics",
                  label: "How do I squash or reorder commits?",
                  teachGoal: "Interactive rebase lets you edit, squash, or reorder commits.",
                  mustCover: ["git rebase -i HEAD~n", "pick, squash, fixup, drop"],
                },
              ],
            },
            {
              id: "recovery",
              label: "What if rebase goes wrong?",
              hint: "conflicts",
              group: "Watch",
              anchors: [
                {
                  id: "abort-continue",
                  label: "Should I abort or continue?",
                  teachGoal: "Use abort to cancel; continue after resolving conflicts.",
                  mustCover: ["git rebase --abort", "git rebase --continue"],
                },
              ],
            },
            {
              id: "advanced",
              label: "How do I transplant commits?",
              hint: "--onto",
              group: "How",
              anchors: [
                {
                  id: "onto",
                  label: "How do I replay a slice onto a new base?",
                  teachGoal: "Replay a slice of commits onto a new base branch.",
                  mustCover: ["git rebase --onto newbase upstream branch"],
                },
              ],
            },
          ],
          edges: [{ from: "recovery", to: "advanced", relation: "leads-to" }],
        },
      ],
    },
  },
  tree: {
    kind: "sheet",
    props: { title: "Git Rebase — Quick Reference", subtitle: "Git rebase" },
    children: [
      {
        kind: "grid",
        props: { columns: 1 },
        children: [
          {
            kind: "section",
            props: {
              title: "Git rebase",
              hideTitle: true,
              moduleEdges: [
                { from: "recovery", to: "advanced", relation: "leads-to" },
              ],
            },
            layout: { column: 0, density: "compact", span: 1 },
            children: [
              {
                kind: "text",
                props: {
                  content:
                    "Replay commits onto a new base — rewrite history locally while keeping a linear story.",
                },
              },
              {
                kind: "module",
                props: {
                  id: "what-is",
                  label: "What does rebase do?",
                  hint: "rebase",
                  group: "What",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "what-rebase",
                      label: "What happens to my commits?",
                      teachGoal:
                        "Rebase rewrites commit history by replaying your branch onto another base.",
                    },
                    children: [
                      {
                        kind: "table",
                        props: {
                          headers: ["Command", "What it does"],
                          rows: [
                            ["git rebase main", "Replay branch onto main"],
                            ["git fetch && git rebase origin/main", "Update then rebase"],
                          ],
                        },
                      },
                    ],
                  },
                  {
                    kind: "anchor",
                    props: {
                      id: "vs-merge",
                      label: "How is rebase different from merge?",
                      teachGoal:
                        "Rebase linearizes history; merge preserves branch topology with a merge commit.",
                    },
                    children: [
                      {
                        kind: "table",
                        props: {
                          headers: ["Approach", "Plain meaning", "Trade-off"],
                          rows: [
                            ["Rebase", "Replay commits, new SHAs", "Linear history"],
                            ["Merge", "Join tips, keeps parallel history", "Preserves topology"],
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
              {
                kind: "module",
                props: {
                  id: "everyday",
                  label: "How do I rebase day to day?",
                  hint: "workflow",
                  group: "How",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "everyday-cmds",
                      label: "Which commands replay my branch?",
                      teachGoal: "Fetch the latest base, then replay your branch on top of it.",
                    },
                    children: [
                      {
                        kind: "table",
                        props: {
                          headers: ["Command", "What it does"],
                          rows: [
                            ["git rebase main", "Replay branch onto main"],
                            ["git fetch && git rebase origin/main", "Update then rebase"],
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
              {
                kind: "module",
                props: {
                  id: "interactive",
                  label: "How do I rewrite commit history?",
                  hint: "interactive",
                  group: "How",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "interactive-basics",
                      label: "How do I squash or reorder commits?",
                      teachGoal:
                        "Interactive rebase lets you edit, squash, or reorder commits.",
                    },
                    children: [
                      {
                        kind: "table",
                        props: {
                          headers: ["Command", "What it does"],
                          rows: [
                            ["git rebase -i HEAD~n", "Open interactive editor for last n commits"],
                          ],
                        },
                      },
                      {
                        kind: "list",
                        props: {
                          items: ["pick — keep commit", "squash — combine with previous", "fixup — squash without message", "drop — remove commit"],
                        },
                      },
                    ],
                  },
                ],
              },
              {
                kind: "module",
                props: {
                  id: "recovery",
                  label: "What if rebase goes wrong?",
                  hint: "conflicts",
                  group: "Watch",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "abort-continue",
                      label: "Should I abort or continue?",
                      teachGoal:
                        "Use abort to cancel; continue after resolving conflicts.",
                    },
                    children: [
                      {
                        kind: "table",
                        props: {
                          headers: ["Situation", "Do this"],
                          rows: [
                            ["Want to undo the rebase", "git rebase --abort"],
                            ["Conflicts resolved", "git rebase --continue"],
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
              {
                kind: "module",
                props: {
                  id: "advanced",
                  label: "How do I transplant commits?",
                  hint: "--onto",
                  group: "How",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "onto",
                      label: "How do I replay a slice onto a new base?",
                      teachGoal:
                        "Replay a slice of commits onto a new base branch.",
                    },
                    children: [
                      {
                        kind: "table",
                        props: {
                          headers: ["Command", "What it does"],
                          rows: [
                            ["git rebase --onto newbase upstream branch", "Transplant commits onto newbase"],
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const gitRebaseRoadmapFixture: CheatSheetResponse = {
  meta: {
    source: "fixture",
    style: "roadmap",
    phases: [{ name: "fixture", status: "ok" }],
    conceptGraph: {
      topic: "Git rebase",
      title: "Git Rebase — Concept Map",
      nodes: [
        {
          id: "commits",
          label: "Commit chain",
          hint: "commits",
          layer: 0,
          mustCover: ["commit", "branch", "tip"],
          teachGoal: "Snapshots linked in a chain; branches point at tips.",
        },
        {
          id: "merge",
          label: "Merge vs rebase",
          hint: "merge",
          layer: 1,
          mustCover: ["merge", "rebase", "linear history"],
          teachGoal: "Merge joins tips; rebase replays for a linear history.",
        },
        {
          id: "rebase",
          label: "Rebase",
          hint: "git rebase",
          layer: 1,
          mustCover: ["replay commits", "new base"],
          teachGoal: "Replays your commits onto another branch tip.",
        },
        {
          id: "interactive",
          label: "Rewrite commits",
          hint: "rebase -i",
          layer: 2,
          mustCover: ["pick", "squash", "HEAD~n"],
          teachGoal: "Interactive rebase edits the commit list before replay.",
        },
        {
          id: "conflicts",
          label: "Conflicts",
          hint: "--abort",
          layer: 2,
          mustCover: ["--abort", "--continue", "resolve"],
          teachGoal: "Resolve conflicts, then continue; abort to cancel.",
        },
        {
          id: "onto",
          label: "Transplant commits",
          hint: "--onto",
          layer: 3,
          mustCover: ["--onto", "upstream", "new base"],
          teachGoal: "Replay a slice of commits onto a new base branch.",
        },
      ],
      edges: [
        { from: "commits", to: "merge", relation: "requires" },
        { from: "commits", to: "rebase", relation: "requires" },
        { from: "rebase", to: "interactive", relation: "leads-to" },
        { from: "rebase", to: "conflicts", relation: "leads-to" },
        { from: "interactive", to: "onto", relation: "builds-on" },
        { from: "conflicts", to: "onto", relation: "builds-on" },
      ],
    },
  },
  tree: {
    kind: "conceptGraph",
    props: {
      title: "Git Rebase — Concept Map",
      subtitle: "Git rebase",
      edges: [
        { from: "commits", to: "merge", relation: "requires" },
        { from: "commits", to: "rebase", relation: "requires" },
        { from: "rebase", to: "interactive", relation: "leads-to" },
        { from: "rebase", to: "conflicts", relation: "leads-to" },
        { from: "interactive", to: "onto", relation: "builds-on" },
        { from: "conflicts", to: "onto", relation: "builds-on" },
      ],
    },
    children: [
      {
        kind: "conceptNode",
        props: {
          id: "commits",
          label: "Commit chain",
          hint: "commits",
          layer: 0,
          teachGoal: "Snapshots linked in a chain; branches point at tips.",
        },
        children: [
          {
            kind: "list",
            props: { items: ["commit", "branch", "tip"] },
          },
        ],
      },
      {
        kind: "conceptNode",
        props: {
          id: "merge",
          label: "Merge vs rebase",
          hint: "merge",
          layer: 1,
          teachGoal: "Merge joins tips; rebase replays for a linear history.",
        },
        children: [
          {
            kind: "list",
            props: { items: ["merge", "rebase", "linear history"] },
          },
        ],
      },
      {
        kind: "conceptNode",
        props: {
          id: "rebase",
          label: "Rebase",
          hint: "git rebase",
          layer: 1,
          teachGoal: "Replays your commits onto another branch tip.",
        },
        children: [
          {
            kind: "list",
            props: { items: ["replay commits", "new base", "git rebase main"] },
          },
        ],
      },
      {
        kind: "conceptNode",
        props: {
          id: "interactive",
          label: "Rewrite commits",
          hint: "rebase -i",
          layer: 2,
          teachGoal: "Interactive rebase edits the commit list before replay.",
        },
        children: [
          {
            kind: "list",
            props: { items: ["pick", "squash", "HEAD~n"] },
          },
        ],
      },
      {
        kind: "conceptNode",
        props: {
          id: "conflicts",
          label: "Conflicts",
          hint: "--abort",
          layer: 2,
          teachGoal: "Resolve conflicts, then continue; abort to cancel.",
        },
        children: [
          {
            kind: "list",
            props: { items: ["--abort", "--continue", "resolve"] },
          },
        ],
      },
      {
        kind: "conceptNode",
        props: {
          id: "onto",
          label: "Transplant commits",
          hint: "--onto",
          layer: 3,
          teachGoal: "Replay a slice of commits onto a new base branch.",
        },
        children: [
          {
            kind: "list",
            props: { items: ["--onto", "upstream", "new base"] },
          },
        ],
      },
    ],
  },
};

function cfaConceptNode(
  id: string,
  label: string,
  hint: string,
  layer: number,
  teachGoal: string,
  keyTerms: string[],
): RenderNode {
  return {
    kind: "conceptNode",
    props: { id, label, hint, layer, teachGoal },
    children: [{ kind: "list", props: { items: keyTerms } }],
  };
}

/** Eight-node CFA-style graph for layout/edge clarity tests. */
export const cfaLevel3RoadmapFixture: CheatSheetResponse = {
  meta: {
    source: "fixture",
    style: "roadmap",
    phases: [{ name: "fixture", status: "ok" }],
  },
  tree: {
    kind: "conceptGraph",
    props: {
      title: "CFA Level 3 — Concept Map",
      subtitle: "CFA Level 3",
      edges: [
        { from: "return-expectations", to: "asset-allocation", relation: "requires" },
        { from: "behavioral-finance", to: "asset-allocation", relation: "requires" },
        { from: "investment-policy", to: "risk-management", relation: "requires" },
        { from: "asset-allocation", to: "portfolio-construction", relation: "leads-to" },
        { from: "risk-management", to: "portfolio-construction", relation: "leads-to" },
        { from: "portfolio-construction", to: "performance-review", relation: "leads-to" },
        { from: "portfolio-construction", to: "client-portfolios", relation: "leads-to" },
      ],
    },
    children: [
      cfaConceptNode(
        "return-expectations",
        "Return expectations",
        "forecasts",
        0,
        "Capital market assumptions drive return forecasts.",
        ["forecasts", "CMA", "expected return"],
      ),
      cfaConceptNode(
        "behavioral-finance",
        "Behavioral finance",
        "investor bias",
        0,
        "Biases explain gaps between models and decisions.",
        ["biases", "prospect theory", "overconfidence"],
      ),
      cfaConceptNode(
        "investment-policy",
        "Investment policy",
        "IPS",
        0,
        "The IPS defines objectives and constraints.",
        ["IPS", "objectives", "constraints"],
      ),
      cfaConceptNode(
        "asset-allocation",
        "Asset allocation",
        "policy mix",
        1,
        "Strategic mix implements policy across asset classes.",
        ["SAA", "TAA", "policy mix"],
      ),
      cfaConceptNode(
        "risk-management",
        "Risk management",
        "risk budget",
        1,
        "Risk budgets align exposures with policy limits.",
        ["VaR", "risk budget", "drawdown"],
      ),
      cfaConceptNode(
        "portfolio-construction",
        "Portfolio construction",
        "holdings mix",
        2,
        "Holdings implement allocation with constraints.",
        ["holdings", "constraints", "taxes"],
      ),
      cfaConceptNode(
        "performance-review",
        "Performance review",
        "attribution",
        3,
        "Attribution explains return versus policy.",
        ["attribution", "benchmark", "review"],
      ),
      cfaConceptNode(
        "client-portfolios",
        "Client portfolios",
        "wealth plans",
        3,
        "Individual plans apply the framework to clients.",
        ["IPS", "goals", "rebalance"],
      ),
    ],
  },
};

export function getFixtureForStyle(style: KnowledgeStyle): CheatSheetResponse {
  switch (style) {
    case "roadmap":
      return gitRebaseRoadmapFixture;
    case "cheatsheet":
    default:
      return gitRebaseFixture;
  }
}
