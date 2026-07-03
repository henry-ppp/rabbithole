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
      className={`inline-flex rounded-full bg-zinc-100/90 p-0.5 dark:bg-zinc-900/80 ${className}`}
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
            className={`rounded-full font-medium transition-colors ${
              size === "sm"
                ? "px-3 py-1.5 text-xs"
                : "px-3.5 py-1.5 text-sm"
            } ${
              selected
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {styleLabel(style)}
          </button>
        );
      })}
    </div>
  );
}
