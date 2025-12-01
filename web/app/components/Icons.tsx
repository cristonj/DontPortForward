"use client";

import { memo } from "react";

interface IconProps {
  className?: string;
}

// Common icon wrapper for consistent stroke styling
const IconWrapper = memo(function IconWrapper({ 
  children, 
  className = "w-4 h-4" 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
});

// Refresh/Reload icon (used in multiple places)
export const RefreshIcon = memo(function RefreshIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
      />
    </IconWrapper>
  );
});

// Delete/Trash icon
export const TrashIcon = memo(function TrashIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
      />
    </IconWrapper>
  );
});

// Close/X icon
export const CloseIcon = memo(function CloseIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M6 18L18 6M6 6l12 12" 
      />
    </IconWrapper>
  );
});

// Plus icon
export const PlusIcon = memo(function PlusIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 4v16m8-8H4" 
      />
    </IconWrapper>
  );
});

// Upload icon
export const UploadIcon = memo(function UploadIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
      />
    </IconWrapper>
  );
});

// Chevron down icon
export const ChevronDownIcon = memo(function ChevronDownIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M19 9l-7 7-7-7" 
      />
    </IconWrapper>
  );
});

// Terminal icon
export const TerminalIcon = memo(function TerminalIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
      />
    </IconWrapper>
  );
});

// Warning/Alert triangle icon
export const WarningIcon = memo(function WarningIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
      />
    </IconWrapper>
  );
});

// Error/Alert circle icon
export const ErrorIcon = memo(function ErrorIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </IconWrapper>
  );
});

// Check/Success circle icon
export const CheckCircleIcon = memo(function CheckCircleIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </IconWrapper>
  );
});

// Menu/Hamburger icon
export const MenuIcon = memo(function MenuIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M4 6h16M4 12h16M4 18h16" 
      />
    </IconWrapper>
  );
});

// Logout icon
export const LogoutIcon = memo(function LogoutIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
      />
    </IconWrapper>
  );
});

// Document/File icon
export const FileIcon = memo(function FileIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
      />
    </IconWrapper>
  );
});

// Hash/Code icon (for IDs)
export const HashIcon = memo(function HashIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" 
      />
    </IconWrapper>
  );
});

// Arrow right icon
export const ArrowRightIcon = memo(function ArrowRightIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M5 12h14M12 5l7 7-7 7" 
      />
    </IconWrapper>
  );
});

// Clock icon
export const ClockIcon = memo(function ClockIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </IconWrapper>
  );
});

// Star/Sparkle icon (for startup file)
export const SparkleIcon = memo(function SparkleIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" 
      />
    </IconWrapper>
  );
});

// Play icon (for running scripts)
export const PlayIcon = memo(function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className || "w-4 h-4"} fill="currentColor" viewBox="0 0 20 20">
      <path 
        fillRule="evenodd" 
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" 
        clipRule="evenodd" 
      />
    </svg>
  );
});

// Edit/Pencil icon
export const EditIcon = memo(function EditIcon({ className }: IconProps) {
  return (
    <IconWrapper className={className}>
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
      />
    </IconWrapper>
  );
});
