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
    <div className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-blue-500/30 rounded-lg p-4 shadow-xl backdrop-blur-sm relative group overflow-hidden">
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0" />
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
            onClick={() => onKill(log.id)}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
          >
            <span className="w-2 h-2 bg-red-500 rounded-sm animate-pulse" />
            Kill
          </button>
          <button
            onClick={() => onDelete(log.id)}
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

      <div
        className="bg-black/50 rounded p-3 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-900/50 border border-gray-800/50"
        style={{ scrollBehavior: "smooth" }}
      >
        {log.output || log.error ? (
          <div className="space-y-2">
            {log.output && (
              <div>
                <div className="text-blue-400/60 text-[10px] mb-1 uppercase tracking-wider">Output (Last 10 lines)</div>
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
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-pulse mb-2" />
              <div className="text-gray-500 italic text-xs">Waiting for output...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

