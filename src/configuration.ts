import 'dotenv/config';
import { Configuration } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import { Application } from '@midwayjs/koa';
import { join } from 'path';
import { TraceMiddleware } from './common/middleware/trace.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AccessLogMiddleware } from './common/middleware/access-log.middleware';
import { GlobalErrorFilter } from './common/filters/global-error.filter';
import { ChatModule } from './modules/chat/chat.module';
import { AnalyzeModule } from './modules/analyze/analyze.module';

@Configuration({
  imports: [koa, ChatModule, AnalyzeModule],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  async onReady(_container, app: Application) {
    app.useMiddleware([
      TraceMiddleware,
      RequestIdMiddleware,
      AccessLogMiddleware,
    ]);
    app.useFilter([GlobalErrorFilter]);
  }
}
