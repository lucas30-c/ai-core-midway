import * as fs from 'fs';
import * as path from 'path';
import { loadAiDebtConfig } from '../config.loader';
import { DEFAULT_CONFIG } from '../../../../domain/analyze/config/default.config';
import { UsageError } from '../../../errors/cli.errors';

describe('loadAiDebtConfig', () => {
  const tempDir = path.resolve(__dirname, '../../../../../temp-config-test');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('returns DEFAULT_CONFIG when no config file exists', () => {
    const config = loadAiDebtConfig(tempDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('loads config from --config path', () => {
    const configPath = path.join(tempDir, 'custom.json');
    const customConfig = {
      schemaVersion: '1.0.0',
      layers: [{ name: 'test', match: ['src/**'] }],
      rules: [],
      severity: { boundary: 'MEDIUM', runtime: 'LOW' },
    };
    fs.writeFileSync(configPath, JSON.stringify(customConfig));

    const config = loadAiDebtConfig(tempDir, 'custom.json');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(config.layers).toHaveLength(1);
    expect(config.layers[0].name).toBe('test');
  });

  it('loads config from .ai-debt.json in cwd', () => {
    const configPath = path.join(tempDir, '.ai-debt.json');
    const customConfig = {
      schemaVersion: '2.0.0',
      layers: [{ name: 'layer1', match: ['lib/**'] }],
      rules: [{ from: 'layer1', disallow: [] }],
    };
    fs.writeFileSync(configPath, JSON.stringify(customConfig));

    const config = loadAiDebtConfig(tempDir);
    expect(config.schemaVersion).toBe('2.0.0');
    expect(config.severity).toEqual({ boundary: 'HIGH', runtime: 'LOW' }); // defaults

    fs.unlinkSync(configPath);
  });

  it('throws UsageError for invalid JSON', () => {
    const configPath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(configPath, 'not valid json');

    expect(() => loadAiDebtConfig(tempDir, 'invalid.json')).toThrow(UsageError);
  });

  it('throws UsageError when schemaVersion is missing', () => {
    const configPath = path.join(tempDir, 'no-schema.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ layers: [{ name: 'a', match: [] }], rules: [] })
    );

    expect(() => loadAiDebtConfig(tempDir, 'no-schema.json')).toThrow(
      UsageError
    );
  });

  it('throws UsageError when layers is missing or empty', () => {
    const configPath = path.join(tempDir, 'no-layers.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ schemaVersion: '1.0.0', rules: [] })
    );

    expect(() => loadAiDebtConfig(tempDir, 'no-layers.json')).toThrow(
      UsageError
    );
  });

  it('throws UsageError for duplicate layer names', () => {
    const configPath = path.join(tempDir, 'dup-layers.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        schemaVersion: '1.0.0',
        layers: [
          { name: 'dup', match: ['a/**'] },
          { name: 'dup', match: ['b/**'] },
        ],
        rules: [],
      })
    );

    expect(() => loadAiDebtConfig(tempDir, 'dup-layers.json')).toThrow(
      /duplicate layer name/
    );
  });

  it('normalizes missing severity to defaults', () => {
    const configPath = path.join(tempDir, 'no-sev.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        schemaVersion: '1.0.0',
        layers: [{ name: 'x', match: ['x/**'] }],
        rules: [],
      })
    );

    const config = loadAiDebtConfig(tempDir, 'no-sev.json');
    expect(config.severity).toEqual({ boundary: 'HIGH', runtime: 'LOW' });
  });

  it('allows empty rules array', () => {
    const configPath = path.join(tempDir, 'empty-rules.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        schemaVersion: '1.0.0',
        layers: [{ name: 'y', match: ['y/**'] }],
        rules: [],
      })
    );

    const config = loadAiDebtConfig(tempDir, 'empty-rules.json');
    expect(config.rules).toEqual([]);
  });
});
