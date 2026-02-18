export const SUGGESTED_COMMANDS_LINUX = [
  "ls -la",
  "ps aux",
  "df -h",
  "free -m",
  "uptime",
  "whoami",
  "id",
  "ip addr",
  "netstat -tuln",
  "docker ps",
  "systemctl status",
  "cat /etc/os-release",
  "uname -a",
  "top -b -n 1",
  "pwd",
  "env",
  "cat /proc/cpuinfo",
  "lsblk",
] as const;

export const SUGGESTED_COMMANDS_WINDOWS = [
  "dir",
  "tasklist",
  "systeminfo",
  "whoami",
  "hostname",
  "ipconfig",
  "netstat -an",
  "Get-Process",
  "Get-Service",
  "wmic os get caption,version",
  "wmic cpu get name",
  "Get-Volume",
  "pwd",
  "set",
] as const;

// Default fallback (Linux commands for backwards compatibility)
export const SUGGESTED_COMMANDS = SUGGESTED_COMMANDS_LINUX;
export type SuggestedCommand = (typeof SUGGESTED_COMMANDS_LINUX)[number] | (typeof SUGGESTED_COMMANDS_WINDOWS)[number];

// Console polling constants
export const CONSOLE_POLLING_INTERVAL_MS = 30000; // 30 seconds
export const CONSOLE_LAST_ACTIVITY_THRESHOLD_MS = 30000; // 30 seconds
export const CONSOLE_OUTPUT_REQUEST_TIMEOUT_SECONDS = 60;
export const CONSOLE_MAX_CONSECUTIVE_ERRORS = 5;
export const CONSOLE_ERROR_BACKOFF_MS = 60000; // 1 minute
export const CONSOLE_MAX_LOGS_TO_UPDATE = 2;
export const CONSOLE_HISTORY_LIMIT = 50;
export const CONSOLE_REFRESH_DELAY_MS = 500;
export const CONSOLE_ACTIVE_REFRESH_INTERVAL_MS = 15000; // 15 seconds - auto-refresh while commands active
export const COMMAND_MAX_LENGTH = 10000;
