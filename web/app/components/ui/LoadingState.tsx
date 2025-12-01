"use client";

import { memo } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface LoadingStateProps {
  /** Loading message to display */
  message?: string;
  /** Size of the loading state */
  size?: "sm" | "md" | "lg";
  /** Whether to use pulsing animation on text */
  pulse?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const spinnerSizes = {
  sm: "sm" as const,
  md: "md" as const,
  lg: "lg" as const,
};

/**
 * Full loading state component with spinner and message
 */
export const LoadingState = memo(function LoadingState({
  message = "Loading...",
  size = "md",
  pulse = true,
  className = "",
}: LoadingStateProps) {
  return (
    <div className={`h-full flex flex-col items-center justify-center text-gray-500 gap-3 ${className}`}>
      <LoadingSpinner size={spinnerSizes[size]} />
      <span className={`${sizeClasses[size]} ${pulse ? "animate-pulse" : ""}`}>
        {message}
      </span>
    </div>
  );
});
