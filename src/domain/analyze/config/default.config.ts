import { AiDebtConfig } from './config.types';

export const DEFAULT_CONFIG: AiDebtConfig = {
  schemaVersion: '1.0.0',
  layers: [
    { name: 'pages', match: ['src/pages/**'] },
    { name: 'modules', match: ['src/modules/**'] },
    { name: 'domain', match: ['src/domain/**'] },
    { name: 'infra', match: ['src/infra/**', 'src/db/**'] },
  ],
  rules: [
    { from: 'pages', disallow: ['domain', 'infra'] },
    { from: 'modules', disallow: ['infra'] },
    { from: 'domain', disallow: ['infra'] },
  ],
  severity: { boundary: 'HIGH', runtime: 'LOW' },
};
