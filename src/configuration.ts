import 'dotenv/config';
import { Configuration } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import { Application } from '@midwayjs/koa';
import { join } from 'path';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { GlobalErrorFilter } from './common/filters/global-error.filter';
import { ChatModule } from './modules/chat/chat.module';

@Configuration({
  imports: [koa, ChatModule],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  async onReady(_container, app: Application) {
    app.useMiddleware([RequestIdMiddleware]);
    app.useFilter([GlobalErrorFilter]);
  }
}