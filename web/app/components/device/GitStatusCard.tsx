"use client";

import { memo } from "react";
import type { Device } from "../../types";

interface GitStatusCardProps {
  git: Device['git'];
}

export const GitStatusCard = memo(function GitStatusCard({ git }: GitStatusCardProps) {
  return (
    <div className="md:col-span-2 bg-gray-900/50 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
      <h3 className="text-xs sm:text-sm font-semibold text-orange-400 mb-3 sm:mb-4 flex items-center gap-2 uppercase tracking-wider">
        <div className="p-1 sm:p-1.5 rounded-lg bg-orange-500/10">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        Git Repository
      </h3>
      {git ? <GitDetails git={git} /> : <NoGitRepo />}
    </div>
  );
});

interface GitDetailsProps {
  git: NonNullable<Device['git']>;
}

const GitDetails = memo(function GitDetails({ git }: GitDetailsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
      <GitInfoBox
        icon={<BranchIcon />}
        label="Branch"
        value={git.branch}
        valueClass="text-orange-300"
      />
      <GitInfoBox
        icon={<CommitIcon />}
        label="Commit"
        value={git.commit?.substring(0, 8)}
      />
      <GitInfoBox
        icon={<StatusIcon />}
        label="Status"
        value={git.is_dirty ? 'Modified' : 'Clean'}
        valueClass={git.is_dirty ? 'text-yellow-400' : 'text-green-400'}
        showIndicator
        indicatorColor={git.is_dirty ? 'bg-yellow-500' : 'bg-green-500'}
      />
      <GitInfoBox
        icon={<ClockIcon />}
        label="Last Commit"
        value={git.last_commit_date}
        valueClass="text-gray-200 text-[10px] sm:text-xs"
      />
    </div>
  );
});

interface GitInfoBoxProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueClass?: string;
  showIndicator?: boolean;
  indicatorColor?: string;
}

const GitInfoBox = memo(function GitInfoBox({
  icon,
  label,
  value,
  valueClass = "text-gray-200",
  showIndicator = false,
  indicatorColor = "",
}: GitInfoBoxProps) {
  return (
    <div className="bg-gray-950/50 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
      <div className="text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-wider mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-1.5">
        {icon}
        {label}
      </div>
      <div className={`font-mono text-xs sm:text-sm truncate font-medium ${valueClass} ${showIndicator ? 'flex items-center gap-1.5 sm:gap-2' : ''}`} title={value}>
        {showIndicator && <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${indicatorColor}`}></span>}
        {value || 'N/A'}
      </div>
    </div>
  );
});

const NoGitRepo = memo(function NoGitRepo() {
  return (
    <div className="text-gray-500 italic text-xs sm:text-sm p-4 sm:p-6 text-center bg-gray-950/30 rounded-lg sm:rounded-xl border border-gray-800/30">
      <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 sm:mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
      No git repository detected
    </div>
  );
});

// Icons
const BranchIcon = memo(function BranchIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  );
});

const CommitIcon = memo(function CommitIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
});

const StatusIcon = memo(function StatusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
});

const ClockIcon = memo(function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
});
