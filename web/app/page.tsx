"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { db, auth } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import dynamic from 'next/dynamic';
import DeviceList from "./components/DeviceList";
import ConsoleView from "./components/console/ConsoleView";
import type { Device } from "./types";
import { isDeviceConnected } from "./utils";

const DeviceStatus = dynamic(() => import('./components/DeviceStatus'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading status...</div>
});
const SharedFolder = dynamic(() => import('./components/SharedFolder'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading files...</div>
});

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const isForcedLogout = useRef(false);

  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("selectedDeviceId") || "";
    }
    return "";
  });
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [viewMode, setViewMode] = useState<'console' | 'status' | 'files'>('console');
  
  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Force re-render for connection status check
  const [, setTick] = useState(0);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (isForcedLogout.current) {
        isForcedLogout.current = false;
      } else {
        setErrorMsg("");
      }

      if (currentUser && currentUser.email) {
        const envAllowed = process.env.ALLOWED_EMAILS;
        if (envAllowed) {
          const allowed = envAllowed.split(',').map(e => e.trim());
          if (!allowed.includes(currentUser.email)) {
            console.log("Access denied for:", currentUser.email);
            isForcedLogout.current = true;
            await signOut(auth);
            setErrorMsg("Access Denied: Your email is not in the allowed list.");
            setUser(null);
            setAuthLoading(false);
            return;
          }
        }
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to selected device data
  useEffect(() => {
    if (!selectedDeviceId) {
      // Clear selected device when no device is selected - intentional synchronous state clear
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDevice(null);
      return;
    }

    const unsub = onSnapshot(doc(db, "devices", selectedDeviceId), (docSnap) => {
      if (docSnap.exists()) {
        setSelectedDevice({ id: docSnap.id, ...docSnap.data() } as Device);
      } else {
        setSelectedDevice(null);
      }
    });

    return () => unsub();
  }, [selectedDeviceId]);

  // Periodically refresh connection status
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeviceSelect = useCallback((id: string) => {
    setSelectedDeviceId(id);
    localStorage.setItem("selectedDeviceId", id);
    setIsSidebarOpen(false);
  }, []);

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || !selectedDeviceId) return;

    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      await addDoc(commandsRef, {
        command,
        type: 'shell',
        status: 'pending',
        created_at: serverTimestamp()
      });
      setViewMode('console');
    } catch (error) {
      console.error("Error sending command:", error);
    }
  }, [selectedDeviceId]);

  const handleRestart = async () => {
    if (!selectedDeviceId) return;
    if (!confirm("Are you sure you want to restart the agent on this device?")) return;
    
    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      await addDoc(commandsRef, {
        type: 'restart',
        command: 'Restart Agent', 
        status: 'pending',
        created_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending restart command:", error);
      alert("Failed to send restart command");
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="h-dvh w-screen flex items-center justify-center bg-black text-gray-500 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="h-dvh w-screen flex flex-col items-center justify-center bg-black text-white gap-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2 text-terminal-accent">DontPortForward</h1>
          <p className="text-gray-500 text-sm">Remote Console Access</p>
        </div>
        {errorMsg && (
          <div className="bg-terminal-error/10 border border-terminal-error/50 text-terminal-error px-4 py-2 rounded-lg max-w-md text-center text-sm">
            {errorMsg}
          </div>
        )}
        <button 
          onClick={handleLogin}
          className="bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors flex items-center gap-3 shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  // Main content based on view mode
  let mainContent;
  if (viewMode === 'files') {
    mainContent = (
      <SharedFolder 
        deviceId={selectedDeviceId} 
        onRunCommand={sendCommand}
      />
    );
  } else if (viewMode === 'status') {
    mainContent = <DeviceStatus deviceId={selectedDeviceId} />;
  } else if (selectedDeviceId && user) {
    mainContent = <ConsoleView deviceId={selectedDeviceId} user={user} />;
  } else {
    // No device selected
    mainContent = (
      <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
        <div className="w-16 h-16 border-2 border-gray-700 rounded-xl flex items-center justify-center">
          <svg className="w-8 h-8 text-terminal-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-gray-500">Select a device from the menu to connect.</p>
      </div>
    );
  }

  return (
    <main className="flex h-dvh bg-black text-gray-200 font-mono overflow-hidden relative selection:bg-terminal-accent/30 pt-[env(safe-area-inset-top)]">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-72 md:w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 bg-gray-900/95 border-r border-gray-800 pt-[env(safe-area-inset-top)]
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <DeviceList 
            onSelectDevice={handleDeviceSelect} 
            selectedDeviceId={selectedDeviceId}
            currentUserEmail={user.email}
            className="flex-1" 
          />
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
              onClick={handleLogout}
              className="w-full text-left text-xs text-terminal-error hover:text-red-300 hover:bg-terminal-error/10 p-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full bg-gray-950">
        {/* Header */}
        <header className="bg-gray-900/50 backdrop-blur-lg border-b border-gray-800 h-14 flex items-center justify-between px-4 shrink-0 gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Hamburger Menu */}
            <button 
              className="md:hidden text-gray-400 hover:text-white p-1.5 -ml-1 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Toggle Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
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
                  isDeviceConnected(selectedDevice.last_seen) ? 'text-terminal-success' : 'text-red-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isDeviceConnected(selectedDevice.last_seen) ? 'bg-terminal-success animate-pulse' : 'bg-red-500'
                  }`} />
                  {isDeviceConnected(selectedDevice.last_seen) ? 'Connected' : 'Not Connected'}
                </span>
              )}
            </div>
          </div>

          {/* View Mode Tabs & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedDeviceId && (
              <>
                {/* View Mode Switcher */}
                <div className="flex bg-gray-800/50 rounded-lg p-0.5 border border-gray-700/50">
                  {(['console', 'files', 'status'] as const).map((mode) => (
                    <button 
                      key={mode}
                      onClick={() => setViewMode(mode)} 
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        viewMode === mode 
                          ? 'bg-terminal-accent text-gray-950 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                      }`}
                    >
                      {mode === 'console' ? 'Term' : mode === 'status' ? 'Info' : 'Files'}
                    </button>
                  ))}
                </div>

                {/* Restart Button */}
                <button
                  onClick={handleRestart}
                  className="p-2 text-gray-400 hover:text-terminal-error hover:bg-terminal-error/10 rounded-lg transition-colors"
                  title="Restart Agent"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        {mainContent}
      </div>
    </main>
  );
}
