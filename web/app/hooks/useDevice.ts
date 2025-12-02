"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "../../lib/firebase";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  onSnapshot,
} from "firebase/firestore";
import type { Device } from "../types";

interface UseDeviceReturn {
  selectedDeviceId: string;
  selectedDevice: Device | null;
  handleDeviceSelect: (id: string) => void;
  sendCommand: (command: string) => Promise<void>;
  handleRestart: () => Promise<void>;
}

export function useDevice(): UseDeviceReturn {
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("selectedDeviceId") || "";
    }
    return "";
  });
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Subscribe to selected device data
  useEffect(() => {
    if (!selectedDeviceId) {
      // Clear selected device when no device is selected - intentional synchronous state clear
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDevice(null);
      return;
    }

    const unsub = onSnapshot(doc(db, "devices", selectedDeviceId), (docSnap) => {
      if (docSnap.exists()) {
        setSelectedDevice({ id: docSnap.id, ...docSnap.data() } as Device);
      } else {
        setSelectedDevice(null);
      }
    });

    return () => unsub();
  }, [selectedDeviceId]);

  // Periodically refresh connection status
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render for connection status check
      setSelectedDevice(prev => prev ? { ...prev } : null);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeviceSelect = useCallback((id: string) => {
    setSelectedDeviceId(id);
    localStorage.setItem("selectedDeviceId", id);
  }, []);

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || !selectedDeviceId) return;

    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      await addDoc(commandsRef, {
        command,
        type: 'shell',
        status: 'pending',
        created_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending command:", error);
    }
  }, [selectedDeviceId]);

  const handleRestart = useCallback(async () => {
    if (!selectedDeviceId) return;
    if (!confirm("Are you sure you want to restart the agent on this device?")) return;
    
    try {
      const commandsRef = collection(db, "devices", selectedDeviceId, "commands");
      await addDoc(commandsRef, {
        type: 'restart',
        command: 'Restart Agent', 
        status: 'pending',
        created_at: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending restart command:", error);
      alert("Failed to send restart command");
    }
  }, [selectedDeviceId]);

  return {
    selectedDeviceId,
    selectedDevice,
    handleDeviceSelect,
    sendCommand,
    handleRestart,
  };
}
