/**
 * Normalize file path to POSIX format for cross-platform glob matching.
 * MUST be used in all layer matching operations.
 */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
