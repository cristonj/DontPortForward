"use client";

import LogOutput from "../LogOutput";
import { CommandLog } from "../../types/command";
import { TrashIcon, ChevronDownIcon, CheckCircleIcon, ErrorIcon } from "../Icons";
import { PulsingDot, CommandIdBadge } from "../ui";

interface ActiveCommandCardProps {
  log: CommandLog;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onKill: (id: string) => void;
  onDelete: (id: string) => void;
  getLastLines: (text: string | undefined, maxLines?: number) => string;
}

export default function ActiveCommandCard({ log, isExpanded, onToggle, onKill, onDelete, getLastLines }: ActiveCommandCardProps) {
  return (
    <div className="active-command-card rounded-xl p-4 shadow-xl backdrop-blur-sm relative group overflow-hidden">
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-terminal-accent/0 via-terminal-accent/10 to-terminal-accent/0" />
      </div>

      {/* Header */}
      <div 
        className="flex justify-between items-start mb-2 relative z-10 cursor-pointer -mt-4"
        onClick={() => onToggle(log.id)}
      >
        <div className="flex flex-col flex-1 min-w-0">
          {/* Command text */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-terminal-accent font-bold shrink-0">$</span>
            <span className="font-bold text-white text-base leading-relaxed -mt-1.5 truncate" title={log.command}>
              {log.command.length > 150 ? `${log.command.substring(0, 150)}...` : log.command}
            </span>
          </div>
          
          {/* Metadata */}
          <div className="text-xs text-gray-500 font-mono flex items-center gap-3 flex-wrap">
            <CommandIdBadge id={log.id} />
            <span className="inline-flex items-center gap-1.5">
              <PulsingDot size="sm" color="accent" />
              <span className="uppercase text-terminal-accent font-semibold tracking-wide">{log.status}</span>
            </span>
          </div>
        </div>

        {/* Action buttons & expand toggle */}
        <div className="ml-4 flex items-center gap-2 shrink-0 mt-0 z-50">
          <button
            onClick={(e) => { e.stopPropagation(); onKill(log.id); }}
            className="group/btn relative px-3 py-1.5 bg-terminal-error/10 hover:bg-terminal-error/20 text-terminal-error text-xs font-medium rounded-lg border border-terminal-error/30 hover:border-terminal-error/50 transition-all duration-200 flex items-center gap-2 hover:shadow-lg hover:shadow-terminal-error/20"
          >
            <span className="w-2 h-2 bg-terminal-error rounded-sm animate-pulse group-hover/btn:animate-none" />
            <span>Kill</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(log.id); }}
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-all duration-200"
            title="Delete task"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          {/* Expand chevron */}
          <ChevronDownIcon 
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Output area */}
      <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? "mt-4" : "mt-2"}`}>
        {isExpanded ? (
          <div className="active-command-output rounded-lg p-3 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin">
            {log.output || log.error ? (
              <div className="space-y-3">
                {log.output && (
                  <div>
                    <div className="text-terminal-accent/70 text-[10px] mb-2 uppercase tracking-wider font-bold flex items-center gap-2">
                      <CheckCircleIcon className="w-3 h-3" />
                      Output (Last 10 lines)
                    </div>
                    <LogOutput text={getLastLines(log.output, 10)} />
                  </div>
                )}
                {log.error && (
                  <div>
                    <div className="text-terminal-error/70 text-[10px] mb-2 uppercase tracking-wider font-bold flex items-center gap-2">
                      <ErrorIcon className="w-3 h-3" />
                      Error
                    </div>
                    <LogOutput text={getLastLines(log.error, 10)} isError />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-28">
                <div className="text-center">
                  <div className="mb-3 flex justify-center">
                    <PulsingDot size="lg" color="accent" />
                  </div>
                  <div className="text-gray-500 text-xs">Waiting for output...</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="font-mono text-xs text-gray-500 pl-3 border-l-2 border-gray-700 line-clamp-1">
            {log.output ? (
              <span>{log.output.substring(0, 100)}...</span>
            ) : log.error ? (
              <span className="text-terminal-error/70">{log.error.substring(0, 100)}...</span>
            ) : (
              <span className="text-gray-600 italic flex items-center gap-2">
                <PulsingDot size="sm" color="accent" />
                Waiting for output...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
