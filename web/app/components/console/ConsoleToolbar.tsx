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
  const baseClass =
    "sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-900/60 shadow-[0_16px_32px_rgba(0,0,0,0.4)]";

  return (
    <div className={`${baseClass} ${className}`}>
      <div className="px-3 sm:px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] uppercase tracking-[0.2em] text-gray-500">
          <span>Console Controls</span>
          {runningCount > 0 && (
            <span className="text-[10px] text-blue-400 tracking-wide">Active: {runningCount}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRequestOutput}
            disabled={runningCount === 0 || isRequesting}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              runningCount === 0
                ? "bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed opacity-60"
                : "bg-blue-600/90 hover:bg-blue-500 border-blue-500/50 text-white shadow-lg shadow-blue-900/20"
            } ${isRequesting ? "animate-pulse" : ""}`}
            title="Request output for active commands"
          >
            <svg className={`w-4 h-4 ${isRequesting ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRequesting ? "Requesting..." : "Request Output"}
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border border-gray-800 bg-gray-900/80 hover:bg-gray-800 text-gray-300 disabled:opacity-60"
            title="Refresh command logs"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? "Refreshing..." : "Refresh Logs"}
          </button>

          <button
            onClick={onToggleAutoPolling}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              autoPollingEnabled
                ? "bg-green-600/90 hover:bg-green-500 border-green-500/50 text-white"
                : "bg-gray-900/80 hover:bg-gray-800 border-gray-800 text-gray-300"
            }`}
            aria-pressed={autoPollingEnabled}
            title={autoPollingEnabled ? "Disable auto-polling" : "Enable auto-polling (30s updates)"}
          >
            <span className="relative flex h-2 w-2">
              {autoPollingEnabled ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-500" />
              )}
            </span>
            {autoPollingEnabled ? "Live" : "Manual"}
          </button>
        </div>
      </div>
    </div>
  );
}

