"use client";

import { memo } from "react";
import { User } from "firebase/auth";
import dynamic from 'next/dynamic';
import ConsoleView from "../console/ConsoleView";
import { ArrowRightIcon } from "../Icons";

const DeviceStatus = dynamic(() => import('../DeviceStatus'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading status...</div>
});

const SharedFolder = dynamic(() => import('../SharedFolder'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading files...</div>
});

type ViewMode = 'console' | 'status' | 'files';

interface MainContentProps {
  viewMode: ViewMode;
  selectedDeviceId: string;
  user: User;
  onSendCommand: (command: string) => Promise<void>;
}

export const MainContent = memo(function MainContent({
  viewMode,
  selectedDeviceId,
  user,
  onSendCommand,
}: MainContentProps) {
  if (!selectedDeviceId) {
    return <EmptyState />;
  }

  if (viewMode === 'files') {
    return (
      <SharedFolder 
        deviceId={selectedDeviceId} 
        onRunCommand={onSendCommand}
      />
    );
  }

  if (viewMode === 'status') {
    return <DeviceStatus deviceId={selectedDeviceId} />;
  }

  return <ConsoleView deviceId={selectedDeviceId} user={user} />;
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
      <div className="w-16 h-16 border-2 border-gray-700 rounded-xl flex items-center justify-center">
        <ArrowRightIcon className="w-8 h-8 text-terminal-accent/50" />
      </div>
      <p className="text-gray-500">Select a device from the menu to connect.</p>
    </div>
  );
});
