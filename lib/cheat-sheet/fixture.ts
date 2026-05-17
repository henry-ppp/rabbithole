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
          goal: "Core rebase commands",
          mustInclude: ["interactive rebase", "onto"],
        },
        {
          id: "recovery",
          title: "Recovery",
          goal: "Undo and conflict handling",
          mustInclude: ["reflog", "abort"],
        },
      ],
    },
  },
  tree: {
    kind: "sheet",
    props: { title: "Git Rebase — Quick Reference", subtitle: "Quick reference" },
    children: [
      {
        kind: "grid",
        props: { columns: 3 },
        children: [
          {
            kind: "section",
            props: { title: "Everyday commands" },
            layout: { column: 0, density: "compact" },
            children: [
              {
                kind: "table",
                props: {
                  headers: ["Command", "What it does"],
                  rows: [
                    ["git rebase main", "Replay branch onto main"],
                    ["git rebase -i HEAD~3", "Interactive last 3 commits"],
                    ["git rebase --onto new base old", "Transplant range"],
                  ],
                },
              },
              {
                kind: "code",
                props: {
                  language: "bash",
                  content: "git fetch origin\ngit rebase origin/main",
                },
              },
            ],
          },
          {
            kind: "section",
            props: { title: "Interactive actions" },
            layout: { column: 1, density: "compact" },
            children: [
              {
                kind: "table",
                props: {
                  headers: ["Action", "Effect"],
                  rows: [
                    ["pick", "Keep commit as-is"],
                    ["reword", "Change message"],
                    ["squash", "Melds into previous"],
                    ["fixup", "Squash, drop message"],
                    ["drop", "Remove commit"],
                  ],
                },
              },
            ],
          },
          {
            kind: "section",
            props: { title: "Recovery & conflicts" },
            layout: { column: 2, density: "compact" },
            children: [
              {
                kind: "callout",
                props: { tone: "warning", title: "Never rebase public history" },
                children: [
                  {
                    kind: "text",
                    props: {
                      content:
                        "Rebasing rewrites SHAs. Only rebase local or feature branches.",
                    },
                  },
                ],
              },
              {
                kind: "list",
                props: {
                  items: [
                    "git rebase --abort — stop and restore pre-rebase",
                    "git rebase --continue — after resolving conflicts",
                    "git reflog — find lost HEAD positions",
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
