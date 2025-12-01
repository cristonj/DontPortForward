"use client";

import { memo } from "react";

interface PulsingDotProps {
  /** Size of the dot: 'sm' (2), 'md' (3), 'lg' (4) */
  size?: "sm" | "md" | "lg";
  /** Color variant */
  color?: "accent" | "success" | "error" | "warning";
  /** Whether to show the pulsing animation */
  pulse?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-3 w-3", 
  lg: "h-4 w-4",
};

const colorClasses = {
  accent: "bg-terminal-accent",
  success: "bg-green-500",
  error: "bg-red-500",
  warning: "bg-yellow-500",
};

const pulseColorClasses = {
  accent: "bg-terminal-accent",
  success: "bg-green-500",
  error: "bg-red-500",
  warning: "bg-yellow-500",
};

/**
 * Pulsing dot indicator - used for showing active/live status
 */
export const PulsingDot = memo(function PulsingDot({
  size = "sm",
  color = "accent",
  pulse = true,
  className = "",
}: PulsingDotProps) {
  const sizeClass = sizeClasses[size];
  const colorClass = colorClasses[color];
  const pulseColorClass = pulseColorClasses[color];

  return (
    <span className={`relative flex ${sizeClass} ${className}`}>
      {pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColorClass} opacity-75`}
        />
      )}
      <span
        className={`relative inline-flex rounded-full ${sizeClass} ${colorClass}`}
      />
    </span>
  );
});
