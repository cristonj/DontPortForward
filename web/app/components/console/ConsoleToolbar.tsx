"use client";

interface ConsoleToolbarProps {
  runningCount: number;
  onRequestOutput: () => void;
  isRequesting: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoPollingEnabled: boolean;
  onToggleAutoPolling: () => void;
  className?: string;
}

export default function ConsoleToolbar({
  runningCount,
  onRequestOutput,
  isRequesting,
  onRefresh,
  isRefreshing,
  autoPollingEnabled,
  onToggleAutoPolling,
  className = "",
}: ConsoleToolbarProps) {
  return (
    <div className={`console-toolbar sticky top-0 z-20 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`}>
      <div className="px-3 sm:px-4 py-3 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal-accent" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
              Console
            </span>
          </div>
          {runningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-terminal-accent/15 text-terminal-accent text-[10px] font-bold tracking-wide border border-terminal-accent/30">
              {runningCount} ACTIVE
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Request Output Button */}
          <button
            onClick={onRequestOutput}
            disabled={runningCount === 0 || isRequesting}
            className={`toolbar-button flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              runningCount === 0 || isRequesting
                ? "bg-blue-600/80 text-black border border-gray-800/50 cursor-not-allowed opacity-60"
                : "toolbar-button-primary"
            }`}
            title="Request output for active commands"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isRequesting ? "animate-spin" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span className="hidden sm:inline">
              {isRequesting ? "Requesting..." : "Get Output"}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="toolbar-button flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-gray-900/80 text-gray-300 border border-gray-700/60 hover:bg-gray-800 hover:border-gray-600 disabled:opacity-50 transition-all duration-200"
            title="Refresh command logs"
          >
            <svg 
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span className="hidden sm:inline">
              {isRefreshing ? "Syncing..." : "Refresh"}
            </span>
          </button>

          {/* Auto-polling Toggle */}
          <button
            onClick={onToggleAutoPolling}
            className={`toolbar-button flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              autoPollingEnabled
                ? "toolbar-button-live shadow-lg shadow-green-900/30"
                : "bg-gray-900/80 text-gray-400 border border-gray-700/60 hover:bg-gray-800 hover:text-gray-300"
            }`}
            aria-pressed={autoPollingEnabled}
            title={autoPollingEnabled ? "Disable auto-polling" : "Enable auto-polling (30s updates)"}
          >
            <span className="relative flex h-2.5 w-2.5">
              {autoPollingEnabled ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-600" />
              )}
            </span>
            <span className="hidden sm:inline font-semibold">
              {autoPollingEnabled ? "Live" : "Manual"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
