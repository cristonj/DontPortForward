"use client";

import { memo } from "react";
import type { Device } from "../../types";

interface ConfigurationCardProps {
  device: Device;
  localPollingRate: number | null;
  onPollingChange: (value: number) => void;
  onPollingCommit: () => void;
}

export const ConfigurationCard = memo(function ConfigurationCard({
  device,
  localPollingRate,
  onPollingChange,
  onPollingCommit,
}: ConfigurationCardProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPollingChange(parseInt(e.target.value));
  };

  return (
    <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
      <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <div className="p-1.5 rounded-lg bg-emerald-500/10">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        Configuration
      </h3>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
          <dt className="text-gray-500">Mode</dt>
          <dd className={`font-semibold text-right uppercase ${device.mode === 'sleep' ? 'text-indigo-400' : 'text-blue-400'}`}>
            {device.mode || 'Unknown'}
          </dd>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
          <dt className="text-gray-500">Polling Rate</dt>
          <dd className="text-right flex-1">
            <div className="flex items-center gap-3 justify-end">
              <input 
                type="range" 
                min="1" 
                max="60" 
                step="1"
                value={localPollingRate ?? device.polling_rate ?? 10}
                onChange={handleChange}
                onMouseUp={onPollingCommit}
                onTouchEnd={onPollingCommit}
                className="w-24 sm:w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-emerald-400 font-mono font-semibold min-w-[3rem] text-right">
                {localPollingRate ?? device.polling_rate ?? 10}s
              </span>
            </div>
          </dd>
        </div>
        {device.sleep_polling_rate !== undefined && (
          <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
            <dt className="text-gray-500">Sleep Polling Rate</dt>
            <dd className="text-gray-200 font-mono text-right">{device.sleep_polling_rate}s</dd>
          </div>
        )}
        {device.startup_file && (
          <div className="flex justify-between items-center py-2">
            <dt className="text-gray-500">Startup File</dt>
            <dd className="text-gray-200 font-mono text-right truncate ml-4 max-w-[200px]" title={device.startup_file}>
              {device.startup_file}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
});
