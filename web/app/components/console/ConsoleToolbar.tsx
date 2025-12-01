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
  autoPollingEnabled: _autoPollingEnabled,
  onToggleAutoPolling: _onToggleAutoPolling,
  className = "",
}: ConsoleToolbarProps) {
  // Note: autoPollingEnabled and onToggleAutoPolling reserved for future auto-polling toggle UI
  void _autoPollingEnabled;
  void _onToggleAutoPolling;
  return (
    <div className={`console-toolbar sticky top-0 z-20 bg-gray-950/70 backdrop-blur-xl border-b border-gray-800/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`}>
      <div className="px-3 sm:px-4 py-3 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal-accent" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
              Console
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-end -mt-8">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRefreshing
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-400 hover:text-terminal-accent hover:bg-terminal-accent/10"
            }`}
            title="Refresh"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isRefreshing ? "animate-spin" : ""}`} 
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
          </button>

          {/* Request Output Button */}
          <button
            onClick={onRequestOutput}
            disabled={runningCount === 0 || isRequesting}
            className={`toolbar-button bg-terminal-accent text-white border border-terminal-accent/30 flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              runningCount === 0 || isRequesting
                ? "bg-terminal-accent/60 text-white/70 cursor-not-allowed"
                : "hover:bg-terminal-accent-bright hover:shadow-lg hover:shadow-terminal-glow"
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
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" 
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
