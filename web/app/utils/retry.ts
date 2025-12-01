import { DEFAULT_MAX_RETRIES, RETRY_BASE_DELAY_MS } from "../constants/retry";

/**
 * Checks if an error is a network-related error that should be retried
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === 'storage/network-request-failed' ||
    err.code === 'unavailable' ||
    err.code === 'deadline-exceeded' ||
    (err.message?.includes('network') ?? false) ||
    (err.message?.includes('fetch') ?? false)
  );
}

/**
 * Retry helper for network operations with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (isNetworkError(error) && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * RETRY_BASE_DELAY_MS;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Retry failed');
}
