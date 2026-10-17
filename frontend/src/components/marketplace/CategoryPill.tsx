"use client";

import React from "react";

interface CategoryPillProps {
  id?: string;
  name: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

export function CategoryPill({
  name,
  isActive,
  onClick,
  count,
}: CategoryPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-left transition-all shrink-0 border select-none ${
        isActive
          ? "bg-jade-700 text-white border-jade-800 shadow-xs ring-1 ring-jade-600"
          : "bg-white text-ink-700 border-ivory-300 hover:border-jade-300 hover:bg-ivory-200/60"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold tracking-tight">{name}</span>
        {count !== undefined && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              isActive
                ? "bg-jade-800 text-jade-100"
                : "bg-ivory-200 text-ink-500"
            }`}
          >
            {count}
          </span>
        )}
      </div>
    </button>
  );
}
