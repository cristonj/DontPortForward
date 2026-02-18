"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "../../../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { Device } from "../../types";
import { getDeviceDocumentPath } from "../../constants";
import { LoadingState, useToast } from "../ui";
import { InfoIcon, SaveIcon, WarningIcon } from "../Icons";

interface ConfigViewProps {
  deviceId: string;
  device: Device | null;
}

interface ConfigField {
  key: keyof Device;
  label: string;
  description: string;
  type: 'number' | 'text';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: 'polling_rate',
    label: 'Active Polling Rate',
    description: 'How often the agent checks for new commands when active (in seconds)',
    type: 'number',
    min: 1,
    max: 120,
    step: 1,
    unit: 's'
  },
  {
    key: 'sleep_polling_rate',
    label: 'Sleep Polling Rate',
    description: 'How often the agent checks for new commands when in sleep mode (in seconds)',
    type: 'number',
    min: 10,
    max: 300,
    step: 5,
    unit: 's'
  },
  {
    key: 'idle_timeout',
    label: 'Idle Timeout',
    description: 'Time without activity before agent enters sleep mode (in seconds)',
    type: 'number',
    min: 30,
    max: 600,
    step: 10,
    unit: 's'
  },
  {
    key: 'heartbeat_interval',
    label: 'Heartbeat Interval',
    description: 'How often long-running commands send a heartbeat to show they are alive (in seconds)',
    type: 'number',
    min: 10,
    max: 300,
    step: 10,
    unit: 's'
  },
  {
    key: 'max_output_chars',
    label: 'Max Output Size',
    description: 'Maximum characters of command output stored in Firestore',
    type: 'number',
    min: 10000,
    max: 500000,
    step: 10000,
    unit: ' chars'
  },
  {
    key: 'startup_file',
    label: 'Startup File',
    description: 'Script in the shared folder to run automatically on agent start',
    type: 'text',
    placeholder: 'e.g., startup.py or init.sh'
  }
];

function getConfigFromDevice(device: Device): Partial<Device> {
  return {
    polling_rate: device.polling_rate ?? 30,
    sleep_polling_rate: device.sleep_polling_rate ?? 60,
    idle_timeout: device.idle_timeout ?? 60,
    heartbeat_interval: device.heartbeat_interval ?? 60,
    max_output_chars: device.max_output_chars ?? 50000,
    startup_file: device.startup_file ?? '',
  };
}

export default function ConfigView({ deviceId, device }: ConfigViewProps) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<Partial<Device>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize local config from device prop only once per device
  useEffect(() => {
    if (device && !initialized) {
      setLocalConfig(getConfigFromDevice(device));
      setInitialized(true);
      setHasChanges(false);
    }
  }, [device, initialized]);

  // Reset initialized flag when device changes
  useEffect(() => {
    setInitialized(false);
  }, [deviceId]);

  const handleChange = useCallback((key: keyof Device, value: string | number) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!device) return;

    setSaving(true);
    try {
      const updates: Partial<Device> = {};

      for (const field of CONFIG_FIELDS) {
        const value = localConfig[field.key];
        if (value !== undefined && value !== device[field.key]) {
          if (field.type === 'number') {
            updates[field.key] = Number(value) as never;
          } else {
            updates[field.key] = (value || null) as never;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, ...getDeviceDocumentPath(deviceId)), updates);
      }

      setHasChanges(false);
    } catch (error) {
      console.error("Error saving config:", error);
      toast("Failed to save configuration. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }, [device, deviceId, localConfig]);

  const handleReset = useCallback(() => {
    if (!device) return;
    setLocalConfig(getConfigFromDevice(device));
    setHasChanges(false);
  }, [device]);

  if (!deviceId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a device to configure.
      </div>
    );
  }

  if (!device) {
    return <LoadingState message="Loading configuration..." />;
  }

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-gray-800 pb-20 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Agent Configuration</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{device.hostname || device.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              hasChanges && !saving
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <SaveIcon className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <WarningIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-300">Configuration Notice</h4>
          <p className="text-xs text-amber-200/70 mt-1">
            Changes to configuration will only take effect after the agent restarts. Use the restart button in the header or send a <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono">restart</code> command.
          </p>
        </div>
      </div>

      {/* Config Fields */}
      <div className="space-y-4">
        {CONFIG_FIELDS.map((field) => (
          <ConfigFieldCard
            key={field.key}
            field={field}
            value={localConfig[field.key] as string | number}
            originalValue={device[field.key] as string | number}
            onChange={(value) => handleChange(field.key, value)}
          />
        ))}
      </div>

      {/* Info Section */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mt-6">
        <div className="flex items-start gap-3">
          <InfoIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-300">About Agent Configuration</h4>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              These settings control how the agent behaves on this device. The polling rates affect how responsive
              the agent is to new commands and how much network traffic it generates. The idle timeout determines
              when the agent enters a low-power sleep mode to reduce resource usage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConfigFieldCardProps {
  field: ConfigField;
  value: string | number;
  originalValue: string | number | undefined;
  onChange: (value: string | number) => void;
}

function ConfigFieldCard({ field, value, originalValue, onChange }: ConfigFieldCardProps) {
  const hasChanged = value !== originalValue && value !== undefined;

  return (
    <div className={`bg-gray-900/50 border rounded-xl p-4 transition-all ${
      hasChanged ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/5' : 'border-gray-800 hover:border-gray-700'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            {field.label}
            {hasChanged && (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-normal">
                Modified
              </span>
            )}
          </label>
          <p className="text-xs text-gray-500 mt-1">{field.description}</p>
        </div>
        <div className="sm:w-48">
          {field.type === 'number' ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={value ?? ''}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
              />
              {field.unit && (
                <span className="text-xs text-gray-500 font-mono shrink-0">{field.unit}</span>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={value ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          )}
        </div>
      </div>
    </div>
  );
}
