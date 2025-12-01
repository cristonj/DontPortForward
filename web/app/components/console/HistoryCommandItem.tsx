"use client";

import SwipeToDeleteLogItem from "../SwipeToDeleteLogItem";
import LogOutput from "../LogOutput";
import { CommandLog } from "../../types/command";

interface HistoryCommandItemProps {
  log: CommandLog;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRunAgain: (command: string) => void;
  getLastLines: (text: string | undefined, maxLines?: number) => string;
}

export default function HistoryCommandItem({
  log,
  isExpanded,
  onToggle,
  onDelete,
  onRunAgain,
  getLastLines,
}: HistoryCommandItemProps) {
  const statusColor = log.status === "completed" 
    ? "bg-terminal-success" 
    : "bg-terminal-error";

  return (
    <SwipeToDeleteLogItem
      onDelete={() => onDelete(log.id)}
      onClick={() => onToggle(log.id)}
      isExpanded={isExpanded}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusColor} opacity-60`} />
        
        <div className="flex-1 min-w-0">
          {/* Command header */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-terminal-accent/60 font-bold shrink-0">$</span>
              <span className="font-mono text-sm text-gray-300 break-all -mt-2">{log.command}</span>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Rerun button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRunAgain(log.command);
                }}
                className="text-gray-500 hover:text-terminal-accent p-1.5 rounded-lg hover:bg-terminal-accent/10 transition-colors"
                title="Run again"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              {/* Status badge */}
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                log.status === 'completed' 
                  ? 'text-terminal-success/70 bg-terminal-success/10' 
                  : 'text-terminal-error/70 bg-terminal-error/10'
              }`}>
                {log.status}
              </span>
              
              {/* Expand chevron */}
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Output preview/full */}
          {(log.output || log.error) && (
            <div
              className={`mt-2 font-mono transition-all duration-200 ${
                isExpanded
                  ? "text-xs bg-black/40 p-3 rounded-lg border border-gray-800/50 max-h-96 overflow-y-auto scrollbar-thin"
                  : "text-xs line-clamp-2 pl-3 border-l-2 border-gray-800 text-gray-500"
              }`}
            >
              {isExpanded ? (
                <div className="space-y-3">
                  {log.output && (
                    <div>
                      <div className="text-terminal-accent/60 text-[10px] mb-1.5 uppercase tracking-wider font-semibold">
                        Output
                      </div>
                      <LogOutput text={getLastLines(log.output, 10)} />
                    </div>
                  )}
                  {log.error && (
                    <div>
                      <div className="text-terminal-error/60 text-[10px] mb-1.5 uppercase tracking-wider font-semibold">
                        Error
                      </div>
                      <LogOutput text={getLastLines(log.error, 10)} isError />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {log.output && <span>{log.output.substring(0, 150)}</span>}
                  {log.error && (
                    <span className="text-terminal-error/70 block mt-1">{log.error.substring(0, 150)}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </SwipeToDeleteLogItem>
  );
}
