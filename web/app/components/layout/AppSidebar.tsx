"use client";

import { memo } from "react";
import Image from "next/image";
import { User } from "firebase/auth";
import DeviceList from "../DeviceList";
import { LogoutIcon } from "../Icons";

interface AppSidebarProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice: (id: string) => void;
  selectedDeviceId: string;
  onLogout: () => void;
}

export const AppSidebar = memo(function AppSidebar({
  user,
  isOpen,
  onClose,
  onSelectDevice,
  selectedDeviceId,
  onLogout,
}: AppSidebarProps) {
  const handleDeviceSelect = (id: string) => {
    onSelectDevice(id);
    onClose();
  };

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-72 md:w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 bg-gray-900/95 border-r border-gray-800 pt-[env(safe-area-inset-top)]
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <DeviceList 
            onSelectDevice={handleDeviceSelect} 
            selectedDeviceId={selectedDeviceId}
            currentUserEmail={user.email}
            className="flex-1" 
          />
          <UserPanel user={user} onLogout={onLogout} />
        </div>
      </div>
    </>
  );
});

interface UserPanelProps {
  user: User;
  onLogout: () => void;
}

const UserPanel = memo(function UserPanel({ user, onLogout }: UserPanelProps) {
  return (
    <div className="p-4 border-t border-gray-800 bg-gray-900/50">
      <div className="flex items-center gap-3 mb-3">
        {user.photoURL && (
          <Image 
            src={user.photoURL} 
            alt="User" 
            width={32}
            height={32}
            className="w-8 h-8 rounded-full ring-2 ring-gray-800" 
            referrerPolicy="no-referrer"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{user.displayName}</div>
          <div className="text-xs text-gray-500 truncate">{user.email}</div>
        </div>
      </div>
      <button 
        onClick={onLogout}
        className="w-full text-left text-xs text-terminal-error hover:text-red-300 hover:bg-terminal-error/10 p-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <LogoutIcon className="w-3.5 h-3.5" />
        Sign Out
      </button>
    </div>
  );
});
