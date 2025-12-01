import { DEFAULT_MAX_RETRIES, RETRY_BASE_DELAY_MS } from "../constants/retry";

/**
 * Checks if an error is a network-related error that should be retried
 */
export function isNetworkError(error: any): boolean {
  return (
    error?.code === 'storage/network-request-failed' ||
    error?.code === 'unavailable' ||
    error?.code === 'deadline-exceeded' ||
    error?.message?.includes('network') ||
    error?.message?.includes('fetch')
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
    } catch (error: any) {
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
