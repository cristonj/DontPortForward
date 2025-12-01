import type { Timestamp } from "firebase/firestore";

/**
 * Gets relative time string (e.g., "5m ago", "2h ago")
 */
export function getRelativeTime(
  timestamp: Timestamp | Date | number | string | null | undefined
): string {
  if (!timestamp) return "Never";
  
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
    date = (timestamp as Timestamp).toDate();
  } else {
    date = new Date(timestamp as number | string);
  }
  
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Formats a timestamp to a localized date string
 */
export function formatDate(
  timestamp: Timestamp | Date | number | string | null | undefined
): string {
  if (!timestamp) return "Unknown";
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }
  if (
    typeof timestamp === 'object' &&
    'toDate' in timestamp &&
    typeof (timestamp as Timestamp).toDate === 'function'
  ) {
    return (timestamp as Timestamp).toDate().toLocaleString();
  }
  return new Date(timestamp as number | string).toLocaleString();
}

/**
 * Formats uptime from boot time (seconds since epoch)
 */
export function formatUptime(bootTime?: number | null): string {
  if (!bootTime) return "Unknown";
  const now = Date.now() / 1000;
  const uptimeSeconds = now - bootTime;
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}
