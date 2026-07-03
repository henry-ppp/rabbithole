"use client";

import { TopicComposer } from "@/components/cheat-sheet/TopicComposer";
import { landingCopy } from "@/lib/cheat-sheet/landing-copy";
import {
  type KnowledgeStyle,
} from "@/lib/cheat-sheet/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const FEATURES = [
  {
    title: "Topic in, layout out",
    description:
      "Describe what you want to learn. Agents plan coverage and arrange it on a pan/zoom canvas.",
  },
  {
    title: "Two formats",
    description:
      "Cheat sheets for scannable reference with drill down. Concept graphs for how ideas connect and build on each other.",
  },
  {
    title: "Explore deeper",
    description:
      "Click module titles to branch into focused sub-sheets, or expand concept nodes to reveal key terms.",
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<KnowledgeStyle>("cheatsheet");

  const copy = landingCopy(style);

  const handleSubmit = () => {
    const trimmed = topic.trim();
    if (!trimmed) return;

    const params = new URLSearchParams({ topic: trimmed, style });
    router.push(`/cheat-sheet?${params.toString()}`);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Rabbithole
        </Link>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-6 sm:px-6">
          <div className="flex w-full max-w-2xl flex-col items-center gap-8">
            <div className="space-y-4 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
                Agent orchestrated learning maps
              </p>
              <h1 className="text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
                {copy.headline}
              </h1>
              <p className="mx-auto max-w-lg text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
                {copy.instruction}
              </p>
            </div>

            <TopicComposer
              topic={topic}
              onTopicChange={setTopic}
              style={style}
              onStyleChange={setStyle}
              onSubmit={handleSubmit}
              placeholder={copy.placeholder}
              autoFocus
            />

            <p className="max-w-md text-center text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
              {copy.hint}
            </p>
          </div>
        </section>

        <section className="border-t border-zinc-200/70 bg-white/50 px-6 py-14 dark:border-zinc-800/70 dark:bg-zinc-900/30 sm:px-8">
          <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="space-y-2">
                <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {feature.title}
                </h2>
                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
