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
  return (
    <SwipeToDeleteLogItem
      onDelete={() => onDelete(log.id)}
      onClick={() => onToggle(log.id)}
      isExpanded={isExpanded}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
            log.status === "completed" ? "bg-green-500/50" : "bg-red-500/50"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-sm text-gray-300 break-all">{log.command}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRunAgain(log.command);
                }}
                className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
                title="Rerun"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">{log.status}</span>
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {(log.output || log.error) && (
            <div
              className={`mt-2 font-mono ${
                isExpanded
                  ? "text-xs bg-black/30 p-3 rounded border border-gray-800/50 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-900/50"
                  : "text-xs line-clamp-2 pl-2 border-l-2 border-gray-800 text-gray-500"
              }`}
              style={isExpanded ? { scrollBehavior: "smooth" } : undefined}
            >
              {isExpanded ? (
                <div className="space-y-2">
                  {log.output && (
                    <div>
                      <div className="text-blue-400/60 text-[10px] mb-1 uppercase tracking-wider">
                        Output (Last 10 lines)
                      </div>
                      <LogOutput text={getLastLines(log.output, 10)} />
                    </div>
                  )}
                  {log.error && (
                    <div>
                      <div className="text-red-400/60 text-[10px] mb-1 uppercase tracking-wider">Error</div>
                      <LogOutput text={getLastLines(log.error, 10)} isError />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {log.output && <span>{log.output.substring(0, 150)}</span>}
                  {log.error && (
                    <span className="text-red-500/70 block mt-1">{log.error.substring(0, 150)}</span>
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

