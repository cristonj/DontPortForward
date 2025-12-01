"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { Device } from "../types";
import { isDeviceConnected } from "../utils";

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
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.002c-.06-.135-.12-.2-.283-.334-.18-.135-.38-.271-.59-.465a14.457 14.457 0 01-.388-.333c-.12-.1-.166-.138-.175-.14h-.006c-.498-.329-.897-.601-1.222-.869-.321-.268-.569-.536-.714-.67v-.001h-.005c-.14-.133-.225-.2-.32-.334-.096-.132-.201-.332-.352-.464h-.003c-.254-.268-.596-.668-.91-1.097-.316-.465-.601-.998-.735-1.482v.003c-.049-.133-.08-.133-.108-.066-.03.2-.043.465-.043.732 0 .599.105 1.264.258 1.936.09.399.168.733.218 1.068-.018-.065-.036-.132-.053-.198-.129-.6-.213-1.265-.246-1.936-.035-.669.033-1.336.198-2.003.165-.669.463-1.268.879-1.802-.097.466-.14.936-.14 1.405 0 .63.084 1.265.155 1.868.071.603.11 1.103.056 1.469-.015.133-.044.198-.074.265-.03.066-.06.133-.046.2.015.066.042.099.117.164.076.065.205.132.369.2.164.067.363.132.53.197.166.066.296.067.353.067.233 0 .438-.068.663-.136a2.68 2.68 0 00.675-.335c.079-.065.156-.129.199-.13h.004c.16.006.302.041.439.078.137.038.272.077.402.093a.87.87 0 00.33-.064.327.327 0 00.18-.138v-.001h.001c.16-.302-.011-.47-.322-.668-.154-.098-.307-.198-.43-.334a1.854 1.854 0 01-.296-.468c-.01-.02-.016-.038-.02-.057-.012.133-.023.2-.046.267-.022.067-.054.133-.095.2-.041.065-.095.131-.172.196a.494.494 0 01-.271.132h-.039c-.033 0-.063-.006-.089-.016l-.02-.009c-.027-.014-.05-.027-.07-.04a1.097 1.097 0 01-.177-.198 2.032 2.032 0 01-.188-.398c-.038-.133-.062-.2-.054-.266.006-.065.024-.131.04-.198.017-.065.034-.132.048-.198.012-.067.018-.133-.01-.199a.393.393 0 00-.175-.165h-.003c-.04-.02-.074-.065-.107-.107-.032-.043-.057-.086-.068-.129a.473.473 0 01-.009-.2c.012-.066.03-.133.047-.198.016-.066.03-.133.03-.2v-.065c-.086.155-.204.292-.348.406-.144.112-.31.2-.497.26a1.664 1.664 0 01-.569.066 2.178 2.178 0 01-.586-.134c-.198-.082-.395-.2-.577-.335-.182-.132-.345-.27-.473-.397a3.015 3.015 0 01-.329-.398 1.633 1.633 0 01-.199-.398c-.049-.134-.064-.2-.063-.335 0-.132.017-.265.067-.398.05-.133.117-.266.217-.399.097-.133.224-.265.382-.398.156-.131.346-.263.569-.396a9.12 9.12 0 00-.461-.198 2.67 2.67 0 00-.498-.133 2.49 2.49 0 00-.518-.066h-.007z"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-300 shrink-0" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
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