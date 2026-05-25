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
          id: "main",
          title: "Git rebase",
          goal: "Replay commits onto a new base — rewrite history locally while keeping a linear story.",
          modules: [
            {
              id: "everyday",
              label: "Everyday workflow",
              group: "Core",
              anchors: [
                {
                  id: "what-rebase",
                  label: "What rebase does",
                  teachGoal:
                    "Rebase rewrites commit history by replaying your branch onto another base.",
                  mustCover: [
                    "git rebase main — replay onto main",
                    "git fetch origin && git rebase origin/main",
                  ],
                },
                {
                  id: "vs-merge",
                  label: "Rebase vs merge",
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
              id: "interactive",
              label: "Interactive rebase",
              group: "Core",
              anchors: [
                {
                  id: "interactive-basics",
                  label: "Rewriting commits",
                  teachGoal: "Interactive rebase lets you edit, squash, or reorder commits.",
                  mustCover: ["git rebase -i HEAD~n", "pick, squash, fixup, drop"],
                },
              ],
            },
            {
              id: "recovery",
              label: "Recovery & conflicts",
              hint: "When things break",
              group: "Recovery",
              anchors: [
                {
                  id: "abort-continue",
                  label: "Abort or continue",
                  teachGoal: "Use abort to cancel; continue after resolving conflicts.",
                  mustCover: ["git rebase --abort", "git rebase --continue"],
                },
              ],
            },
            {
              id: "advanced",
              label: "Rebase --onto",
              hint: "Transplant",
              group: "Advanced",
              anchors: [
                {
                  id: "onto",
                  label: "Transplant commits",
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
                  id: "everyday",
                  label: "Everyday workflow",
                  group: "Core",
                },
                children: [
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
                      id: "vs-merge",
                      label: "Rebase vs merge",
                      teachGoal:
                        "Rebase linearizes history; merge preserves branch topology with a merge commit.",
                    },
                    children: [
                      {
                        kind: "list",
                        props: {
                          items: [
                            "Rebase: replay commits, new SHAs",
                            "Merge: join tips, keeps parallel history",
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
                  label: "Interactive rebase",
                  group: "Core",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "interactive-basics",
                      label: "Rewriting commits",
                      teachGoal:
                        "Interactive rebase lets you edit, squash, or reorder commits.",
                    },
                    children: [
                      {
                        kind: "list",
                        props: {
                          items: ["git rebase -i HEAD~n", "pick, squash, fixup, drop"],
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
                  label: "Recovery & conflicts",
                  hint: "When things break",
                  group: "Recovery",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "abort-continue",
                      label: "Abort or continue",
                      teachGoal:
                        "Use abort to cancel; continue after resolving conflicts.",
                    },
                    children: [
                      {
                        kind: "list",
                        props: {
                          items: ["git rebase --abort", "git rebase --continue"],
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
                  label: "Rebase --onto",
                  hint: "Transplant",
                  group: "Advanced",
                },
                children: [
                  {
                    kind: "anchor",
                    props: {
                      id: "onto",
                      label: "Transplant commits",
                      teachGoal:
                        "Replay a slice of commits onto a new base branch.",
                    },
                    children: [
                      {
                        kind: "list",
                        props: {
                          items: ["git rebase --onto newbase upstream branch"],
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
