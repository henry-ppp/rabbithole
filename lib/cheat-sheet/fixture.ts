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
