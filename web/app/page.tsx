"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc,
  limit
} from "firebase/firestore";

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
  const [deviceId, setDeviceId] = useState("default-device");
  const [inputCommand, setInputCommand] = useState("");
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load device ID from local storage on mount
  useEffect(() => {
    const savedId = localStorage.getItem("deviceId");
    if (savedId) setDeviceId(savedId);
  }, []);

  // Save device ID to local storage when changed
  const handleDeviceIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newId = e.target.value;
    setDeviceId(newId);
    localStorage.setItem("deviceId", newId);
  };

  // Listen for logs
  useEffect(() => {
    if (!deviceId) return;

    // Reference to the commands subcollection for this device
    const commandsRef = collection(db, "devices", deviceId, "commands");
    const q = query(commandsRef, orderBy("created_at", "asc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsConnected(true);
      const newLogs: CommandLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CommandLog));
      setLogs(newLogs);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setIsConnected(false);
    });

    return () => unsubscribe();
  }, [deviceId]);

  // Scroll to bottom on new logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const sendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim() || !deviceId) return;

    try {
      const commandsRef = collection(db, "devices", deviceId, "commands");
      await addDoc(commandsRef, {
        command: inputCommand,
        status: 'pending',
        created_at: serverTimestamp()
      });
      setInputCommand("");
    } catch (error) {
      console.error("Error sending command:", error);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gray-950 text-gray-200 font-mono">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <h1 className="font-bold text-lg">DontPortForward Console</h1>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="deviceId" className="text-sm text-gray-400">Target Device:</label>
          <input 
            id="deviceId"
            type="text" 
            value={deviceId}
            onChange={handleDeviceIdChange}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Enter Device ID"
          />
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 && (
          <div className="text-gray-500 italic text-center mt-10">
            No history. Send a command to start.
            <br/>
            Make sure the python agent is running with Device ID: <span className="text-white font-bold">{deviceId}</span>
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
      <div className="bg-gray-900 p-4 border-t border-gray-800">
        <form onSubmit={sendCommand} className="flex gap-2">
          <span className="text-green-500 py-2 font-bold">{'>'}</span>
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 font-mono"
            placeholder="Enter command (e.g., ls -la, whoami)..."
            autoFocus
          />
          <button 
            type="submit"
            disabled={!inputCommand.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-semibold transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
