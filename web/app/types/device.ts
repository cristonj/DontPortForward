import type { Timestamp } from "firebase/firestore";

export interface GitInfo {
  branch: string;
  commit: string;
  is_dirty: boolean;
  last_commit_date: string;
}

export interface DeviceStats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent?: number;
  boot_time?: number;
}

export interface Device {
  id: string;
  hostname?: string;
  ip?: string;
  status?: string;
  platform?: string;
  release?: string;
  version?: string;
  last_seen?: Timestamp | null;
  stats?: DeviceStats;
  git?: GitInfo;
  mode?: string;
  polling_rate?: number;
  sleep_polling_rate?: number;
  allowed_emails?: string[];
  startup_file?: string | null;
}

