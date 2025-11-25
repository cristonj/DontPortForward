"use client";

import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { db, auth } from "../lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  limit,
  doc,
  updateDoc,
  writeBatch,
  deleteDoc,
  getDocs
} from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import dynamic from 'next/dynamic';
import DeviceList from "./components/DeviceList";
import SwipeToDeleteLogItem from "./components/SwipeToDeleteLogItem";

const DeviceStatus = dynamic(() => import('./components/DeviceStatus'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading status...</div>
});
const SharedFolder = dynamic(() => import('./components/SharedFolder'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading files...</div>
});
const ApiExplorer = dynamic(() => import('./components/ApiExplorer'), {
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading API explorer...</div>
});

interface CommandLog {
  id: string;
  command: string;
  output?: string;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  created_at: any;
  completed_at?: any;
  last_activity?: any;
  output_lines?: number;
  error_lines?: number;
}

const SUGGESTED_COMMANDS = [
  "ls -la",
  "ps aux",
  "df -h",
  "free -m",
  "uptime",
  "whoami",
  "id",
  "ip addr",
  "netstat -tuln",
  "docker ps",
  "systemctl status",
  "cat /etc/os-release",
  "uname -a",
  "top -b -n 1"
];

// Memoized component for rendering log output to reduce re-renders
const LogOutput = memo(({ text, isError = false }: { text: string; isError?: boolean }) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  const maxLines = 50;
  const displayLines = useMemo(() => {
    if (lines.length <= maxLines) return lines;
    return lines.slice(-maxLines);
  }, [lines, maxLines]);
  
  return (
    <pre className={`whitespace-pre-wrap break-all leading-relaxed ${isError ? 'text-red-400/80' : ''}`}>
      {displayLines.map((line, idx) => (
        <div key={idx} className={isError ? 'hover:bg-red-900/10' : 'hover:bg-gray-800/30'}>
          <span className="text-gray-600 select-none mr-3 inline-block w-8 text-right">
            {displayLines.length - maxLines + idx + 1 > 0 ? displayLines.length - maxLines + idx + 1 : idx + 1}
          </span>
          <span>{line || ' '}</span>
        </div>
      ))}
    </pre>
  );
}, (prevProps, nextProps) => {
  // Only re-render if text or isError changed
  return prevProps.text === nextProps.text && prevProps.isError === nextProps.isError;
});
LogOutput.displayName = 'LogOutput';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const isForcedLogout = useRef(false);

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [inputCommand, setInputCommand] = useState("");
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [viewMode, setViewMode] = useState<'console' | 'status' | 'files' | 'api'>('console');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  
  // Expanded history logs state
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  
  // Connection issues warning
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);

  /**
   * Main dashboard component.
   * Manages authentication, device selection, and view modes (console, files, api, status).
   */
  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (isForcedLogout.current) {
        isForcedLogout.current = false;
      } else {
        setErrorMsg(""); // Clear previous errors
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

  // Load selected device ID from local storage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("selectedDeviceId");
    if (savedId) setSelectedDeviceId(savedId);
  }, []);

  const handleDeviceSelect = useCallback((id: string) => {
      setSelectedDeviceId(id);
      localStorage.setItem("selectedDeviceId", id);
      setIsSidebarOpen(false); // Close sidebar on selection on mobile
  }, []);

  // Listen for logs of the selected device - ONLY when console view is active
  useEffect(() => {
    if (!selectedDeviceId || !user || viewMode !== 'console') {
        if (viewMode !== 'console') {
          // Keep existing logs when switching away from console
          return;
        }
        setLogs([]);
        return;
    }

    const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
    // Change to descending to get the most recent commands first
    const q = query(commandsRef, orderBy("created_at", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs: CommandLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CommandLog));
      setLogs(newLogs);
    }, (error) => {
      if (error.code === 'permission-denied') {
          // Permissions might be lost during logout, ignore safely
          console.debug("Logs permission denied (possibly logged out)");
      } else {
          console.error("Error fetching logs:", error);
      }
    });

    return () => unsubscribe();
  }, [selectedDeviceId, user, viewMode]);

  // Request output for active commands (polling mechanism) - OPTIMIZED
  useEffect(() => {
    if (!selectedDeviceId || !user || viewMode !== 'console') return;

    let consecutiveErrors = 0;
    let isPollingEnabled = true;

    const requestOutputForActiveCommands = async () => {
      if (!isPollingEnabled) return;
      
      // Find active commands that need output
      const activeLogs = logs.filter(log => ['pending', 'processing'].includes(log.status));
      
      // Skip if no active commands
      if (activeLogs.length === 0) return;
      
      // Limit to max 3 concurrent update requests to avoid overwhelming Firestore
      const logsToUpdate = activeLogs.slice(0, 3);
      
      for (const log of logsToUpdate) {
        // Only request if we don't have recent output or it's been a while
        const needsUpdate = !log.output || 
          (log.last_activity && log.last_activity.toMillis && Date.now() - log.last_activity.toMillis() > 15000);
        
        if (needsUpdate) {
          try {
            const commandRef = doc(db, "devices", selectedDeviceId, "commands", log.id);
            await updateDoc(commandRef, {
              output_request: {
                seconds: 60,  // Request last 60 seconds
                request_id: `${Date.now()}-${Math.random()}`
              }
            });
            consecutiveErrors = 0; // Reset error counter on success
          } catch (error: any) {
            consecutiveErrors++;
            console.debug("Could not request output:", error);
            
            // If we get too many errors (likely blocked by extension), reduce polling
            if (consecutiveErrors > 5) {
              console.warn("Multiple polling errors detected - reducing poll frequency");
              setShowConnectionWarning(true);
              isPollingEnabled = false;
              setTimeout(() => { 
                isPollingEnabled = true;
                setShowConnectionWarning(false);
              }, 30000); // Re-enable after 30s
            }
          }
        }
      }
    };

    // Increased interval from 5s to 10s for better performance
    const interval = setInterval(requestOutputForActiveCommands, 10000);
    requestOutputForActiveCommands(); // Initial request

    return () => clearInterval(interval);
  }, [selectedDeviceId, user, viewMode, logs]);

  // Handle Input Change & Autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputCommand(value);
    
    if (value.trim()) {
        const filtered = SUGGESTED_COMMANDS.filter(cmd => 
            cmd.toLowerCase().startsWith(value.toLowerCase()) && cmd !== value
        );
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSuggestionIndex(-1);
    } else {
        setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!showSuggestions) return;

      if (e.key === "ArrowDown") {
          e.preventDefault();
          setSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Tab" || e.key === "Enter") {
          if (suggestionIndex >= 0) {
              e.preventDefault();
              setInputCommand(suggestions[suggestionIndex]);
              setShowSuggestions(false);
          }
      } else if (e.key === "Escape") {
          setShowSuggestions(false);
      }
  };

  const sendCommand = useCallback(async (e?: React.FormEvent, cmdString?: string) => {
    if (e) e.preventDefault();
    const cmdToRun = cmdString || inputCommand;
    
    if (!cmdToRun.trim() || !selectedDeviceId) return;

    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      await addDoc(commandsRef, {
        command: cmdToRun,
        type: 'shell', // Default to shell
        status: 'pending',
        created_at: serverTimestamp()
      });
      setErrorMsg(""); // Clear any previous errors
      if (!cmdString) {
          setInputCommand("");
          setShowSuggestions(false);
      } else {
          // Switch to console view to see output
          setViewMode('console');
      }
    } catch (error: any) {
      console.error("Error sending command:", error);
      const errorMessage = error?.message || "Failed to send command. Check console for details.";
      setErrorMsg(`Error: ${errorMessage}`);
      // Log full error details for debugging
      if (error?.code) {
        console.error("Firebase error code:", error.code);
      }
    }
  }, [inputCommand, selectedDeviceId]);

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
    }
  };

  const killCommand = async (cmdId: string) => {
    if (!selectedDeviceId) return;
    try {
        const commandRef = doc(db, "devices", selectedDeviceId, "commands", cmdId);
        await updateDoc(commandRef, {
            kill_signal: true
        });
    } catch (error) {
        console.error("Error killing command:", error);
    }
  };

  const deleteCommand = async (logId: string, isActive: boolean = false) => {
    if (!selectedDeviceId) return;
    
    const log = logs.find(l => l.id === logId);
    const commandText = log?.command || 'this task';
    const confirmMessage = isActive 
      ? `Are you sure you want to delete the active task "${commandText}"? This will remove it from the history and may leave ghost processes running.`
      : `Are you sure you want to delete "${commandText}"?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        await deleteDoc(doc(db, "devices", selectedDeviceId, "commands", logId));
    } catch (error) {
        console.error("Error deleting command:", error);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedDeviceId || historyLogs.length === 0) return;
    if (!confirm("Clear terminal history? This cannot be undone.")) return;

    try {
      const batch = writeBatch(db);
      historyLogs.forEach(log => {
        const docRef = doc(db, "devices", selectedDeviceId, "commands", log.id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  };

  const toggleLogExpansion = useCallback((logId: string) => {
    setExpandedLogs(prev => {
        const next = new Set(prev);
        if (next.has(logId)) {
            next.delete(logId);
        } else {
            next.add(logId);
        }
        return next;
    });
  }, []);

  const manualRefresh = async () => {
    if (!selectedDeviceId || !user) return;
    setIsRefreshing(true);
    
    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      const q = query(commandsRef, orderBy("created_at", "desc"), limit(50));
      const snapshot = await getDocs(q);
      
      const newLogs: CommandLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CommandLog));
      setLogs(newLogs);
    } catch (error) {
      console.error("Error refreshing logs:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Helper function to get last N lines of text - memoized
  const getLastLines = useMemo(() => {
    return (text: string | undefined, maxLines: number = 50): string => {
      if (!text) return '';
      const lines = text.split('\n');
      if (lines.length <= maxLines) return text;
      return lines.slice(-maxLines).join('\n');
    };
  }, []);

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

  // Split logs into running and recent history - memoized to prevent recalculation on every render
  const runningLogs = useMemo(() => 
    logs.filter(log => ['pending', 'processing'].includes(log.status)), 
    [logs]
  );
  const historyLogs = useMemo(() => 
    logs.filter(log => !['pending', 'processing'].includes(log.status)), 
    [logs]
  );

  if (authLoading) {
      return <div className="h-screen w-screen flex items-center justify-center bg-black text-gray-500">Loading...</div>;
  }

  if (!user) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white gap-4">
              <h1 className="text-2xl font-bold mb-4">DontPortForward Console</h1>
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded max-w-md text-center">
                  {errorMsg}
                </div>
              )}
              <button 
                onClick={handleLogin}
                className="bg-white text-black px-6 py-3 rounded font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
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

  return (
    <main className="flex h-[100dvh] bg-black text-gray-200 font-mono overflow-hidden relative selection:bg-gray-800">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-72 md:w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 bg-gray-900/95 border-r border-gray-800
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
                 <div className="flex items-center gap-3 mb-2">
                     {user.photoURL && (
                         <img 
                           src={user.photoURL} 
                           alt="User" 
                           width={32}
                           height={32}
                           className="w-8 h-8 rounded-full" 
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
                    className="w-full text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded transition-colors flex items-center gap-2"
                 >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign Out
                 </button>
             </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full bg-gray-950">
          {/* Header */}
          <header className="bg-gray-900/50 backdrop-blur border-b border-gray-800 h-14 flex items-center justify-between px-4 shrink-0 gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
                {/* Hamburger Menu */}
                <button 
                    className="md:hidden text-gray-400 hover:text-white p-1 -ml-1"
                    onClick={() => setIsSidebarOpen(true)}
                    aria-label="Toggle Menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                
                <div className="flex flex-col min-w-0">
                   <h1 className="font-bold text-sm sm:text-base leading-none tracking-tight truncate">
                       {selectedDeviceId ? (
                           <span className="text-white">{selectedDeviceId}</span>
                       ) : (
                           <span className="text-gray-500">Select Device</span>
                       )}
                   </h1>
                   {selectedDeviceId && (
                       <span className="text-[10px] text-gray-500 leading-none mt-1 truncate">
                           Connected
                       </span>
                   )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
                {selectedDeviceId && (
                    <>
                        <div className="flex bg-gray-800/50 rounded-lg p-0.5">
                            <button 
                                onClick={() => setViewMode('console')} 
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'console' 
                                    ? 'bg-gray-700 text-white shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-300'
                                }`}
                            >
                                Term
                            </button>
                            <button 
                                onClick={() => setViewMode('files')} 
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'files' 
                                    ? 'bg-gray-700 text-white shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-300'
                                }`}
                            >
                                Files
                            </button>
                            <button 
                                onClick={() => setViewMode('api')} 
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'api' 
                                    ? 'bg-gray-700 text-white shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-300'
                                }`}
                            >
                                API
                            </button>
                            <button 
                                onClick={() => setViewMode('status')} 
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'status' 
                                    ? 'bg-gray-700 text-white shadow-sm' 
                                    : 'text-gray-400 hover:text-gray-300'
                                }`}
                            >
                                Info
                            </button>
                        </div>

                        <button
                            onClick={handleRestart}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
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
          {viewMode === 'console' ? (
              <>
                {/* Error Banner */}
                {errorMsg && (
                  <div className="bg-red-500/10 border-b border-red-500/50 text-red-400 px-4 py-2 text-sm flex items-center justify-between">
                    <span>{errorMsg}</span>
                    <button 
                      onClick={() => setErrorMsg("")}
                      className="text-red-400 hover:text-red-300 ml-4"
                      aria-label="Dismiss error"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* Connection Warning Banner */}
                {showConnectionWarning && (
                  <div className="bg-yellow-500/10 border-b border-yellow-500/50 text-yellow-400 px-4 py-2 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Connection issues detected. Check if a browser extension is blocking Firestore requests. Updates temporarily reduced.</span>
                    </div>
                    <button 
                      onClick={() => setShowConnectionWarning(false)}
                      className="text-yellow-400 hover:text-yellow-300 ml-4 shrink-0"
                      aria-label="Dismiss warning"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* Terminal Output */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 font-mono text-sm relative">
                    {/* Manual Refresh Button and Status */}
                    {selectedDeviceId && (
                        <div className="fixed top-20 right-4 z-30 flex flex-col gap-2 items-end">
                            <button
                                onClick={manualRefresh}
                                disabled={isRefreshing}
                                className="bg-gray-800/90 hover:bg-gray-700 backdrop-blur-sm border border-gray-700 text-gray-300 px-3 py-2 rounded-lg shadow-lg transition-all flex items-center gap-2 text-xs font-medium disabled:opacity-50"
                                title="Manually refresh terminal"
                            >
                                <svg 
                                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {isRefreshing ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <div className="bg-gray-800/90 backdrop-blur-sm border border-gray-700 px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-[10px]">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="text-gray-400 uppercase tracking-wider">Live Updates</span>
                            </div>
                        </div>
                    )}
                    {!selectedDeviceId && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
                            <div className="w-12 h-12 border-2 border-gray-700 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </div>
                            <p>Select a device from the menu to connect.</p>
                        </div>
                    )}
                    
                    {selectedDeviceId && logs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600">
                             <p>Ready. Enter a command to begin.</p>
                        </div>
                    )}
                    
                    {/* Running Processes Section */}
                    {selectedDeviceId && runningLogs.length > 0 && (
                        <div className="space-y-3 pb-2">
                            <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 py-2 -mt-2 border-b border-blue-500/20">
                                <h3 className="text-xs uppercase tracking-wider text-blue-400 font-bold flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                    </span>
                                    Active Processes ({runningLogs.length})
                                    <span className="ml-auto text-[10px] text-blue-400/50 normal-case tracking-normal">Real-time updates</span>
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {runningLogs.map(log => (
                                    <div key={log.id} className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-blue-500/30 rounded-lg p-4 shadow-xl backdrop-blur-sm relative group overflow-hidden">
                                        {/* Animated border effect */}
                                        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0"></div>
                                        </div>
                                        
                                        <div className="flex justify-between items-start mb-3 relative z-10">
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="font-bold text-white text-base mb-1 break-all">{log.command}</div>
                                                <div className="text-xs text-blue-300/70 font-mono flex items-center gap-2 flex-wrap">
                                                    <span className="inline-flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                        </svg>
                                                        {log.id.substring(0, 8)}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="uppercase">{log.status}</span>
                                                </div>
                                            </div>
                                            <div className="ml-3 flex items-center gap-2">
                                                <button 
                                                    onClick={() => killCommand(log.id)}
                                                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                                >
                                                    <span className="w-2 h-2 bg-red-500 rounded-sm animate-pulse"></span>
                                                    Kill
                                                </button>
                                                <button 
                                                    onClick={() => deleteCommand(log.id, true)}
                                                    className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-600/30 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                                    title="Delete task"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Output Preview for Active Process - Last 50 lines */}
                                        <div className="bg-black/50 rounded p-3 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-900/50 border border-gray-800/50" style={{ scrollBehavior: 'smooth' }}>
                                            {(log.output || log.error) ? (
                                                <div className="space-y-1">
                                                    {log.output && (
                                                        <div>
                                                            <div className="text-blue-400/60 text-[10px] mb-1 uppercase tracking-wider">
                                                                Output (Last 50 lines)
                                                            </div>
                                                            <LogOutput text={getLastLines(log.output, 50)} />
                                                        </div>
                                                    )}
                                                    {log.error && (
                                                        <div className="mt-2">
                                                            <div className="text-red-400/60 text-[10px] mb-1 uppercase tracking-wider">Error</div>
                                                            <LogOutput text={getLastLines(log.error, 50)} isError={true} />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-32">
                                                    <div className="text-center">
                                                        <div className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-pulse mb-2"></div>
                                                        <div className="text-gray-500 italic text-xs">Waiting for output...</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent History Section */}
                    {selectedDeviceId && historyLogs.length > 0 && (
                        <div className="space-y-3 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                                    Recent History
                                </h3>
                                <button
                                    onClick={handleClearHistory}
                                    className="text-[10px] text-gray-500 hover:text-red-400 uppercase tracking-wider transition-colors flex items-center gap-1 hover:bg-red-500/10 px-2 py-1 rounded"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Clear
                                </button>
                            </div>
                            <div className="space-y-2">
                                {historyLogs.map(log => {
                                    const isExpanded = expandedLogs.has(log.id);
                                    return (
                                    <SwipeToDeleteLogItem 
                                        key={log.id} 
                                        onDelete={() => deleteCommand(log.id, false)}
                                        onClick={() => toggleLogExpansion(log.id)}
                                        isExpanded={isExpanded}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                                                log.status === 'completed' ? 'bg-green-500/50' : 'bg-red-500/50'
                                            }`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-mono text-sm text-gray-300 break-all">{log.command}</span>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                sendCommand(undefined, log.command);
                                                            }}
                                                            className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
                                                            title="Rerun"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        </button>
                                                        <span className="text-[10px] text-gray-600 uppercase tracking-wider">{log.status}</span>
                                                        <svg 
                                                            className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                                            fill="none" 
                                                            stroke="currentColor" 
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {/* Output preview or full view */}
                                                {(log.output || log.error) && (
                                                    <div className={`mt-2 font-mono ${
                                                        isExpanded 
                                                        ? 'text-xs bg-black/30 p-3 rounded border border-gray-800/50 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-900/50' 
                                                        : 'text-xs line-clamp-2 pl-2 border-l-2 border-gray-800 text-gray-500'
                                                    }`} style={isExpanded ? { scrollBehavior: 'smooth' } : undefined}>
                                                        {isExpanded ? (
                                                            <div className="space-y-2">
                                                                {log.output && (
                                                                    <div>
                                                                        <div className="text-blue-400/60 text-[10px] mb-1 uppercase tracking-wider">
                                                                            Output (Last 50 lines)
                                                                        </div>
                                                                        <LogOutput text={getLastLines(log.output, 50)} />
                                                                    </div>
                                                                )}
                                                                {log.error && (
                                                                    <div>
                                                                        <div className="text-red-400/60 text-[10px] mb-1 uppercase tracking-wider">Error</div>
                                                                        <LogOutput text={getLastLines(log.error, 50)} isError={true} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {log.output && (
                                                                    <span>{log.output.substring(0, 150)}</span>
                                                                )}
                                                                {log.error && (
                                                                    <span className="text-red-500/70 block mt-1">
                                                                        {log.error.substring(0, 150)}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </SwipeToDeleteLogItem>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>

                {/* Input Area */}
                <div className="bg-gray-900 p-3 border-t border-gray-800 shrink-0 relative z-20 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                    
                    {/* Suggestions Popup */}
                    {showSuggestions && (
                        <div className="absolute bottom-full left-3 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden w-64 max-h-48 overflow-y-auto z-50">
                            {suggestions.map((suggestion, index) => (
                                <div 
                                    key={suggestion}
                                    className={`px-4 py-2.5 cursor-pointer text-sm font-mono border-b border-gray-700/50 last:border-0 ${
                                        index === suggestionIndex ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                                    }`}
                                    onClick={() => {
                                        setInputCommand(suggestion);
                                        setShowSuggestions(false);
                                    }}
                                >
                                    {suggestion}
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={sendCommand} className="flex gap-2 items-end max-w-4xl mx-auto">
                        <div className="relative flex-1 bg-gray-950 border border-gray-700 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all flex items-center">
                            <span className="pl-3 text-blue-500 select-none font-bold">{'>'}</span>
                            <input
                                type="text"
                                value={inputCommand}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 font-mono text-sm py-3 pl-2 pr-3 disabled:opacity-50"
                                placeholder={selectedDeviceId ? "Enter command..." : "Select a device first"}
                                autoFocus
                                disabled={!selectedDeviceId}
                                autoComplete="off"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={!inputCommand.trim() || !selectedDeviceId}
                            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-lg text-white font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center"
                        >
                           <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </form>
                </div>
              </>
          ) : viewMode === 'files' ? (
              <SharedFolder 
                deviceId={selectedDeviceId} 
                onRunCommand={(cmd) => sendCommand(undefined, cmd)}
              />
          ) : viewMode === 'api' ? (
              <ApiExplorer deviceId={selectedDeviceId} />
          ) : (
              <DeviceStatus deviceId={selectedDeviceId} />
          )}
      </div>
    </main>
  );
}
