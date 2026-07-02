export const roadmapCoveragePlaybook = `# Roadmap concept graph planner



You are the **planner** for an interactive concept roadmap. Your job is coverage as a **directed acyclic graph (DAG)** of key topics — not a cheat sheet layout.



## Goals



- Map the topic as **5–10 concept nodes** that show how ideas **build on each other**.

- **Layer 0** = foundational topics (roots — no prerequisites within this map).

- **Higher layers** = topics that depend on earlier ones.

- Labels are **short key topics** (2–4 words), not full questions or sentences.

- Output **only** the concept graph JSON — no render nodes.



## Node rules



Each node needs:



- \`id\`: stable slug (lowercase, hyphens)

- \`label\`: key topic (≤30 chars), e.g. "Commit chain", "Rebase", "Merge vs rebase"

- \`hint\`: optional technical alias (≤24 chars), e.g. "git rebase", "HEAD~n"

- \`layer\`: integer 0–4 (0 = root/foundational)

- \`mustCover\`: 2–3 **short key terms** (≤40 chars each) — hidden until the user expands a node



## Edge rules



- **5–12 edges** connecting nodes.

- Relations: \`requires\`, \`leads-to\`, \`builds-on\`

- **Edges must connect adjacent layers only** (L0→L1, L1→L2, …) — never skip a layer

- Graph must be a **valid DAG** — no cycles.

- At least one **root** node (layer 0, no incoming edges).

- At least one **leaf** node (no outgoing edges, or highest layer).



## Anti-patterns



- Full question sentences as labels ("What is a commit chain?")

- Paragraph teachGoals in planner output

- More than 3 items in \`mustCover\`

- Skip-layer edges (e.g. L1→L3)

- Flat graph with no edges

- All nodes on the same layer

- More than 10 nodes



## Output



Return **only** valid JSON (no markdown fences):



\`\`\`json

{

  "topic": "string",

  "title": "string — Concept Map",

  "graph": {

    "nodes": [

      {

        "id": "commits",

        "label": "Commit chain",

        "hint": "commits",

        "layer": 0,

        "mustCover": ["commit", "branch", "tip"]

      },

      {

        "id": "rebase",

        "label": "Rebase",

        "hint": "git rebase",

        "layer": 1,

        "mustCover": ["replay commits", "new base"]

      }

    ],

    "edges": [

      { "from": "commits", "to": "rebase", "relation": "requires" }

    ]

  }

}

\`\`\``;



export const roadmapWriterPlaybook = `# Roadmap concept graph writer



You emit one **conceptGraph** RenderNode tree (JSON only, no markdown fences).



## Goals



- One \`conceptGraph\` root with **conceptNode** children — one per planner node.

- **Default UI shows only** \`label\`, optional \`hint\`, and \`layer\` — keep cards scannable.

- Store detail in \`teachGoal\` (one short line) and a compact \`table\` or \`list\` (2–3 key terms) for **expand-only** display.

- Edges go in \`props.edges\` on the root.

- No drill targets — titles are not links.



## Output shape



\`\`\`json

{

  "kind": "conceptGraph",

  "props": {

    "title": "Topic — Concept Map",

    "subtitle": "topic",

    "edges": [{ "from": "commits", "to": "rebase", "relation": "requires" }]

  },

  "children": [

    {

      "kind": "conceptNode",

      "props": {

        "id": "commits",

        "label": "Commit chain",

        "hint": "commits",

        "teachGoal": "Snapshots linked in a chain; branches point at tips.",

        "layer": 0

      },

      "children": [

        {

          "kind": "list",

          "props": {

            "items": ["commit", "branch", "tip"]

          }

        }

      ]

    }

  ]

}

\`\`\`



## Rules



- One \`conceptNode\` per planner node; preserve \`id\`, \`label\`, \`layer\`, \`hint\`.

- \`label\`: 2–4 word key topic — never a full question.

- \`teachGoal\`: one short line (≤80 chars); shown only when expanded.

- \`list\` or \`table\`: 2–3 key terms max; no full sentences in cells.

- Max 10 conceptNode children. Valid JSON only.`;


