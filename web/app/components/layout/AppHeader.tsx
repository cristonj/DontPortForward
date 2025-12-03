"use client";

import { memo } from "react";
import type { Device } from "../../types";
import { isDeviceConnected } from "../../utils";
import { MenuIcon, RefreshIcon } from "../Icons";
import { PulsingDot } from "../ui";

type ViewMode = 'console' | 'status' | 'files' | 'config';

interface AppHeaderProps {
  selectedDeviceId: string;
  selectedDevice: Device | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onMenuClick: () => void;
  onRestart: () => void;
}

export const AppHeader = memo(function AppHeader({
  selectedDeviceId,
  selectedDevice,
  viewMode,
  onViewModeChange,
  onMenuClick,
  onRestart,
}: AppHeaderProps) {
  return (
    <header className="bg-gray-900/50 backdrop-blur-lg border-b border-gray-800 h-14 flex items-center justify-between px-4 shrink-0 gap-3">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Hamburger Menu */}
        <button 
          className="md:hidden text-gray-400 hover:text-white p-1.5 -ml-1 rounded-lg hover:bg-gray-800 transition-colors"
          onClick={onMenuClick}
          aria-label="Toggle Menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        
        <DeviceInfo 
          selectedDeviceId={selectedDeviceId}
          selectedDevice={selectedDevice}
        />
      </div>

      {/* View Mode Tabs & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {selectedDeviceId && (
          <>
            <ViewModeSwitcher 
              currentMode={viewMode}
              onModeChange={onViewModeChange}
            />
            <RestartButton onRestart={onRestart} />
          </>
        )}
      </div>
    </header>
  );
});

interface DeviceInfoProps {
  selectedDeviceId: string;
  selectedDevice: Device | null;
}

const DeviceInfo = memo(function DeviceInfo({ selectedDeviceId, selectedDevice }: DeviceInfoProps) {
  const connected = selectedDevice ? isDeviceConnected(selectedDevice.last_seen) : false;
  
  return (
    <div className="flex flex-col min-w-0">
      <h1 className="font-bold text-sm sm:text-base leading-none tracking-tight truncate">
        {selectedDeviceId ? (
          <span className="text-white">{selectedDevice?.hostname || selectedDeviceId}</span>
        ) : (
          <span className="text-gray-500">Select Device</span>
        )}
      </h1>
      {selectedDeviceId && selectedDevice && (
        <span className={`text-[10px] leading-none mt-1 truncate flex items-center gap-1 ${
          connected ? 'text-terminal-success' : 'text-red-400'
        }`}>
          <PulsingDot 
            size="sm" 
            color={connected ? 'success' : 'error'} 
            pulse={connected} 
          />
          {connected ? 'Connected' : 'Not Connected'}
        </span>
      )}
    </div>
  );
});

interface ViewModeSwitcherProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

const ViewModeSwitcher = memo(function ViewModeSwitcher({ currentMode, onModeChange }: ViewModeSwitcherProps) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: 'console', label: 'Term' },
    { key: 'files', label: 'Files' },
    { key: 'status', label: 'Info' },
    { key: 'config', label: 'Config' },
  ];

  return (
    <div className="flex bg-gray-800/50 rounded-lg p-0.5 border border-gray-700/50">
      {modes.map(({ key, label }) => (
        <button 
          key={key}
          onClick={() => onModeChange(key)} 
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
            currentMode === key 
              ? 'bg-terminal-accent text-gray-950 shadow-sm' 
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
});

interface RestartButtonProps {
  onRestart: () => void;
}

const RestartButton = memo(function RestartButton({ onRestart }: RestartButtonProps) {
  return (
    <button
      onClick={onRestart}
      className="p-2 text-gray-400 hover:text-terminal-error hover:bg-terminal-error/10 rounded-lg transition-colors"
      title="Restart Agent"
    >
      <RefreshIcon className="w-4 h-4" />
    </button>
  );
});
