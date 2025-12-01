"use client";

import { memo, ReactNode } from "react";

interface SectionHeaderProps {
  children: ReactNode;
  /** Optional right-aligned content */
  action?: ReactNode;
  /** Size variant */
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
};

/**
 * Section header component for consistent section titles
 */
export const SectionHeader = memo(function SectionHeader({
  children,
  action,
  size = "sm",
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h3 className={`uppercase tracking-wider text-gray-500 font-bold ${sizeClasses[size]}`}>
        {children}
      </h3>
      {action && <div>{action}</div>}
    </div>
  );
});
