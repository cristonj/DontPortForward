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
  limit
} from "firebase/firestore";
import DeviceList from "./components/DeviceList";

interface CommandLog {
  id: string;
  command: string;
  output?: string;
  error?: string;
  status: 'pending' | 'processing' | 'completed';
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

  return (
    <main className="flex h-screen bg-gray-950 text-gray-200 font-mono overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
         <DeviceList 
            onSelectDevice={handleDeviceSelect} 
            selectedDeviceId={selectedDeviceId}
            className="h-full shadow-xl md:shadow-none" 
         />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
          {/* Header */}
          <div className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between shrink-0 gap-4">
            <div className="flex items-center gap-4">
                {/* Hamburger Menu */}
                <button 
                    className="md:hidden text-gray-400 hover:text-white"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <h1 className="font-bold text-lg hidden sm:block">DontPortForward Console</h1>
                <h1 className="font-bold text-lg sm:hidden">DPF Console</h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400 truncate max-w-[150px] sm:max-w-none">
                    {selectedDeviceId ? <span className="hidden sm:inline">Target: {selectedDeviceId}</span> : "No Device"}
                    {selectedDeviceId && <span className="sm:hidden">{selectedDeviceId.substring(0, 8)}...</span>}
                </div>
                {selectedDeviceId && (
                    <button
                        onClick={handleRestart}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded border border-red-900/50 transition-colors whitespace-nowrap"
                        title="Restart Agent Process"
                    >
                        Restart
                    </button>
                )}
            </div>
          </div>

          {/* Terminal Output */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-800">
            {!selectedDeviceId && (
                 <div className="text-gray-500 italic text-center mt-10">
                 Select a device to start.
               </div>
            )}
            
            {selectedDeviceId && logs.length === 0 && (
              <div className="text-gray-500 italic text-center mt-10">
                No history. Send a command to start.
              </div>
            )}
            
            {logs.map((log) => (
              <div key={log.id} className="space-y-1 group break-words">
                <div className="flex items-center gap-2 text-blue-400 flex-wrap">
                  <span className="text-gray-500 opacity-50 shrink-0">$</span>
                  <span className="break-all">{log.command}</span>
                  {log.status === 'pending' && <span className="text-xs text-yellow-500 animate-pulse shrink-0">[pending]</span>}
                  {log.status === 'processing' && <span className="text-xs text-blue-500 animate-pulse shrink-0">[running...]</span>}
                </div>
                
                {log.output && (
                  <pre className="text-gray-300 whitespace-pre-wrap pl-4 border-l-2 border-gray-800 text-sm overflow-x-auto max-w-full">
                    {log.output}
                  </pre>
                )}
                
                {log.error && (
                  <pre className="text-red-400 whitespace-pre-wrap pl-4 border-l-2 border-red-900/50 text-sm overflow-x-auto max-w-full">
                    {log.error}
                  </pre>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-gray-900 p-4 border-t border-gray-800 shrink-0 relative">
            
            {/* Suggestions Popup */}
            {showSuggestions && (
                <div className="absolute bottom-full left-4 mb-2 bg-gray-800 border border-gray-700 rounded shadow-lg overflow-hidden w-64 max-h-48 overflow-y-auto z-10">
                    {suggestions.map((suggestion, index) => (
                        <div 
                            key={suggestion}
                            className={`px-4 py-2 cursor-pointer text-sm hover:bg-gray-700 ${index === suggestionIndex ? 'bg-gray-700 text-white' : 'text-gray-300'}`}
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

            <form onSubmit={sendCommand} className="flex gap-2">
              <span className="text-green-500 py-2 font-bold">{'>'}</span>
              <input
                type="text"
                value={inputCommand}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 font-mono disabled:opacity-50 min-w-0"
                placeholder="Enter command..."
                autoFocus
                disabled={!selectedDeviceId}
              />
              <button 
                type="submit"
                disabled={!inputCommand.trim() || !selectedDeviceId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Send
              </button>
            </form>
          </div>
      </div>
    </main>
  );
}
