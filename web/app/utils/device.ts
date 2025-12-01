import type { Timestamp } from "firebase/firestore";
import { DEVICE_CONNECTION_TIMEOUT_MS } from "../constants/ui";

/**
 * Checks if device is connected (seen within configured timeout)
 */
export function isDeviceConnected(lastSeen: Timestamp | null | undefined): boolean {
  if (!lastSeen) return false;
  const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen as unknown as number);
  const timeoutAgo = Date.now() - DEVICE_CONNECTION_TIMEOUT_MS;
  return lastSeenDate.getTime() > timeoutAgo;
}
