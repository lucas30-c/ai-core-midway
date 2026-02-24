import { MidwayConfig } from '@midwayjs/core';

export default {
  keys: 'replace-with-your-keys',
  midwayLogger: {
    default: {
      level: 'info',
    },
  },

  ai: {
    provider: 'openrouter', // 后面可切换
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      appUrl: process.env.OPENROUTER_APP_URL || 'http://localhost:7001',
      appName: process.env.OPENROUTER_APP_NAME || 'ai-core-midway',
      model: process.env.OPENROUTER_MODEL || 'qwen/qwen3.5-plus-2026-02-15',
      fallbackModel: process.env.FALLBACK_MODEL || 'deepseek/deepseek-chat',
    },
  },
} as MidwayConfig;