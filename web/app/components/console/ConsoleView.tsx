"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db } from "../../../lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  limit,
  doc,
  updateDoc,
  writeBatch,
  deleteDoc,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { User } from "firebase/auth";
import ConsoleToolbar from "./ConsoleToolbar";
import ActiveCommandCard from "./ActiveCommandCard";
import HistoryCommandItem from "./HistoryCommandItem";
import CommandInput from "./CommandInput";
import { CommandLog } from "../../types/command";
import { ErrorIcon, CloseIcon, TerminalIcon, TrashIcon } from "../Icons";
import { PulsingDot } from "../ui";
import {
  COMMAND_TYPE_SHELL,
  COMMAND_STATUS_PENDING,
  ACTIVE_COMMAND_STATUSES,
  getCommandsCollectionPath,
  getCommandDocumentPath,
  CONSOLE_OUTPUT_REQUEST_TIMEOUT_SECONDS,
  CONSOLE_HISTORY_LIMIT,
  CONSOLE_REFRESH_DELAY_MS
} from "../../constants";
import { getLastLines } from "../../utils";

// Prefix for optimistic command IDs to distinguish them from real Firestore IDs
const OPTIMISTIC_ID_PREFIX = "__optimistic__";

interface ConsoleViewProps {
  deviceId: string;
  user: User;
}

export default function ConsoleView({ deviceId, user }: ConsoleViewProps) {
  const [serverLogs, setServerLogs] = useState<CommandLog[]>([]);
  const [optimisticCommands, setOptimisticCommands] = useState<CommandLog[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [isRequestingOutput, setIsRequestingOutput] = useState(false);
  
  // Track pending optimistic command texts to match against server responses
  const pendingCommandsRef = useRef<Map<string, string>>(new Map());
  
  // Merge server logs with optimistic commands, removing optimistic ones that have been confirmed
  const logs = useMemo(() => {
    // Filter out optimistic commands that have matching server entries
    // (meaning the server has confirmed them)
    const unconfirmedOptimistic = optimisticCommands.filter(opt => {
      // Check if this optimistic command's text matches any recent server command
      const matchingServerLog = serverLogs.find(
        serverLog => serverLog.command === opt.command && 
        ACTIVE_COMMAND_STATUSES.includes(serverLog.status)
      );
      // If there's a matching server log, remove the optimistic one
      if (matchingServerLog) {
        pendingCommandsRef.current.delete(opt.id);
        return false;
      }
      return true;
    });
    
    // Combine: optimistic first (they're the most recent), then server logs
    return [...unconfirmedOptimistic, ...serverLogs];
  }, [serverLogs, optimisticCommands]);

  // Single fetch - no continuous listening, only reads when needed
  const fetchLogs = useCallback(async (requestOutput = false) => {
    if (!deviceId || !user) return;
    
    try {
      const commandsRef = collection(db, ...getCommandsCollectionPath(deviceId));
      const q = query(commandsRef, orderBy("created_at", "desc"), limit(CONSOLE_HISTORY_LIMIT));
      const snapshot = await getDocs(q);
      
      const newLogs: CommandLog[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as CommandLog));
      
      setServerLogs(newLogs);
      
      // Clean up optimistic commands that are now on server
      setOptimisticCommands(prev => {
        if (prev.length === 0) return prev;
        return prev.filter(opt => {
          const hasMatch = newLogs.some(
            serverLog => serverLog.command === opt.command && 
            ACTIVE_COMMAND_STATUSES.includes(serverLog.status)
          );
          return !hasMatch;
        });
      });
      
      // Request output for active commands if requested
      if (requestOutput) {
        const activeLogs = newLogs.filter(log => ACTIVE_COMMAND_STATUSES.includes(log.status));
        if (activeLogs.length > 0) {
          // Fire and forget - don't await, agent will update and we'll see it on next fetch
          Promise.all(activeLogs.map(log => 
            updateDoc(doc(db, ...getCommandDocumentPath(deviceId, log.id)), {
              output_request: {
                seconds: CONSOLE_OUTPUT_REQUEST_TIMEOUT_SECONDS,
                request_id: `${Date.now()}-${Math.random()}`
              }
            }).catch(() => {})
          ));
        }
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }, [deviceId, user]);

  // Fetch on mount and when page becomes visible
  useEffect(() => {
    if (!deviceId || !user) {
      setServerLogs([]);
      setOptimisticCommands([]);
      return;
    }

    // Initial fetch with output request
    fetchLogs(true);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page visible - fetch and request output
        fetchLogs(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [deviceId, user, fetchLogs]);

  const requestOutputForActiveCommands = useCallback(async () => {
    if (!deviceId || !user) return;
    
    setIsRequestingOutput(true);
    try {
      // Request output and fetch in one go
      await fetchLogs(true);
      // Fetch again after agent has time to respond
      setTimeout(() => fetchLogs(false), 1000);
    } finally {
      setIsRequestingOutput(false);
    }
  }, [deviceId, user, fetchLogs]);

  const sendCommand = useCallback((command: string) => {
    if (!command.trim() || !deviceId) return;
    
    // Generate optimistic ID and create optimistic command immediately
    const optimisticId = `${OPTIMISTIC_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimisticCommand: CommandLog = {
      id: optimisticId,
      command: command.trim(),
      status: COMMAND_STATUS_PENDING,
      created_at: Timestamp.now(),
    };
    
    // Add to optimistic commands immediately (instant UI feedback)
    setOptimisticCommands(prev => [optimisticCommand, ...prev]);
    pendingCommandsRef.current.set(optimisticId, command.trim());
    setErrorMsg("");
    
    // Fire and forget - send to Firestore in background
    const commandsRef = collection(db, ...getCommandsCollectionPath(deviceId));
    addDoc(commandsRef, {
      command: command.trim(),
      type: COMMAND_TYPE_SHELL,
      status: COMMAND_STATUS_PENDING,
      created_at: serverTimestamp()
    }).then(() => {
      // Fetch after a short delay to see the command on server
      setTimeout(() => fetchLogs(false), 500);
    }).catch((error: unknown) => {
      // On error, remove the optimistic command and show error
      const err = error as { message?: string };
      console.error("Error sending command:", error);
      setOptimisticCommands(prev => prev.filter(c => c.id !== optimisticId));
      pendingCommandsRef.current.delete(optimisticId);
      setErrorMsg(`Error: ${err?.message || "Failed to send command"}`);
    });
  }, [deviceId, fetchLogs]);

  const killCommand = useCallback(async (cmdId: string) => {
    if (!deviceId) return;
    // Can't kill optimistic commands that haven't been sent yet
    if (cmdId.startsWith(OPTIMISTIC_ID_PREFIX)) return;
    try {
      const commandRef = doc(db, ...getCommandDocumentPath(deviceId, cmdId));
      await updateDoc(commandRef, { kill_signal: true });
    } catch (error) {
      console.error("Error killing command:", error);
    }
  }, [deviceId]);

  const deleteCommand = useCallback(async (logId: string, isActive: boolean = false) => {
    if (!deviceId) return;
    
    // For optimistic commands, just remove from local state
    if (logId.startsWith(OPTIMISTIC_ID_PREFIX)) {
      setOptimisticCommands(prev => prev.filter(c => c.id !== logId));
      pendingCommandsRef.current.delete(logId);
      return;
    }
    
    const log = logs.find(l => l.id === logId);
    const commandText = log?.command || 'this task';
    const confirmMessage = isActive 
      ? `Are you sure you want to delete the active task "${commandText}"?`
      : `Are you sure you want to delete "${commandText}"?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      await deleteDoc(doc(db, ...getCommandDocumentPath(deviceId, logId)));
    } catch (error) {
      console.error("Error deleting command:", error);
    }
  }, [deviceId, logs]);

  const runningLogs = useMemo(() => 
    logs.filter(log => ACTIVE_COMMAND_STATUSES.includes(log.status)), 
    [logs]
  );
  
  const historyLogs = useMemo(() => 
    logs.filter(log => !ACTIVE_COMMAND_STATUSES.includes(log.status)), 
    [logs]
  );

  const handleClearHistory = useCallback(async () => {
    if (!deviceId || historyLogs.length === 0) return;
    if (!confirm("Clear terminal history? This cannot be undone.")) return;

    try {
      const batch = writeBatch(db);
      historyLogs.forEach(log => {
        const docRef = doc(db, ...getCommandDocumentPath(deviceId, log.id));
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
      await fetchLogs(true);
      // Fetch again after agent responds
      setTimeout(() => fetchLogs(false), 1000);
    } finally {
      setTimeout(() => setIsRefreshing(false), CONSOLE_REFRESH_DELAY_MS);
    }
  }, [deviceId, user, fetchLogs]);

  return (
    <div className="console-view flex flex-col flex-1 min-h-0">
      {/* Error Banner */}
      {errorMsg && (
        <div className="console-error-banner bg-terminal-error/10 border-b border-terminal-error/40 text-terminal-error px-4 py-2.5 text-sm flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <ErrorIcon className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={() => setErrorMsg("")}
            className="text-terminal-error hover:text-terminal-error/80 ml-4 p-1 rounded hover:bg-terminal-error/10 transition-colors"
            aria-label="Dismiss error"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Terminal Output */}
      <div className="console-output flex-1 overflow-y-auto scrollbar-thin font-mono text-sm">
          <ConsoleToolbar
            runningCount={runningLogs.length}
            onRequestOutput={requestOutputForActiveCommands}
            isRequesting={isRequestingOutput}
            onRefresh={manualRefresh}
            isRefreshing={isRefreshing}
          />
        <div className="space-y-6 p-3 sm:p-4">

          {logs.length === 0 && (
            <div className="console-empty-state h-64 flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center shadow-xl">
                <TerminalIcon className="w-8 h-8 text-terminal-accent/60" />
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
                  <PulsingDot size="md" color="accent" />
                  Active Processes ({runningLogs.length})
                  <span className="ml-auto text-[10px] text-terminal-accent/50 normal-case tracking-normal font-normal">Real-time updates</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {runningLogs.map(log => (
                  <ActiveCommandCard
                    key={log.id}
                    log={log}
                    isExpanded={expandedLogs.has(log.id)}
                    onToggle={toggleLogExpansion}
                    onKill={killCommand}
                    onDelete={(id) => deleteCommand(id, true)}
                    getLastLines={getLastLines}
                    isOptimistic={log.id.startsWith(OPTIMISTIC_ID_PREFIX)}
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
                  className="console-clear-btn text-[10px] text-gray-500 hover:text-terminal-error uppercase tracking-wider transition-colors flex items-center gap-1 hover:bg-terminal-error/10 px-2 py-1 rounded"
                >
                  <TrashIcon className="w-3 h-3" />
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
          userId={user?.uid || null}
        />
      </div>
    </div>
  );
}

