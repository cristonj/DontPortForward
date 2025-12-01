import { LOG_OUTPUT_MAX_LINES } from "../constants/ui";

/**
 * Gets the last N lines of text
 */
export function getLastLines(text: string | undefined, maxLines: number = LOG_OUTPUT_MAX_LINES): string {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(-maxLines).join('\n');
}
