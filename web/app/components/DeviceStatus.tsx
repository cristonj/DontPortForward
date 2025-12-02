"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "../../lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import type { Device } from "../types";
import { 
  RELATIVE_TIME_UPDATE_INTERVAL_MS,
  DEVICE_STATUS_MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  getDeviceDocumentPath
} from "../constants";
import { formatUptime, isNetworkError } from "../utils";
import { LoadingState } from "./ui";
import {
  DeviceStatusHeader,
  ResourceGauges,
  SystemInfoCard,
  ConfigurationCard,
  GitStatusCard,
} from "./device";

interface DeviceStatusProps {
  deviceId: string;
}

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

    const unsub = onSnapshot(doc(db, ...getDeviceDocumentPath(deviceId)), (doc) => {
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
    // localPollingRate intentionally excluded - only set on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // Update relative time at configured interval
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), RELATIVE_TIME_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handlePollingChange = useCallback((value: number) => {
    setLocalPollingRate(value);
  }, []);

  const commitPollingChange = useCallback(async () => {
    if (!device || localPollingRate === null) return;
    for (let attempt = 0; attempt < DEVICE_STATUS_MAX_RETRIES; attempt++) {
      try {
        await updateDoc(doc(db, ...getDeviceDocumentPath(deviceId)), {
          polling_rate: localPollingRate
        });
        return; // Success
      } catch (error: unknown) {
        if (isNetworkError(error) && attempt < DEVICE_STATUS_MAX_RETRIES - 1) {
          const waitTime = Math.pow(2, attempt) * RETRY_BASE_DELAY_MS;
          console.log(`Network error updating polling rate (attempt ${attempt + 1}/${DEVICE_STATUS_MAX_RETRIES}), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error("Error updating polling rate:", error);
          const err = error as { message?: string };
          alert(`Failed to update polling rate${attempt === DEVICE_STATUS_MAX_RETRIES - 1 ? ` after ${DEVICE_STATUS_MAX_RETRIES} attempts` : ''}: ${err?.message || 'Network error'}`);
          return;
        }
      }
    }
  }, [device, deviceId, localPollingRate]);

  if (!deviceId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a device to view status.
      </div>
    );
  }

  if (loading) {
    return <LoadingState message="Loading device status..." />;
  }

  if (!device) {
    return (
      <div className="h-full flex items-center justify-center text-red-500">
        Device not found.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 pb-20 sm:pb-6">
      <DeviceStatusHeader device={device} formatUptime={formatUptime} />
      <ResourceGauges device={device} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SystemInfoCard device={device} />
        <ConfigurationCard
          device={device}
          localPollingRate={localPollingRate}
          onPollingChange={handlePollingChange}
          onPollingCommit={commitPollingChange}
        />
        <GitStatusCard git={device.git} />
      </div>
    </div>
  );
}
