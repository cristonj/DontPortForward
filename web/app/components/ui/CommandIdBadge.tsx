"use client";

import { memo } from "react";
import { HashIcon } from "../Icons";

interface CommandIdBadgeProps {
  id: string;
  /** Number of characters to show */
  length?: number;
  className?: string;
}

/**
 * Badge showing a truncated command ID with hash icon
 */
export const CommandIdBadge = memo(function CommandIdBadge({
  id,
  length = 8,
  className = "",
}: CommandIdBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-900/60 border border-gray-800/50 text-xs font-mono ${className}`}
    >
      <HashIcon className="w-3 h-3 text-gray-600" />
      <span className="text-gray-400">{id.substring(0, length)}</span>
    </span>
  );
});
