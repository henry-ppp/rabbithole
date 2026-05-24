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
          anchors: [
            {
              id: "what-rebase",
              label: "What rebase does",
              teachGoal: "Rebase rewrites commit history by replaying your branch onto another base.",
              mustCover: [
                "git rebase main — replay onto main",
                "git fetch origin && git rebase origin/main",
              ],
              linkedModules: ["everyday"],
            },
            {
              id: "vs-merge",
              label: "Rebase vs merge",
              teachGoal: "Rebase linearizes history; merge preserves branch topology with a merge commit.",
              mustCover: [
                "Rebase: replay commits, new SHAs",
                "Merge: join tips, keeps parallel history",
              ],
            },
          ],
          modules: [
            { id: "everyday", label: "Everyday workflow", group: "Core" },
            { id: "interactive", label: "Interactive rebase", group: "Core" },
            { id: "recovery", label: "Recovery & conflicts", hint: "When things break", group: "Recovery" },
            { id: "advanced", label: "Rebase --onto", hint: "Transplant", group: "Advanced" },
          ],
          edges: [
            { from: "recovery", to: "advanced", relation: "leads-to" },
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
        props: { columns: 1 },
        children: [
          {
            kind: "section",
            props: { title: "Git rebase", hideTitle: true },
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
              {
                kind: "moduleMap",
                props: {
                  layout: "cluster-flow",
                  nodes: [
                    {
                      id: "everyday",
                      label: "Everyday workflow",
                      group: "Core",
                      highlighted: true,
                    },
                    {
                      id: "interactive",
                      label: "Interactive rebase",
                      group: "Core",
                    },
                    {
                      id: "recovery",
                      label: "Recovery & conflicts",
                      hint: "When things break",
                      group: "Recovery",
                    },
                    {
                      id: "advanced",
                      label: "Rebase --onto",
                      hint: "Transplant",
                      group: "Advanced",
                    },
                  ],
                  edges: [
                    { from: "recovery", to: "advanced", relation: "leads-to" },
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
