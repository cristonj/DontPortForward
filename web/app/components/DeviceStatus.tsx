"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import type { Device } from "../types";

interface DeviceStatusProps {
  deviceId: string;
}

// Helper to check if device is connected (seen within last 5 minutes)
const isDeviceConnected = (lastSeen: Timestamp | null | undefined): boolean => {
  if (!lastSeen) return false;
  const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen as unknown as number);
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return lastSeenDate.getTime() > fiveMinutesAgo;
};

// Helper to get relative time string
const getRelativeTime = (timestamp: Timestamp | Date | number | string | null | undefined): string => {
  if (!timestamp) return "Never";
  
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
    date = (timestamp as Timestamp).toDate();
  } else {
    date = new Date(timestamp as number | string);
  }
  
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function DeviceStatus({ deviceId }: DeviceStatusProps) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [localPollingRate, setLocalPollingRate] = useState<number | null>(null);
  const [, setTick] = useState(0); // Force re-render for relative time

  useEffect(() => {
    if (!deviceId) {
        setDevice(null);
        return;
    }

    const unsub = onSnapshot(doc(db, "devices", deviceId), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as Omit<Device, 'id'>;
            setDevice({ id: doc.id, ...data });
            // Only update local state if not interacting or on first load
            if (localPollingRate === null && data.polling_rate) {
                setLocalPollingRate(data.polling_rate);
            }
        } else {
            setDevice(null);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching device status:", error);
        setDevice(null);
        setLoading(false);
    });

    return () => unsub();
  }, [deviceId]);

  // Update relative time every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePollingChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setLocalPollingRate(val);
  };

  const commitPollingChange = async () => {
      if (!device || localPollingRate === null) return;
      const maxRetries = 2;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await updateDoc(doc(db, "devices", deviceId), {
              polling_rate: localPollingRate
          });
          return; // Success
        } catch (error: unknown) {
          const err = error as { code?: string; message?: string };
          const isNetworkError = err?.code === 'unavailable' || 
                                err?.code === 'deadline-exceeded' ||
                                err?.message?.includes('network') ||
                                err?.message?.includes('fetch');
          
          if (isNetworkError && attempt < maxRetries - 1) {
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Network error updating polling rate (attempt ${attempt + 1}/${maxRetries}), retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.error("Error updating polling rate:", error);
            alert(`Failed to update polling rate${attempt === maxRetries - 1 ? ` after ${maxRetries} attempts` : ''}: ${err?.message || 'Network error'}`);
            return;
          }
        }
      }
  };

  if (!deviceId) return <div className="h-full flex items-center justify-center text-gray-500">Select a device to view status.</div>;
  if (loading) return <div className="h-full flex items-center justify-center text-gray-500 animate-pulse">Loading device status...</div>;
  if (!device) return <div className="h-full flex items-center justify-center text-red-500">Device not found.</div>;

  const formatDate = (timestamp: Timestamp | Date | number | string | null | undefined) => {
      if (!timestamp) return "Unknown";
      if (timestamp instanceof Date) {
          return timestamp.toLocaleString();
      }
      if (
        typeof timestamp === 'object' &&
        'toDate' in timestamp &&
        typeof (timestamp as Timestamp).toDate === 'function'
      ) {
          return (timestamp as Timestamp).toDate().toLocaleString();
      }
      return new Date(timestamp as number | string).toLocaleString();
  };
  
  const formatUptime = (bootTime?: number | null) => {
      if (!bootTime) return "Unknown";
      const now = Date.now() / 1000;
      const uptimeSeconds = now - bootTime;
      const days = Math.floor(uptimeSeconds / (3600 * 24));
      const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
  };

  const connected = isDeviceConnected(device.last_seen);
  const cpuPercent = device.stats?.cpu_percent ?? 0;
  const memoryPercent = device.stats?.memory_percent ?? 0;
  const diskPercent = device.stats?.disk_percent ?? 0;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 pb-20 sm:pb-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Device Identity */}
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
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-2 ${
                    device.mode === 'sleep'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                      : connected 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {device.mode === 'sleep' ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Sleeping
                      </>
                    ) : connected ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Connected
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Disconnected
                      </>
                    )}
                  </span>
                </div>
                <div className="text-gray-500 text-sm mt-1.5 font-mono">{device.id}</div>
                
                {/* Quick Stats Row */}
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
                    <span className="text-gray-200 font-medium">{device.stats ? formatUptime(device.stats.boot_time) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Mode Badge */}
            <div className="hidden sm:flex flex-col items-end gap-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Mode</div>
              <div className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide ${
                device.mode === 'sleep' 
                  ? 'bg-indigo-500/20 text-indigo-300' 
                  : device.mode === 'active'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-gray-800 text-gray-400'
              }`}>
                {device.mode || 'Unknown'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Gauges - Prominent */}
      <div className="grid grid-cols-3 gap-4">
        {/* CPU Gauge */}
        <div className="relative bg-gray-900/50 rounded-2xl border border-gray-800 p-5 overflow-hidden group hover:border-gray-700 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">CPU</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{cpuPercent.toFixed(1)}%</div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${cpuPercent > 80 ? 'bg-red-500' : cpuPercent > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`} 
                style={{ width: `${Math.min(cpuPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Memory Gauge */}
        <div className="relative bg-gray-900/50 rounded-2xl border border-gray-800 p-5 overflow-hidden group hover:border-gray-700 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Memory</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{memoryPercent.toFixed(1)}%</div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${memoryPercent > 80 ? 'bg-red-500' : memoryPercent > 60 ? 'bg-yellow-500' : 'bg-purple-500'}`} 
                style={{ width: `${Math.min(memoryPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Disk Gauge */}
        <div className="relative bg-gray-900/50 rounded-2xl border border-gray-800 p-5 overflow-hidden group hover:border-gray-700 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Disk</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {device.stats?.disk_percent !== undefined ? `${diskPercent.toFixed(1)}%` : 'N/A'}
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${diskPercent > 90 ? 'bg-red-500' : diskPercent > 70 ? 'bg-yellow-500' : 'bg-amber-500'}`} 
                style={{ width: `${Math.min(diskPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* System Info */}
          <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  System Information
              </h3>
              <dl className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                      <dt className="text-gray-500">Operating System</dt>
                      <dd className="text-gray-200 font-medium text-right truncate ml-4">{device.platform} {device.release}</dd>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                      <dt className="text-gray-500">Version</dt>
                      <dd className="text-gray-200 font-medium text-right truncate ml-4 max-w-[200px]" title={device.version}>{device.version}</dd>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                      <dt className="text-gray-500">IP Address</dt>
                      <dd className="text-gray-200 font-mono text-right truncate ml-4">{device.ip}</dd>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                      <dt className="text-gray-500">Last Seen</dt>
                      <dd className="text-gray-200 font-medium text-right truncate ml-4">{formatDate(device.last_seen)}</dd>
                  </div>
              </dl>
          </div>

          {/* Configuration */}
          <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
              <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
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
                                  onChange={handlePollingChange}
                                  onMouseUp={commitPollingChange}
                                  onTouchEnd={commitPollingChange}
                                  className="w-24 sm:w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                              <span className="text-emerald-400 font-mono font-semibold min-w-[3rem] text-right">{localPollingRate ?? device.polling_rate ?? 10}s</span>
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
                        <dd className="text-gray-200 font-mono text-right truncate ml-4 max-w-[200px]" title={device.startup_file}>{device.startup_file}</dd>
                    </div>
                  )}
              </dl>
          </div>

          {/* Git Status */}
          <div className="lg:col-span-2 bg-gray-900/50 p-5 rounded-2xl border border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors">
              <h3 className="text-sm font-semibold text-orange-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                Git Repository
              </h3>
              {device.git ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                            Branch
                          </div>
                          <div className="text-orange-300 font-mono text-sm truncate font-medium" title={device.git.branch}>
                              {device.git.branch}
                          </div>
                      </div>
                      <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            Commit
                          </div>
                          <div className="text-gray-200 font-mono text-sm truncate" title={device.git.commit}>
                              {device.git.commit?.substring(0, 8)}
                          </div>
                      </div>
                      <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Status
                          </div>
                          <div className={`font-semibold text-sm flex items-center gap-2 ${device.git.is_dirty ? 'text-yellow-400' : 'text-green-400'}`}>
                              <span className={`w-2 h-2 rounded-full ${device.git.is_dirty ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                              {device.git.is_dirty ? 'Modified' : 'Clean'}
                          </div>
                      </div>
                      <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Last Commit
                          </div>
                          <div className="text-gray-200 text-xs font-mono truncate" title={device.git.last_commit_date}>
                              {device.git.last_commit_date}
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-gray-500 italic text-sm p-6 text-center bg-gray-950/30 rounded-xl border border-gray-800/30">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    No git repository detected
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}