"use client";

import { memo } from "react";

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: "sm" | "md" | "lg";
  /** Color variant */
  color?: "accent" | "white" | "gray";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const colorClasses = {
  accent: "border-terminal-accent/30 border-t-terminal-accent",
  white: "border-white/30 border-t-white",
  gray: "border-gray-600 border-t-gray-400",
};

/**
 * Loading spinner component
 */
export const LoadingSpinner = memo(function LoadingSpinner({
  size = "md",
  color = "accent",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div
      className={`${sizeClasses[size]} border-2 ${colorClasses[color]} rounded-full animate-spin ${className}`}
    />
  );
});
