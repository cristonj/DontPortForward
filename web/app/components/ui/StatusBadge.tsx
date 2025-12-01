"use client";

import { memo } from "react";
import { PulsingDot } from "./PulsingDot";
import type { CommandStatus } from "../../constants/commands";

interface StatusBadgeProps {
  status: CommandStatus | string;
  showDot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const statusStyles: Record<string, { bg: string; text: string; dotColor: "accent" | "success" | "error" | "warning" }> = {
  pending: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dotColor: "warning",
  },
  processing: {
    bg: "bg-terminal-accent/10",
    text: "text-terminal-accent",
    dotColor: "accent",
  },
  completed: {
    bg: "bg-terminal-success/10",
    text: "text-terminal-success",
    dotColor: "success",
  },
  cancelled: {
    bg: "bg-terminal-error/10",
    text: "text-terminal-error",
    dotColor: "error",
  },
};

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
};

/**
 * Status badge for showing command status
 */
export const StatusBadge = memo(function StatusBadge({
  status,
  showDot = false,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.pending;
  const isActive = status === "pending" || status === "processing";

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase tracking-wider font-semibold rounded ${style.bg} ${style.text} ${sizeClasses[size]} ${className}`}
    >
      {showDot && <PulsingDot size="sm" color={style.dotColor} pulse={isActive} />}
      {status}
    </span>
  );
});
