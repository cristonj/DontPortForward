"use client";

import { memo } from "react";
import type { Device } from "../../types";
import { formatDate } from "../../utils";

interface SystemInfoCardProps {
  device: Device;
}

export const SystemInfoCard = memo(function SystemInfoCard({ device }: SystemInfoCardProps) {
  return (
    <div className="bg-gray-900/50 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
      <h3 className="text-xs sm:text-sm font-semibold text-blue-400 mb-3 sm:mb-4 flex items-center gap-2 uppercase tracking-wider">
        <div className="p-1 sm:p-1.5 rounded-lg bg-blue-500/10">
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        System Information
      </h3>
      <dl className="space-y-2 sm:space-y-3 text-sm">
        <InfoRow label="Operating System" value={`${device.platform} ${device.release}`} />
        <InfoRow label="Version" value={device.version} truncate />
        <InfoRow label="IP Address" value={device.ip} mono />
        <InfoRow label="Last Seen" value={formatDate(device.last_seen)} isLast />
      </dl>
    </div>
  );
});

interface InfoRowProps {
  label: string;
  value?: string;
  mono?: boolean;
  truncate?: boolean;
  isLast?: boolean;
}

const InfoRow = memo(function InfoRow({ label, value, mono = false, truncate = false, isLast = false }: InfoRowProps) {
  return (
    <div className={`flex flex-col xs:flex-row xs:justify-between xs:items-center py-1.5 sm:py-2 gap-0.5 xs:gap-2 ${!isLast ? 'border-b border-gray-800/50' : ''}`}>
      <dt className="text-gray-500 text-xs sm:text-sm shrink-0">{label}</dt>
      <dd 
        className={`text-gray-200 font-medium xs:text-right text-sm ${mono ? 'font-mono text-xs sm:text-sm' : ''} ${truncate ? 'truncate max-w-full xs:max-w-[140px] sm:max-w-[200px]' : ''}`}
        title={truncate || mono ? value : undefined}
      >
        {value || 'N/A'}
      </dd>
    </div>
  );
});
