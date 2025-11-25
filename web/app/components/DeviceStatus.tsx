"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

interface GitInfo {
  branch: string;
  commit: string;
  is_dirty: boolean;
  last_commit_date: string;
}

interface DeviceStats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  boot_time: number;
}

interface Device {
  id: string;
  hostname: string;
  ip: string;
  status: string;
  platform: string;
  release: string;
  version: string;
  last_seen: any;
  stats?: DeviceStats;
  git?: GitInfo;
  mode?: string;
  polling_rate?: number;
  sleep_polling_rate?: number;
}

interface DeviceStatusProps {
  deviceId: string;
}

export default function DeviceStatus({ deviceId }: DeviceStatusProps) {
  /**
   * Displays real-time status information for a selected device.
   * Allows modifying the polling rate configuration.
   */
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [localPollingRate, setLocalPollingRate] = useState<number | null>(null);

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
    });

    return () => unsub();
  }, [deviceId]); // Removed localPollingRate dependency to prevent loop

  // Sync local polling rate when device data updates, but only if we don't have one set yet (handled above)
  // Actually, better to just use key/id approach or let user drive input. 
  // If external update happens, we should probably reflect it unless user is dragging.
  
  useEffect(() => {
      if (device?.polling_rate) {
          setLocalPollingRate(prev => prev === null ? device.polling_rate! : prev);
      }
  }, [device?.polling_rate]);

  const handlePollingChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setLocalPollingRate(val);
  };

  const commitPollingChange = async () => {
      if (!device || localPollingRate === null) return;
      try {
          await updateDoc(doc(db, "devices", deviceId), {
              polling_rate: localPollingRate
          });
      } catch (error) {
          console.error("Error updating polling rate:", error);
      }
  };

  if (!deviceId) return <div className="h-full flex items-center justify-center text-gray-500">Select a device to view status.</div>;
  if (loading) return <div className="h-full flex items-center justify-center text-gray-500 animate-pulse">Loading device status...</div>;
  if (!device) return <div className="h-full flex items-center justify-center text-red-500">Device not found.</div>;

  const formatDate = (timestamp: any) => {
      if (!timestamp) return "Unknown";
      if (typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toLocaleString();
      }
      return new Date(timestamp).toLocaleString();
  };
  
  const formatUptime = (bootTime: number) => {
      if (!bootTime) return "Unknown";
      const now = Date.now() / 1000;
      const uptimeSeconds = now - bootTime;
      const days = Math.floor(uptimeSeconds / (3600 * 24));
      const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 pb-20 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-800 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
                <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-all">
                        {device.hostname || device.id}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shrink-0 ${
                        device.status === 'online' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                        {device.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                </div>
                <div className="text-gray-500 text-xs mt-1.5 font-mono break-all">{device.id}</div>
            </div>
            
            <div className="flex flex-row sm:flex-col justify-between sm:justify-start text-xs text-gray-400 gap-1 bg-gray-900/50 p-3 rounded-lg sm:bg-transparent sm:p-0 border sm:border-0 border-gray-800">
                <div className="flex flex-col sm:flex-row sm:justify-end gap-1 sm:gap-4">
                    <span className="text-gray-500">Last Seen:</span> 
                    <span className="font-mono text-gray-300">{formatDate(device.last_seen)}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-end gap-1 sm:gap-4">
                    <span className="text-gray-500">Mode:</span> 
                    <span className="text-blue-400 font-medium uppercase tracking-wider">{device.mode || 'unknown'}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* System Info */}
          <div className="bg-gray-900/50 p-4 sm:p-5 rounded-xl border border-gray-800 backdrop-blur-sm">
              <h3 className="text-base font-semibold text-blue-400 mb-4 flex items-center gap-2 uppercase tracking-wider text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  System Information
              </h3>
              <dl className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-gray-800/50 pb-2 last:border-0 last:pb-0">
                      <dt className="text-gray-500">OS</dt>
                      <dd className="text-gray-200 font-medium text-right truncate ml-4">{device.platform} {device.release}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-800/50 pb-2 last:border-0 last:pb-0">
                      <dt className="text-gray-500">Version</dt>
                      <dd className="text-gray-200 font-medium text-right truncate ml-4">{device.version}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-800/50 pb-2 last:border-0 last:pb-0">
                      <dt className="text-gray-500">IP Address</dt>
                      <dd className="text-gray-200 font-mono text-right truncate ml-4">{device.ip}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-800/50 pb-2 last:border-0 last:pb-0">
                      <dt className="text-gray-500">Uptime</dt>
                      <dd className="text-gray-200 font-medium text-right truncate ml-4">{device.stats ? formatUptime(device.stats.boot_time) : 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-800/50 mt-2">
                      <dt className="text-gray-500">Polling Rate</dt>
                      <dd className="text-right w-1/2">
                          <div className="flex items-center gap-2 justify-end">
                              <input 
                                  type="range" 
                                  min="1" 
                                  max="60" 
                                  step="1"
                                  value={localPollingRate ?? device.polling_rate ?? 10}
                                  onChange={handlePollingChange}
                                  onMouseUp={commitPollingChange}
                                  onTouchEnd={commitPollingChange}
                                  className="w-20 sm:w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <span className="text-gray-200 font-mono w-8 text-right text-xs sm:text-sm">{localPollingRate ?? device.polling_rate ?? 10}s</span>
                          </div>
                      </dd>
                  </div>
              </dl>
          </div>

          {/* Resources */}
          <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-sm">
              <h3 className="text-base font-semibold text-green-400 mb-4 flex items-center gap-2 uppercase tracking-wider text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Resources
              </h3>
              <div className="space-y-4">
                  <div>
                      <div className="flex justify-between text-xs uppercase tracking-wide mb-1.5">
                          <span className="text-gray-500">CPU Usage</span>
                          <span className="text-gray-200 font-mono">{device.stats?.cpu_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                              (device.stats?.cpu_percent || 0) > 80 ? 'bg-red-500' : 'bg-blue-500'
                          }`} style={{ width: `${device.stats?.cpu_percent || 0}%` }}></div>
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between text-xs uppercase tracking-wide mb-1.5">
                          <span className="text-gray-500">Memory Usage</span>
                          <span className="text-gray-200 font-mono">{device.stats?.memory_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                              (device.stats?.memory_percent || 0) > 80 ? 'bg-red-500' : 'bg-purple-500'
                          }`} style={{ width: `${device.stats?.memory_percent || 0}%` }}></div>
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between text-xs uppercase tracking-wide mb-1.5">
                          <span className="text-gray-500">Disk Usage</span>
                          <span className="text-gray-200 font-mono">{device.stats?.disk_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                              (device.stats?.disk_percent || 0) > 90 ? 'bg-red-500' : 'bg-yellow-500'
                          }`} style={{ width: `${device.stats?.disk_percent || 0}%` }}></div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Git Status */}
          <div className="lg:col-span-2 bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-sm">
              <h3 className="text-base font-semibold text-orange-400 mb-4 flex items-center gap-2 uppercase tracking-wider text-xs">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M2.5 12a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM12 1v2a9 9 0 019 9h2A11 11 0 0012 1zm0 20v2A11 11 0 011 12h2a9 9 0 009 9zm9-11h2A11 11 0 0112 23v-2a9 9 0 009-9z" opacity="0.2"/>
                    <path d="M12.0003 2.00244C6.47743 2.00244 2.00024 6.47963 2.00024 12.0024C2.00024 17.5252 6.47743 22.0024 12.0003 22.0024C17.5231 22.0024 22.0002 17.5252 22.0002 12.0024C22.0002 6.47963 17.5231 2.00244 12.0003 2.00244ZM16.3093 16.7093L13.5 13.9V8H10.5V15.1L14.1903 18.8283L16.3093 16.7093Z" />
                </svg>
                  Git Status
              </h3>
              {device.git ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Branch</div>
                          <div className="text-gray-200 font-mono text-sm flex items-center gap-2 truncate">
                              <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                              <span className="truncate">{device.git.branch}</span>
                          </div>
                      </div>
                      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Commit</div>
                          <div className="text-gray-200 font-mono text-sm flex items-center gap-2 truncate">
                              <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              <span className="truncate">{device.git.commit}</span>
                          </div>
                      </div>
                      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Status</div>
                          <div className={`font-mono text-sm flex items-center gap-2 ${device.git.is_dirty ? 'text-yellow-500' : 'text-green-500'}`}>
                              {device.git.is_dirty ? (
                                  <>
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Dirty
                                  </>
                              ) : (
                                  <>
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Clean
                                  </>
                              )}
                          </div>
                      </div>
                      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Last Commit</div>
                          <div className="text-gray-200 text-xs font-mono break-all line-clamp-2">
                              {device.git.last_commit_date}
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-gray-500 italic text-sm p-4 text-center">No git information available.</div>
              )}
          </div>
      </div>
    </div>
  );
}