"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface Device {
  id: string;
  hostname: string;
  ip: string;
  status: string;
  platform?: string;
  last_seen: any;
  stats?: {
    cpu_percent: number;
    memory_percent: number;
  };
  allowed_emails?: string[];
}

interface DeviceListProps {
  onSelectDevice: (deviceId: string) => void;
  selectedDeviceId?: string;
  className?: string;
  currentUserEmail?: string | null;
}

const WindowsIcon = () => (
  <svg viewBox="0 0 88 88" className="w-5 h-5 text-blue-400 shrink-0" fill="currentColor">
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.01 46.12zm4.355-38.66l47.961-6.78v41.36l-47.961.275zm47.947 38.83l-.03 41.51-47.93-6.843.016-34.413z"/>
  </svg>
);

const LinuxIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-yellow-500 shrink-0" fill="currentColor">
    <path d="M20 19v-8c0-1.1-.9-2-2-2h-3.5l-2.5-3-2.5 3H6c-1.1 0-2 .9-2 2v8h16zM6 11h3.5l2.5-3 2.5 3H18v8H6v-8z" />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-300 shrink-0" fill="currentColor">
    <path d="M17.3 7c.7-1.3 1.4-1.6 1.3-3-.6.1-1.3.6-1.9 1.3-.7.7-1.1 1.6-1 2.5 1 .1 1.6-.4 2.2-1.2zM12.6 19.8c.8 1.1 1.6 1.2 2.7.6.6-.3 1.3-.4 1.9 0 1.1.7 1.9.6 2.7-.6 1.7-2.5 2.4-5.2 1-7.7-1-1.7-2.8-2.7-4.5-2.6-1.7.1-3 1-3.9 1-.9 0-2.3-1-3.6-1-1.8 0-3.6 1.1-4.6 2.8-1.9 3.4-.2 8.4 1.8 11.2.9 1.4 2.1 3 3.5 3 .9 0 1.9-.4 3-.7z"/>
  </svg>
);

const DefaultIcon = () => (
   <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
       <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
       <line x1="8" y1="21" x2="16" y2="21" />
       <line x1="12" y1="17" x2="12" y2="21" />
   </svg>
);

export default function DeviceList({ onSelectDevice, selectedDeviceId, className = "", currentUserEmail }: DeviceListProps) {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    // Note: 'orderBy' might require an index in Firestore. 
    // If it fails, we can remove orderBy or create the index.
    const q = query(collection(db, "devices"), orderBy("last_seen", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deviceList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Device));
      
      const filteredDevices = deviceList.filter(device => {
        if (!device.allowed_emails || device.allowed_emails.length === 0) return true;
        if (!currentUserEmail) return false;
        return device.allowed_emails.includes(currentUserEmail);
      });

      setDevices(filteredDevices);
    }, (error) => {
        console.error("Error fetching devices:", error);
    });

    return () => unsubscribe();
  }, [currentUserEmail]);

  const getIcon = (platform?: string) => {
    if (!platform) return <DefaultIcon />;
    const p = platform.toLowerCase();
    if (p.includes("win")) return <WindowsIcon />;
    if (p.includes("linux")) return <LinuxIcon />;
    if (p.includes("darwin") || p.includes("mac")) return <AppleIcon />;
    return <DefaultIcon />;
  };

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
                       device.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-600'
                    }`} />
                </div>
              </div>
              
              {device.stats && (
                  <div className="flex gap-3 text-[10px] uppercase font-medium text-gray-500 pl-[3.25rem]">
                      <div className="flex items-center gap-1">
                          <span className={`w-1 h-1 rounded-full ${device.stats.cpu_percent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                          <span>CPU {Math.round(device.stats.cpu_percent)}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                           <span className={`w-1 h-1 rounded-full ${device.stats.memory_percent > 80 ? 'bg-red-500' : 'bg-purple-500'}`}></span>
                          <span>MEM {Math.round(device.stats.memory_percent)}%</span>
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