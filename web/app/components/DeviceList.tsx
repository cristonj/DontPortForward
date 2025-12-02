"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { Device } from "../types";
import { isDeviceConnected } from "../utils";
import { WindowsIcon, LinuxIcon, AppleIcon, DefaultDeviceIcon } from "./Icons";

interface DeviceListProps {
  onSelectDevice: (deviceId: string) => void;
  selectedDeviceId?: string;
  className?: string;
  currentUserEmail?: string | null;
}

export default function DeviceList({ onSelectDevice, selectedDeviceId, className = "", currentUserEmail }: DeviceListProps) {
  // Start with empty devices if no user email
  const [devices, setDevices] = useState<Device[]>([]);

  // Reset devices when user logs out
  const effectiveEmail = currentUserEmail || null;
  
  useEffect(() => {
    // If not logged in, show no devices since public access is disabled
    if (!effectiveEmail) {
      // Clear devices when user logs out - this is intentional synchronous state clear
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDevices([]);
      return;
    }

    const devicesRef = collection(db, "devices");
    const q = query(devicesRef, where("allowed_emails", "array-contains", effectiveEmail));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deviceList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Device));
      
      // Sort by last_seen descending
      deviceList.sort((a, b) => (b.last_seen?.seconds || 0) - (a.last_seen?.seconds || 0));
      setDevices(deviceList);
    }, (error) => {
        console.error("Error fetching devices:", error);
    });

    return () => unsubscribe();
  }, [effectiveEmail]);

  const getIcon = useCallback((platform?: string) => {
    if (!platform) return <DefaultDeviceIcon />;
    const p = platform.toLowerCase();
    if (p.includes("win")) return <WindowsIcon />;
    if (p.includes("linux")) return <LinuxIcon />;
    if (p.includes("darwin") || p.includes("mac")) return <AppleIcon />;
    return <DefaultDeviceIcon />;
  }, []);

  return (
    <div className={`w-full bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden shrink-0 ${className}`}>
      <div className="p-4 border-b border-gray-800 shrink-0 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Devices</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pb-20 md:pb-0">
        {devices.map(device => {
            return (
            <button
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-all group ${
                selectedDeviceId === device.id ? "bg-gray-800 border-l-4 border-l-blue-500 shadow-inner" : "border-l-4 border-l-transparent"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3 w-full min-w-0">
                    <div className={`p-1.5 rounded-lg bg-gray-950 border border-gray-800 shadow-sm group-hover:border-gray-700 transition-colors`}>
                        {getIcon(device.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                             <span className="font-semibold text-gray-200 truncate text-sm" title={device.hostname || device.id}>
                                {device.hostname || device.id}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate font-mono mt-0.5">{device.ip}</div>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-gray-900 ${
                       isDeviceConnected(device.last_seen) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'
                    }`} title={isDeviceConnected(device.last_seen) ? 'Connected' : 'Not Connected'} />
                </div>
              </div>
              
              {device.stats && (
                  <div className="flex gap-3 text-[10px] uppercase font-medium text-gray-500 pl-[3.25rem]">
                      <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                          <span className={`w-1 h-1 rounded-full ${device.stats.cpu_percent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                          <span>CPU {device.stats.cpu_percent.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                           <span className={`w-1 h-1 rounded-full ${device.stats.memory_percent > 80 ? 'bg-red-500' : 'bg-purple-500'}`}></span>
                          <span>MEM {device.stats.memory_percent.toFixed(0)}%</span>
                      </div>
                  </div>
              )}
            </button>
        )})}
        {devices.length === 0 && (
            <div className="p-8 text-gray-500 text-sm text-center flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                    <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <span>No devices found</span>
            </div>
        )}
      </div>
    </div>
  );
}