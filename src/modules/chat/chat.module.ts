import { Configuration } from '@midwayjs/core';
import * as validate from '@midwayjs/validate';

@Configuration({
  namespace: 'chat',
  imports: [validate],
})
export class ChatConfiguration {}

// 导出为标准 Midway 组件格式
export const ChatModule = {
  Configuration: ChatConfiguration,
};
