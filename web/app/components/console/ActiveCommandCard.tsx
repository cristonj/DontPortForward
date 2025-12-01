"use client";

import LogOutput from "../LogOutput";
import { CommandLog } from "../../types/command";

interface ActiveCommandCardProps {
  log: CommandLog;
  onKill: (id: string) => void;
  onDelete: (id: string) => void;
  getLastLines: (text: string | undefined, maxLines?: number) => string;
}

export default function ActiveCommandCard({ log, onKill, onDelete, getLastLines }: ActiveCommandCardProps) {
  return (
    <div className="active-command-card rounded-xl p-4 shadow-xl backdrop-blur-sm relative group overflow-hidden">
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-terminal-accent/0 via-terminal-accent/10 to-terminal-accent/0" />
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex flex-col flex-1 min-w-0">
          {/* Command text */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-terminal-accent font-bold shrink-0">$</span>
            <span className="font-bold text-white text-base break-all leading-relaxed">
              {log.command}
            </span>
          </div>
          
          {/* Metadata */}
          <div className="text-xs text-gray-500 font-mono flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-900/60 border border-gray-800/50">
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              <span className="text-gray-400">{log.id.substring(0, 8)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-terminal-accent"></span>
              </span>
              <span className="uppercase text-terminal-accent font-semibold tracking-wide">{log.status}</span>
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="ml-4 flex items-center gap-2 shrink-0">
          <button
            onClick={() => onKill(log.id)}
            className="group/btn relative px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all duration-200 flex items-center gap-2 hover:shadow-lg hover:shadow-red-900/20"
          >
            <span className="w-2 h-2 bg-red-500 rounded-sm animate-pulse group-hover/btn:animate-none" />
            <span>Kill</span>
          </button>
          <button
            onClick={() => onDelete(log.id)}
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-all duration-200"
            title="Delete task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Output area */}
      <div className="active-command-output rounded-lg p-3 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {log.output || log.error ? (
          <div className="space-y-3">
            {log.output && (
              <div>
                <div className="text-terminal-accent/70 text-[10px] mb-2 uppercase tracking-wider font-bold flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Output (Last 10 lines)
                </div>
                <LogOutput text={getLastLines(log.output, 10)} />
              </div>
            )}
            {log.error && (
              <div>
                <div className="text-red-400/70 text-[10px] mb-2 uppercase tracking-wider font-bold flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Error
                </div>
                <LogOutput text={getLastLines(log.error, 10)} isError />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-28">
            <div className="text-center">
              <div className="relative inline-flex mb-3">
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-terminal-accent/40" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-terminal-accent" />
              </div>
              <div className="text-gray-500 text-xs">Waiting for output...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
