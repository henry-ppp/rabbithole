"use client";

import {
  KNOWLEDGE_STYLES,
  styleLabel,
  type KnowledgeStyle,
} from "@/lib/cheat-sheet/styles";

type StylePickerProps = {
  value: KnowledgeStyle;
  onChange: (style: KnowledgeStyle) => void;
  size?: "sm" | "md";
  className?: string;
};

export function StylePicker({
  value,
  onChange,
  size = "md",
  className = "",
}: StylePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Format"
      className={`inline-flex rounded-full border border-zinc-200/90 bg-zinc-200/60 p-1 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      {KNOWLEDGE_STYLES.map((style) => {
        const selected = value === style;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(style)}
            className={`rounded-full transition-all ${
              size === "sm"
                ? "px-3 py-1.5 text-xs"
                : "px-3.5 py-1.5 text-sm"
            } ${
              selected
                ? "bg-white font-semibold text-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-zinc-950/5 dark:bg-zinc-600 dark:text-zinc-50 dark:ring-zinc-500/40 dark:shadow-none"
                : "font-medium text-zinc-600 hover:bg-zinc-300/45 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-200"
            }`}
          >
            {styleLabel(style)}
          </button>
        );
      })}
    </div>
  );
}
