"use client";

import { memo } from "react";
import type { Device } from "../../types";
import { isDeviceConnected, getRelativeTime } from "../../utils";
import { PulsingDot } from "../ui";

interface DeviceStatusHeaderProps {
  device: Device;
  formatUptime: (bootTime: number) => string;
}

export const DeviceStatusHeader = memo(function DeviceStatusHeader({ device, formatUptime }: DeviceStatusHeaderProps) {
  const connected = isDeviceConnected(device.last_seen);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
      
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <DeviceIdentity device={device} connected={connected} formatUptime={formatUptime} />
          <ModeBadge mode={device.mode} />
        </div>
      </div>
    </div>
  );
});

interface DeviceIdentityProps {
  device: Device;
  connected: boolean;
  formatUptime: (bootTime: number) => string;
}

const DeviceIdentity = memo(function DeviceIdentity({ device, connected, formatUptime }: DeviceIdentityProps) {
  return (
    <div className="flex items-start gap-4">
      {/* Device Icon */}
      <div className={`p-4 rounded-2xl ${connected ? 'bg-green-500/10 ring-1 ring-green-500/20' : 'bg-red-500/10 ring-1 ring-red-500/20'}`}>
        <svg className={`w-8 h-8 ${connected ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {device.hostname || device.id}
          </h2>
          <ConnectionStatusBadge device={device} connected={connected} />
        </div>
        <div className="text-gray-500 text-sm mt-1.5 font-mono">{device.id}</div>
        
        {/* Quick Stats Row */}
        <QuickStats device={device} connected={connected} formatUptime={formatUptime} />
      </div>
    </div>
  );
});

interface ConnectionStatusBadgeProps {
  device: Device;
  connected: boolean;
}

const ConnectionStatusBadge = memo(function ConnectionStatusBadge({ device, connected }: ConnectionStatusBadgeProps) {
  const isSleeping = device.mode === 'sleep';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-2 ${
      isSleeping
        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
        : connected 
          ? 'bg-green-500/10 text-green-400 border-green-500/30' 
          : 'bg-red-500/10 text-red-400 border-red-500/30'
    }`}>
      {isSleeping ? (
        <>
          <PulsingDot size="sm" color="accent" />
          Sleeping
        </>
      ) : connected ? (
        <>
          <PulsingDot size="sm" color="success" />
          Connected
        </>
      ) : (
        <>
          <PulsingDot size="sm" color="error" pulse={false} />
          Disconnected
        </>
      )}
    </span>
  );
});

interface QuickStatsProps {
  device: Device;
  connected: boolean;
  formatUptime: (bootTime: number) => string;
}

const QuickStats = memo(function QuickStats({ device, connected, formatUptime }: QuickStatsProps) {
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-gray-400">Last seen</span>
        <span className={`font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {getRelativeTime(device.last_seen)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        <span className="text-gray-400">IP</span>
        <span className="text-gray-200 font-mono">{device.ip || 'N/A'}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
        <span className="text-gray-400">Uptime</span>
        <span className="text-gray-200 font-medium">{device.stats?.boot_time !== undefined ? formatUptime(device.stats.boot_time) : 'N/A'}</span>
      </div>
    </div>
  );
});

interface ModeBadgeProps {
  mode?: string;
}

const ModeBadge = memo(function ModeBadge({ mode }: ModeBadgeProps) {
  return (
    <div className="hidden sm:flex flex-col items-end gap-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Mode</div>
      <div className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide ${
        mode === 'sleep' 
          ? 'bg-indigo-500/20 text-indigo-300' 
          : mode === 'active'
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-gray-800 text-gray-400'
      }`}>
        {mode || 'Unknown'}
      </div>
    </div>
  );
});
