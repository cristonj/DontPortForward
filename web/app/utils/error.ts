/**
 * Utility functions for error handling
 */

/**
 * Extract error message from unknown error type
 * @param error - The error to extract message from
 * @param fallback - Fallback message if error is not an Error instance
 * @returns The error message string
 */
export function getErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}
