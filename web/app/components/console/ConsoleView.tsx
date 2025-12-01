"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../../lib/firebase";
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
import { User } from "firebase/auth";
import ConsoleToolbar from "./ConsoleToolbar";
import ActiveCommandCard from "./ActiveCommandCard";
import HistoryCommandItem from "./HistoryCommandItem";
import CommandInput from "./CommandInput";
import { CommandLog } from "../../types/command";

interface ConsoleViewProps {
  deviceId: string;
  user: User;
}

export default function ConsoleView({ deviceId, user }: ConsoleViewProps) {
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);
  const [autoPollingEnabled, setAutoPollingEnabled] = useState(false);
  const [isRequestingOutput, setIsRequestingOutput] = useState(false);

  // Listen for command logs
  useEffect(() => {
    if (!deviceId || !user) {
      setLogs([]);
      return;
    }

    const commandsRef = collection(db, "devices", deviceId, "commands");
    const q = query(commandsRef, orderBy("created_at", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs: CommandLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CommandLog));
      setLogs(newLogs);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.debug("Logs permission denied (possibly logged out)");
      } else {
        console.error("Error fetching logs:", error);
      }
    });

    return () => unsubscribe();
  }, [deviceId, user]);

  // Auto-polling for active commands
  useEffect(() => {
    if (!deviceId || !user || !autoPollingEnabled) return;

    let consecutiveErrors = 0;
    let isPollingEnabled = true;
    let isPageVisible = true;

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const autoRequestOutput = async () => {
      if (!isPollingEnabled || !isPageVisible) return;
      
      const activeLogs = logs.filter(log => ['pending', 'processing'].includes(log.status));
      if (activeLogs.length === 0) return;
      
      const logsToUpdate = activeLogs.slice(0, 2);
      
      for (const log of logsToUpdate) {
        const needsUpdate = !log.output || 
          (log.last_activity && log.last_activity.toMillis && Date.now() - log.last_activity.toMillis() > 30000);
        
        if (needsUpdate) {
          try {
            const commandRef = doc(db, "devices", deviceId, "commands", log.id);
            await updateDoc(commandRef, {
              output_request: {
                seconds: 60,
                request_id: `${Date.now()}-${Math.random()}`
              }
            });
            consecutiveErrors = 0;
          } catch (error: unknown) {
            consecutiveErrors++;
            console.debug("Could not request output:", error);
            
            if (consecutiveErrors > 5) {
              console.warn("Multiple polling errors detected - reducing poll frequency");
              setShowConnectionWarning(true);
              isPollingEnabled = false;
              setTimeout(() => { 
                isPollingEnabled = true;
                setShowConnectionWarning(false);
              }, 60000);
            }
          }
        }
      }
    };

    const interval = setInterval(autoRequestOutput, 30000);
    autoRequestOutput();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [deviceId, user, logs, autoPollingEnabled]);

  const requestOutputForActiveCommands = useCallback(async () => {
    if (!deviceId || !user) return;
    
    setIsRequestingOutput(true);
    try {
      const activeLogs = logs.filter(log => ['pending', 'processing'].includes(log.status));
      if (activeLogs.length === 0) {
        setIsRequestingOutput(false);
        return;
      }
      
      const requests = activeLogs.map(async (log) => {
        try {
          const commandRef = doc(db, "devices", deviceId, "commands", log.id);
          await updateDoc(commandRef, {
            output_request: {
              seconds: 60,
              request_id: `${Date.now()}-${Math.random()}`
            }
          });
        } catch (error) {
          console.debug("Could not request output for command:", log.id, error);
        }
      });
      
      await Promise.all(requests);
    } finally {
      setIsRequestingOutput(false);
    }
  }, [deviceId, user, logs]);

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || !deviceId) return;

    try {
      const commandsRef = collection(db, "devices", deviceId, "commands");
      await addDoc(commandsRef, {
        command,
        type: 'shell',
        status: 'pending',
        created_at: serverTimestamp()
      });
      setErrorMsg("");
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Error sending command:", error);
      setErrorMsg(`Error: ${err?.message || "Failed to send command"}`);
    }
  }, [deviceId]);

  const killCommand = useCallback(async (cmdId: string) => {
    if (!deviceId) return;
    try {
      const commandRef = doc(db, "devices", deviceId, "commands", cmdId);
      await updateDoc(commandRef, { kill_signal: true });
    } catch (error) {
      console.error("Error killing command:", error);
    }
  }, [deviceId]);

  const deleteCommand = useCallback(async (logId: string, isActive: boolean = false) => {
    if (!deviceId) return;
    
    const log = logs.find(l => l.id === logId);
    const commandText = log?.command || 'this task';
    const confirmMessage = isActive 
      ? `Are you sure you want to delete the active task "${commandText}"?`
      : `Are you sure you want to delete "${commandText}"?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      await deleteDoc(doc(db, "devices", deviceId, "commands", logId));
    } catch (error) {
      console.error("Error deleting command:", error);
    }
  }, [deviceId, logs]);

  const runningLogs = useMemo(() => 
    logs.filter(log => ['pending', 'processing'].includes(log.status)), 
    [logs]
  );
  
  const historyLogs = useMemo(() => 
    logs.filter(log => !['pending', 'processing'].includes(log.status)), 
    [logs]
  );

  const handleClearHistory = useCallback(async () => {
    if (!deviceId || historyLogs.length === 0) return;
    if (!confirm("Clear terminal history? This cannot be undone.")) return;

    try {
      const batch = writeBatch(db);
      historyLogs.forEach(log => {
        const docRef = doc(db, "devices", deviceId, "commands", log.id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Error clearing history:", error);
      alert(`Failed to clear history: ${err?.message || 'Network error'}`);
    }
  }, [deviceId, historyLogs]);

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

  const manualRefresh = useCallback(async () => {
    if (!deviceId || !user) return;
    setIsRefreshing(true);
    
    try {
      const commandsRef = collection(db, "devices", deviceId, "commands");
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
  }, [deviceId, user]);

  const getLastLines = useCallback((text: string | undefined, maxLines: number = 10): string => {
    if (!text) return '';
    const lines = text.split('\n');
    if (lines.length <= maxLines) return text;
    return lines.slice(-maxLines).join('\n');
  }, []);

  return (
    <div className="console-view flex flex-col flex-1 min-h-0">
      {/* Error Banner */}
      {errorMsg && (
        <div className="console-error-banner bg-red-500/10 border-b border-red-500/40 text-red-400 px-4 py-2.5 text-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={() => setErrorMsg("")}
            className="text-red-400 hover:text-red-300 ml-4 p-1 rounded hover:bg-red-500/10 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Connection Warning */}
      {showConnectionWarning && (
        <div className="console-warning-banner bg-amber-500/10 border-b border-amber-500/40 text-amber-400 px-4 py-2.5 text-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Connection issues detected. Updates temporarily reduced.</span>
          </div>
          <button 
            onClick={() => setShowConnectionWarning(false)}
            className="text-amber-400 hover:text-amber-300 ml-4 p-1 rounded hover:bg-amber-500/10 transition-colors shrink-0"
            aria-label="Dismiss warning"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Terminal Output */}
      <div className="console-output flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin font-mono text-sm">
        <div className="space-y-6">
          <ConsoleToolbar
            runningCount={runningLogs.length}
            onRequestOutput={requestOutputForActiveCommands}
            isRequesting={isRequestingOutput}
            onRefresh={manualRefresh}
            isRefreshing={isRefreshing}
            autoPollingEnabled={autoPollingEnabled}
            onToggleAutoPolling={() => setAutoPollingEnabled(!autoPollingEnabled)}
            className="-mx-3 sm:-mx-4"
          />

          {logs.length === 0 && (
            <div className="console-empty-state h-64 flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center shadow-xl">
                <svg className="w-8 h-8 text-terminal-accent/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-gray-400 font-medium">Ready for commands</p>
                <p className="text-gray-600 text-xs mt-1">Type a command below to get started</p>
              </div>
            </div>
          )}
          
          {/* Running Processes Section */}
          {runningLogs.length > 0 && (
            <section className="console-active-section space-y-3 pb-2">
              <div className="console-section-header bg-gray-950/80 backdrop-blur-sm py-2 -mt-2 border-b border-terminal-accent/20">
                <h3 className="text-xs uppercase tracking-wider text-terminal-accent font-bold flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-terminal-accent"></span>
                  </span>
                  Active Processes ({runningLogs.length})
                  <span className="ml-auto text-[10px] text-terminal-accent/50 normal-case tracking-normal font-normal">Real-time updates</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {runningLogs.map(log => (
                  <ActiveCommandCard
                    key={log.id}
                    log={log}
                    onKill={killCommand}
                    onDelete={(id) => deleteCommand(id, true)}
                    getLastLines={getLastLines}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent History Section */}
          {historyLogs.length > 0 && (
            <section className="console-history-section space-y-3 pt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                  Recent History
                </h3>
                <button
                  onClick={handleClearHistory}
                  className="console-clear-btn text-[10px] text-gray-500 hover:text-red-400 uppercase tracking-wider transition-colors flex items-center gap-1 hover:bg-red-500/10 px-2 py-1 rounded"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                {historyLogs.map(log => (
                  <HistoryCommandItem
                    key={log.id}
                    log={log}
                    isExpanded={expandedLogs.has(log.id)}
                    onToggle={toggleLogExpansion}
                    onDelete={(id) => deleteCommand(id, false)}
                    onRunAgain={sendCommand}
                    getLastLines={getLastLines}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Command Input Area */}
      <div className="console-input-container bg-gray-900/80 backdrop-blur-sm p-3 border-t border-gray-800/60 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <CommandInput 
          onSubmit={sendCommand}
          disabled={!deviceId}
          placeholder={""}
        />
      </div>
    </div>
  );
}

