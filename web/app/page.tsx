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

export default function Home() {
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [inputCommand, setInputCommand] = useState("");
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load selected device ID from local storage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("selectedDeviceId");
    if (savedId) setSelectedDeviceId(savedId);
  }, []);

  const handleDeviceSelect = (id: string) => {
      setSelectedDeviceId(id);
      localStorage.setItem("selectedDeviceId", id);
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
    <main className="flex h-screen bg-gray-950 text-gray-200 font-mono overflow-hidden">
      <DeviceList onSelectDevice={handleDeviceSelect} selectedDeviceId={selectedDeviceId} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between shrink-0">
            <h1 className="font-bold text-lg">DontPortForward Console</h1>
            <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                    {selectedDeviceId ? `Target: ${selectedDeviceId}` : "No Device Selected"}
                </div>
                {selectedDeviceId && (
                    <button
                        onClick={handleRestart}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded border border-red-900/50 transition-colors"
                        title="Restart Agent Process"
                    >
                        Restart Agent
                    </button>
                )}
            </div>
          </div>

          {/* Terminal Output */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!selectedDeviceId && (
                 <div className="text-gray-500 italic text-center mt-10">
                 Select a device from the list to start managing it.
               </div>
            )}
            
            {selectedDeviceId && logs.length === 0 && (
              <div className="text-gray-500 italic text-center mt-10">
                No history. Send a command to start.
              </div>
            )}
            
            {logs.map((log) => (
              <div key={log.id} className="space-y-1 group">
                <div className="flex items-center gap-2 text-blue-400">
                  <span className="text-gray-500 opacity-50">$</span>
                  <span>{log.command}</span>
                  {log.status === 'pending' && <span className="text-xs text-yellow-500 animate-pulse">[pending]</span>}
                  {log.status === 'processing' && <span className="text-xs text-blue-500 animate-pulse">[running...]</span>}
                </div>
                
                {log.output && (
                  <pre className="text-gray-300 whitespace-pre-wrap pl-4 border-l-2 border-gray-800 text-sm">
                    {log.output}
                  </pre>
                )}
                
                {log.error && (
                  <pre className="text-red-400 whitespace-pre-wrap pl-4 border-l-2 border-red-900/50 text-sm">
                    {log.error}
                  </pre>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-gray-900 p-4 border-t border-gray-800 shrink-0">
            <form onSubmit={sendCommand} className="flex gap-2">
              <span className="text-green-500 py-2 font-bold">{'>'}</span>
              <input
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 font-mono disabled:opacity-50"
                placeholder="Enter command (e.g., ls -la, whoami)..."
                autoFocus
                disabled={!selectedDeviceId}
              />
              <button 
                type="submit"
                disabled={!inputCommand.trim() || !selectedDeviceId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-semibold transition-colors"
              >
                Send
              </button>
            </form>
          </div>
      </div>
    </main>
  );
}
