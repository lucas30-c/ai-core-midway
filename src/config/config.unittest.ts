import { MidwayConfig } from '@midwayjs/core';

export default {
  koa: {
    port: null,
  },
  midwayLogger: {
    default: {
      // 单测不落盘，避免 symlink/权限/目录问题
      enableFile: false,
      enableError: false,
      enableConsole: true,
    },
    clients: {
      coreLogger: { enableFile: false, enableError: false, enableConsole: true },
      appLogger: { enableFile: false, enableError: false, enableConsole: true },
    },
  },
} as MidwayConfig;
