import * as fs from 'fs';
import * as path from 'path';
import { FileReadError } from '../errors/cli.errors';

export async function readDiffFile(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);

  try {
    const content = await fs.promises.readFile(resolved, 'utf-8');
    const trimmed = content.trim();

    if (trimmed.length === 0) {
      throw new FileReadError(`Diff file is empty: ${resolved}`);
    }

    return trimmed;
  } catch (err: any) {
    if (err instanceof FileReadError) throw err;
    throw new FileReadError(
      `Cannot read diff file: ${resolved} (${err.message})`
    );
  }
}
