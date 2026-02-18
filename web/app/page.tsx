"use client";

import { useState, useCallback } from "react";
import { useAuth, useDevice } from "./hooks";
import { LoginScreen, LoadingScreen } from "./components/auth";
import { AppSidebar, AppHeader, MainContent } from "./components/layout";

type ViewMode = 'console' | 'status' | 'files' | 'config';

export default function Home() {
  const { user, authLoading, errorMsg, handleLogin, handleLogout } = useAuth();
  const { 
    selectedDeviceId, 
    selectedDevice, 
    handleDeviceSelect, 
    sendCommand, 
    handleRestart 
  } = useDevice();
  
  const [viewMode, setViewMode] = useState<ViewMode>('console');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSendCommand = useCallback(async (command: string) => {
    await sendCommand(command);
    setViewMode('console');
  }, [sendCommand]);

  const handleDeviceSelectWithSidebar = useCallback((id: string) => {
    handleDeviceSelect(id);
    setIsSidebarOpen(false);
  }, [handleDeviceSelect]);

  // Loading state
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} errorMsg={errorMsg} />;
  }

  return (
    <main className="flex h-dvh bg-black text-gray-200 font-mono overflow-hidden relative selection:bg-terminal-accent/30 pt-[env(safe-area-inset-top)]">
      <AppSidebar
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectDevice={handleDeviceSelectWithSidebar}
        selectedDeviceId={selectedDeviceId}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full bg-gray-950">
        <AppHeader
          selectedDeviceId={selectedDeviceId}
          selectedDevice={selectedDevice}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onMenuClick={() => setIsSidebarOpen(true)}
          onRestart={handleRestart}
        />

        {/* Main Content Area */}
        <MainContent
          viewMode={viewMode}
          selectedDeviceId={selectedDeviceId}
          selectedDevice={selectedDevice}
          user={user}
          onSendCommand={handleSendCommand}
        />
      </div>
    </main>
  );
}
