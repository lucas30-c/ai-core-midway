import * as path from 'path';
import { existsSync } from 'fs';

/**
 * Find nearest tsconfig.json by traversing upward from file path.
 * Returns null if no tsconfig found (including root directory check).
 */
export function findNearestTsconfig(filePath: string): string | null {
  let dir = path.dirname(path.resolve(filePath));
  const root = path.parse(dir).root;

  // Check from current dir up to and including root
  while (true) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }

  return null;
}
