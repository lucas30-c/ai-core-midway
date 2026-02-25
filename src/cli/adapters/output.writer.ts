import * as fs from 'fs';
import * as path from 'path';
import { CliError } from '../errors/cli.errors';

export async function writeOutput(
  content: string,
  outPath?: string
): Promise<void> {
  if (!outPath) {
    process.stdout.write(content + '\n');
    return;
  }

  const resolved = path.resolve(outPath);
  try {
    await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
    await fs.promises.writeFile(resolved, content, 'utf-8');
  } catch (err: any) {
    throw new CliError(
      `Failed to write output file: ${resolved} (${err.message})`
    );
  }
}
