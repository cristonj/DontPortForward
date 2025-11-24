"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

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
}

interface DeviceStatusProps {
  deviceId: string;
}

export default function DeviceStatus({ deviceId }: DeviceStatusProps) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) {
        setDevice(null);
        return;
    }

    const unsub = onSnapshot(doc(db, "devices", deviceId), (doc) => {
        if (doc.exists()) {
            setDevice({ id: doc.id, ...doc.data() } as Device);
        } else {
            setDevice(null);
        }
        setLoading(false);
    });

    return () => unsub();
  }, [deviceId]);

  if (!deviceId) return <div className="p-8 text-center text-gray-500">Select a device to view status.</div>;
  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!device) return <div className="p-8 text-center text-red-500">Device not found.</div>;

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
    <div className="p-6 space-y-6 max-w-4xl mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                {device.hostname || device.id}
                <span className={`px-2 py-1 rounded text-xs border ${
                    device.status === 'online' 
                    ? 'bg-green-900/20 text-green-400 border-green-900/50' 
                    : 'bg-red-900/20 text-red-400 border-red-900/50'
                }`}>
                    {device.status?.toUpperCase() || 'UNKNOWN'}
                </span>
            </h2>
            <div className="text-gray-400 text-sm mt-1 font-mono">{device.id}</div>
        </div>
        <div className="text-right text-sm text-gray-400">
            <div>Last Seen: {formatDate(device.last_seen)}</div>
            <div>Mode: <span className="text-blue-400">{device.mode || 'unknown'}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System Info */}
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
              <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  System Information
              </h3>
              <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                      <dt className="text-gray-500">OS:</dt>
                      <dd className="text-gray-200">{device.platform} {device.release}</dd>
                  </div>
                  <div className="flex justify-between">
                      <dt className="text-gray-500">Version:</dt>
                      <dd className="text-gray-200">{device.version}</dd>
                  </div>
                  <div className="flex justify-between">
                      <dt className="text-gray-500">IP Address:</dt>
                      <dd className="text-gray-200 font-mono">{device.ip}</dd>
                  </div>
                  <div className="flex justify-between">
                      <dt className="text-gray-500">Uptime:</dt>
                      <dd className="text-gray-200">{device.stats ? formatUptime(device.stats.boot_time) : 'N/A'}</dd>
                  </div>
              </dl>
          </div>

          {/* Resources */}
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
              <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Resources
              </h3>
              <div className="space-y-4">
                  <div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">CPU Usage</span>
                          <span className="text-gray-200">{device.stats?.cpu_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${device.stats?.cpu_percent || 0}%` }}></div>
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Memory Usage</span>
                          <span className="text-gray-200">{device.stats?.memory_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${device.stats?.memory_percent || 0}%` }}></div>
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Disk Usage</span>
                          <span className="text-gray-200">{device.stats?.disk_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full transition-all duration-500" style={{ width: `${device.stats?.disk_percent || 0}%` }}></div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Git Status */}
          <div className="md:col-span-2 bg-gray-900 p-4 rounded-lg border border-gray-800">
              <h3 className="text-lg font-semibold text-orange-400 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M2.5 12a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM12 1v2a9 9 0 019 9h2A11 11 0 0012 1zm0 20v2A11 11 0 011 12h2a9 9 0 009 9zm9-11h2A11 11 0 0112 23v-2a9 9 0 009-9z" opacity="0.2"/>
                    <path d="M12.0003 2.00244C6.47743 2.00244 2.00024 6.47963 2.00024 12.0024C2.00024 17.5252 6.47743 22.0024 12.0003 22.0024C17.5231 22.0024 22.0002 17.5252 22.0002 12.0024C22.0002 6.47963 17.5231 2.00244 12.0003 2.00244ZM16.3093 16.7093L13.5 13.9V8H10.5V15.1L14.1903 18.8283L16.3093 16.7093Z" />
                </svg>
                  Git Status
              </h3>
              {device.git ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-950 p-3 rounded border border-gray-800">
                          <div className="text-gray-500 text-xs uppercase mb-1">Branch</div>
                          <div className="text-gray-200 font-mono text-lg flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                              {device.git.branch}
                          </div>
                      </div>
                      <div className="bg-gray-950 p-3 rounded border border-gray-800">
                          <div className="text-gray-500 text-xs uppercase mb-1">Commit</div>
                          <div className="text-gray-200 font-mono text-lg flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              {device.git.commit}
                          </div>
                      </div>
                      <div className="bg-gray-950 p-3 rounded border border-gray-800">
                          <div className="text-gray-500 text-xs uppercase mb-1">Status</div>
                          <div className={`font-mono text-lg flex items-center gap-2 ${device.git.is_dirty ? 'text-yellow-500' : 'text-green-500'}`}>
                              {device.git.is_dirty ? (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Dirty (Uncommitted Changes)
                                  </>
                              ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Clean
                                  </>
                              )}
                          </div>
                      </div>
                      <div className="bg-gray-950 p-3 rounded border border-gray-800">
                          <div className="text-gray-500 text-xs uppercase mb-1">Last Commit Date</div>
                          <div className="text-gray-200 text-sm font-mono">
                              {device.git.last_commit_date}
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-gray-500 italic">No git information available.</div>
              )}
          </div>
      </div>
    </div>
  );
}
