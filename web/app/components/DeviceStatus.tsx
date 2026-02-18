"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "../../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { Device } from "../types";
import {
  RELATIVE_TIME_UPDATE_INTERVAL_MS,
  DEVICE_STATUS_MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  getDeviceDocumentPath
} from "../constants";
import { formatUptime, isNetworkError } from "../utils";
import { LoadingState, useToast } from "./ui";
import {
  DeviceStatusHeader,
  ResourceGauges,
  SystemInfoCard,
  ConfigurationCard,
  GitStatusCard,
} from "./device";

interface DeviceStatusProps {
  deviceId: string;
  device: Device | null;
}

export default function DeviceStatus({ deviceId, device }: DeviceStatusProps) {
  const { toast } = useToast();
  const [localPollingRate, setLocalPollingRate] = useState<number | null>(null);
  const [, setTick] = useState(0); // Force re-render for relative time

  // Initialize localPollingRate from device prop on first load
  useEffect(() => {
    if (device && localPollingRate === null && device.polling_rate) {
      setLocalPollingRate(device.polling_rate);
    }
  }, [device, localPollingRate]);

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
          toast(`Failed to update polling rate${attempt === DEVICE_STATUS_MAX_RETRIES - 1 ? ` after ${DEVICE_STATUS_MAX_RETRIES} attempts` : ''}: ${err?.message || 'Network error'}`, "error");
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

  if (!device) {
    return <LoadingState message="Loading device status..." />;
  }

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-gray-800 pb-20 sm:pb-6">
      <DeviceStatusHeader device={device} formatUptime={formatUptime} />
      <ResourceGauges device={device} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
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
