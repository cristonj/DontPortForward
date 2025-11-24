"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  limit,
  doc,
  updateDoc
} from "firebase/firestore";
import DeviceList from "./components/DeviceList";
import DeviceStatus from "./components/DeviceStatus";

interface CommandLog {
  id: string;
  command: string;
  output?: string;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  created_at: any;
  completed_at?: any;
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

export default function Home() {
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [inputCommand, setInputCommand] = useState("");
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'console' | 'status'>('console');
  
  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  // Load selected device ID from local storage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("selectedDeviceId");
    if (savedId) setSelectedDeviceId(savedId);
  }, []);

  const handleDeviceSelect = (id: string) => {
      setSelectedDeviceId(id);
      localStorage.setItem("selectedDeviceId", id);
      setIsSidebarOpen(false); // Close sidebar on selection on mobile
  };

  // Listen for logs of the selected device
  useEffect(() => {
    if (!selectedDeviceId) {
        setLogs([]);
        return;
    }

    const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
    const q = query(commandsRef, orderBy("created_at", "asc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs: CommandLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CommandLog));
      setLogs(newLogs);
    }, (error) => {
      console.error("Error fetching logs:", error);
    });

    return () => unsubscribe();
  }, [selectedDeviceId]);

  // Scroll to bottom on new logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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

  const sendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim() || !selectedDeviceId) return;

    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      await addDoc(commandsRef, {
        command: inputCommand,
        type: 'shell', // Default to shell
        status: 'pending',
        created_at: serverTimestamp()
      });
      setInputCommand("");
      setShowSuggestions(false);
    } catch (error) {
      console.error("Error sending command:", error);
    }
  };

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
        fixed inset-y-0 left-0 z-50 w-72 md:w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 bg-gray-900/95 border-r border-gray-800
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
         <DeviceList 
            onSelectDevice={handleDeviceSelect} 
            selectedDeviceId={selectedDeviceId}
            className="h-full" 
         />
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
                {/* Terminal Output */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-800 font-mono text-sm">
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
                    
                    {logs.map((log) => (
                    <div key={log.id} className="group break-words">
                        <div className="flex items-start gap-2 text-blue-400">
                            <span className="text-gray-600 select-none mt-0.5">$</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-gray-300">{log.command}</span>
                                    {log.status === 'pending' && <span className="text-[10px] uppercase tracking-wider text-yellow-500/80 animate-pulse">Pending</span>}
                                    {log.status === 'processing' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase tracking-wider text-blue-500/80 animate-pulse">Running</span>
                                            <button 
                                                onClick={() => killCommand(log.id)}
                                                className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 text-red-400 rounded transition-all"
                                                title="Stop execution"
                                            >
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
                                            </button>
                                        </div>
                                    )}
                                    {log.status === 'cancelled' && <span className="text-[10px] uppercase tracking-wider text-red-500/80">Cancelled</span>}
                                </div>
                            </div>
                        </div>
                        
                        {(log.output || log.error) && (
                            <div className="mt-1 ml-4 relative">
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-800"></div>
                                <div className="pl-3 overflow-x-auto">
                                    {log.output && (
                                        <pre className="text-gray-400 whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed">
                                            {log.output}
                                        </pre>
                                    )}
                                    {log.error && (
                                        <pre className="text-red-400/90 whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed">
                                            {log.error}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    ))}
                    <div ref={logsEndRef} className="h-4" />
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
          ) : (
              <DeviceStatus deviceId={selectedDeviceId} />
          )}
      </div>
    </main>
  );
}