"use client";

import { StylePicker } from "@/components/cheat-sheet/StylePicker";
import type { KnowledgeStyle } from "@/lib/cheat-sheet/styles";

type TopicComposerProps = {
  topic: string;
  onTopicChange: (topic: string) => void;
  style: KnowledgeStyle;
  onStyleChange: (style: KnowledgeStyle) => void;
  onSubmit: () => void;
  placeholder: string;
  submitLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function TopicComposer({
  topic,
  onTopicChange,
  style,
  onStyleChange,
  onSubmit,
  placeholder,
  submitLabel = "Generate",
  disabled = false,
  autoFocus = false,
}: TopicComposerProps) {
  return (
    <div className="w-full rounded-[1.75rem] border border-zinc-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-shadow focus-within:border-zinc-300 focus-within:shadow-[0_12px_40px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-700">
      <label className="block">
        <span className="sr-only">Topic or keyword</span>
        <input
          type="text"
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && topic.trim() && !disabled) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="w-full border-0 bg-transparent px-5 pb-2 pt-5 text-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50"
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-1">
        <StylePicker value={style} onChange={onStyleChange} size="sm" />
        <button
          type="button"
          disabled={disabled || !topic.trim()}
          onClick={onSubmit}
          className="inline-flex h-10 min-w-[6.5rem] items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-sm transition-opacity hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
