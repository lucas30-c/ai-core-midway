middleware：请求进来先做统一动作（requestId）

filter：出错统一兜底（错误协议 + 日志）

ctx：请求上下文（就像前端拦截器里的 config + response 的集合）
ctx 不是“神奇对象”。

它只是：

把 Node 原生的 req / res 封装进一个更方便的对象里。

而这个机制来自：

Koa

不是 Midway 特有的。

每次请求都是独立的ctx，每次请求有独立的请求作用域ctx。
middleware 和 controller 共享同一个 ctx