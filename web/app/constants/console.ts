export const SUGGESTED_COMMANDS = [
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

export type SuggestedCommand = (typeof SUGGESTED_COMMANDS)[number];

