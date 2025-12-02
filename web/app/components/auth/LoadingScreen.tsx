"use client";

import { memo } from "react";
import { LoadingSpinner } from "../ui";

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen = memo(function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="h-dvh w-screen flex items-center justify-center bg-black text-gray-500 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        <span>{message}</span>
      </div>
    </div>
  );
});
