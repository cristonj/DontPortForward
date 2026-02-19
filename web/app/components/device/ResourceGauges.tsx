"use client";

import { memo } from "react";
import type { Device } from "../../types";

interface ResourceGaugesProps {
  device: Device;
}

export const ResourceGauges = memo(function ResourceGauges({ device }: ResourceGaugesProps) {
  const cpuPercent = device.stats?.cpu_percent ?? 0;
  const memoryPercent = device.stats?.memory_percent ?? 0;
  const diskPercent = device.stats?.disk_percent ?? 0;
  const diskFreeGb = device.stats?.disk_free != null
    ? (device.stats.disk_free / 1073741824).toFixed(1)
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <ResourceGauge
        label="CPU"
        value={cpuPercent}
        icon={<CpuIcon />}
        colorClass="blue"
        thresholds={{ warning: 50, danger: 80 }}
      />
      <ResourceGauge
        label="Memory"
        value={memoryPercent}
        icon={<MemoryIcon />}
        colorClass="purple"
        thresholds={{ warning: 60, danger: 80 }}
      />
      <ResourceGauge
        label="Disk"
        value={diskPercent}
        icon={<DiskIcon />}
        colorClass="amber"
        thresholds={{ warning: 70, danger: 90 }}
        showNA={device.stats?.disk_percent === undefined}
        subLabel={diskFreeGb != null ? `${diskFreeGb} GB free` : undefined}
      />
    </div>
  );
});

interface ResourceGaugeProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: 'blue' | 'purple' | 'amber';
  thresholds: { warning: number; danger: number };
  showNA?: boolean;
  subLabel?: string;
}

const ResourceGauge = memo(function ResourceGauge({
  label,
  value,
  icon,
  colorClass,
  thresholds,
  showNA = false,
  subLabel,
}: ResourceGaugeProps) {
  const colorMap = {
    blue: {
      bg: 'from-blue-500/5',
      iconBg: 'bg-blue-500/10',
      bar: 'bg-blue-500',
    },
    purple: {
      bg: 'from-purple-500/5',
      iconBg: 'bg-purple-500/10',
      bar: 'bg-purple-500',
    },
    amber: {
      bg: 'from-amber-500/5',
      iconBg: 'bg-amber-500/10',
      bar: 'bg-amber-500',
    },
  };

  const colors = colorMap[colorClass];
  const barColor = value > thresholds.danger ? 'bg-red-500' : value > thresholds.warning ? 'bg-yellow-500' : colors.bar;

  return (
    <div className="relative bg-gray-900/50 rounded-2xl border border-gray-800 p-4 sm:p-5 overflow-hidden group hover:border-gray-700 transition-colors">
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} to-transparent`}></div>
      <div className="relative">
        {/* Mobile: horizontal layout, Desktop: vertical layout */}
        <div className="flex sm:block items-center gap-4">
          <div className="flex items-center gap-2 sm:mb-3 shrink-0">
            <div className={`p-1.5 rounded-lg ${colors.iconBg}`}>
              {icon}
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
          </div>
          <div className="flex-1 sm:flex-none flex sm:block items-center gap-3 sm:gap-0">
            <div className="flex sm:block items-baseline gap-2 sm:mb-2 shrink-0">
              <div className="text-2xl sm:text-3xl font-bold text-white">
                {showNA ? 'N/A' : `${value.toFixed(1)}%`}
              </div>
              {subLabel && (
                <div className="text-xs text-gray-500 sm:mt-0.5">{subLabel}</div>
              )}
            </div>
            <div className="flex-1 sm:w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(value, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const CpuIcon = memo(function CpuIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
});

const MemoryIcon = memo(function MemoryIcon() {
  return (
    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
});

const DiskIcon = memo(function DiskIcon() {
  return (
    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
});
