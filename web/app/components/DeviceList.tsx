"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface Device {
  id: string;
  hostname: string;
  ip: string;
  status: string;
  last_seen: any;
  stats?: {
    cpu_percent: number;
    memory_percent: number;
  };
}

interface DeviceListProps {
  onSelectDevice: (deviceId: string) => void;
  selectedDeviceId?: string;
}

export default function DeviceList({ onSelectDevice, selectedDeviceId }: DeviceListProps) {
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
      setDevices(deviceList);
    }, (error) => {
        console.error("Error fetching devices:", error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 border-b border-gray-800">
        <h2 className="font-bold text-gray-200">Devices</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {devices.map(device => {
            // Check if device is effectively offline (no update in > 2 mins)
            // Ideally we compare timestamps, but for now we trust the status or just show it.
            return (
            <button
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              className={`w-full text-left p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                selectedDeviceId === device.id ? "bg-gray-800 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-300 truncate w-32" title={device.hostname || device.id}>
                    {device.hostname || device.id}
                </span>
                <span className={`w-2 h-2 rounded-full ${
                   device.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
              <div className="text-xs text-gray-500 mb-1 truncate">{device.ip}</div>
              {device.stats && (
                  <div className="flex gap-2 text-xs text-gray-400">
                      <span title="CPU">C: {Math.round(device.stats.cpu_percent)}%</span>
                      <span title="Memory">M: {Math.round(device.stats.memory_percent)}%</span>
                  </div>
              )}
            </button>
        )})}
        {devices.length === 0 && (
            <div className="p-4 text-gray-500 text-sm text-center">No devices found</div>
        )}
      </div>
    </div>
  );
}
