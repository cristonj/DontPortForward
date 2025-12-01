"use client";

import { memo, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  /** Visual variant */
  variant?: "default" | "elevated" | "bordered";
  /** Padding size */
  padding?: "sm" | "md" | "lg";
  /** Whether to show hover effect */
  hoverable?: boolean;
  className?: string;
  onClick?: () => void;
}

const variantClasses = {
  default: "bg-gray-900/50 border border-gray-800",
  elevated: "bg-gray-900/50 border border-gray-800 shadow-xl",
  bordered: "bg-transparent border border-gray-800",
};

const paddingClasses = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/**
 * Card component for consistent panel styling
 */
export const Card = memo(function Card({
  children,
  variant = "default",
  padding = "md",
  hoverable = false,
  className = "",
  onClick,
}: CardProps) {
  const baseClasses = "rounded-xl backdrop-blur-sm transition-colors";
  const hoverClasses = hoverable ? "hover:border-gray-700 cursor-pointer" : "";

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
});
