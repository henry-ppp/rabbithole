import type { CheatSheetResponse } from "./render-contract";

/** Hand-authored flexible tree for renderer/viewport development without API calls. */
export const gitRebaseFixture: CheatSheetResponse = {
  meta: {
    source: "fixture",
    phases: [{ name: "fixture", status: "ok" }],
    coverageMap: {
      topic: "Git rebase",
      title: "Git Rebase — Quick Reference",
      sections: [
        {
          id: "basics",
          title: "Basics",
          goal: "Replay commits onto a new base — everyday workflow and interactive editing.",
          anchors: [
            {
              id: "what-rebase",
              label: "What rebase does",
              teachGoal: "Rebase rewrites commit history by replaying your branch onto another base.",
              mustCover: [
                "git rebase main — replay onto main",
                "git fetch origin && git rebase origin/main",
              ],
              linkedSubtopics: ["onto"],
            },
            {
              id: "interactive",
              label: "Interactive rebase",
              teachGoal: "Edit, reorder, squash, or drop commits in a todo list.",
              mustCover: [
                "git rebase -i HEAD~3",
                "pick / squash / fixup / drop actions",
              ],
            },
          ],
          subtopics: [
            { id: "onto", label: "Rebase --onto", hint: "Transplant", group: "Advanced" },
            { id: "conflicts", label: "Conflict resolution", group: "Recovery" },
            { id: "recovery", label: "Abort & reflog", hint: "Undo", group: "Recovery" },
          ],
          edges: [
            { from: "conflicts", to: "recovery", relation: "leads-to" },
          ],
        },
        {
          id: "duration",
          title: "Duration",
          goal: "Price sensitivity to yield changes — first-order approximation.",
          anchors: [
            {
              id: "mod-duration",
              label: "Modified duration",
              teachGoal: "Percent price change per 1% yield change.",
              mustCover: [
                "D_mod = D / (1+y)",
                "Approximate ΔP/P ≈ -D_mod · Δy",
              ],
            },
          ],
          subtopics: [
            { id: "macaulay", label: "Macaulay duration", group: "Foundation" },
            { id: "convexity", label: "Convexity", hint: "Second order", group: "Risk" },
          ],
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
        props: { columns: 2 },
        children: [
          {
            kind: "section",
            props: { title: "Basics" },
            layout: { column: 0, density: "compact", span: 1 },
            children: [
              {
                kind: "text",
                props: {
                  content:
                    "Replay commits onto a new base — everyday workflow and interactive editing.",
                },
              },
              {
                kind: "anchor",
                props: {
                  id: "what-rebase",
                  label: "What rebase does",
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
                  id: "interactive",
                  label: "Interactive rebase",
                  teachGoal: "Edit, reorder, squash, or drop commits in a todo list.",
                },
                children: [
                  {
                    kind: "table",
                    props: {
                      headers: ["Action", "Effect"],
                      rows: [
                        ["pick", "Keep commit as-is"],
                        ["squash", "Melds into previous"],
                        ["fixup", "Squash, drop message"],
                        ["drop", "Remove commit"],
                      ],
                    },
                  },
                ],
              },
              {
                kind: "topicMap",
                props: {
                  layout: "cluster-flow",
                  nodes: [
                    {
                      id: "onto",
                      label: "Rebase --onto",
                      hint: "Transplant",
                      group: "Advanced",
                    },
                    {
                      id: "conflicts",
                      label: "Conflict resolution",
                      group: "Recovery",
                    },
                    {
                      id: "recovery",
                      label: "Abort & reflog",
                      hint: "Undo",
                      group: "Recovery",
                    },
                  ],
                  edges: [
                    { from: "conflicts", to: "recovery", relation: "leads-to" },
                  ],
                },
              },
            ],
          },
          {
            kind: "section",
            props: { title: "Duration" },
            layout: { column: 1, density: "compact" },
            children: [
              {
                kind: "text",
                props: {
                  content:
                    "Price sensitivity to yield changes — first-order approximation.",
                },
              },
              {
                kind: "anchor",
                props: {
                  id: "mod-duration",
                  label: "Modified duration",
                  teachGoal: "Percent price change per 1% yield change.",
                },
                children: [
                  {
                    kind: "math",
                    props: {
                      latex: "D_{\\mathrm{mod}} = \\frac{D}{1+y}",
                      display: true,
                    },
                  },
                  {
                    kind: "text",
                    props: {
                      content:
                        "Approximate price change: $$\\frac{\\Delta P}{P} \\approx -D_{\\mod} \\cdot \\Delta y$$",
                    },
                  },
                  {
                    kind: "list",
                    props: {
                      items: [
                        "Macaulay $D = \\sum_t t \\cdot \\frac{PV(CF_t)}{P}$",
                        "Higher $D$ → more rate sensitivity",
                      ],
                    },
                  },
                ],
              },
              {
                kind: "topicMap",
                props: {
                  layout: "cluster-flow",
                  nodes: [
                    {
                      id: "macaulay",
                      label: "Macaulay duration",
                      group: "Foundation",
                    },
                    {
                      id: "convexity",
                      label: "Convexity",
                      hint: "Second order",
                      group: "Risk",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
};
