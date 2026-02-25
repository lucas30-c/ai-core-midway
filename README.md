🧠 tech-debt

面向工程实践的 PR 影响面分析工具
Deterministic 静态分析 + 本地知识库 (RAG) + 安全 LLM 增强

📌 项目简介

tech-debt 是一个用于分析 Git 代码变更影响面的 CLI 工具。

它的目标不是“生成漂亮报告”，而是：

帮你判断这次改动会影响哪些层

是否违反架构边界

有哪些潜在风险点

需要补充哪些回归测试

是否触发技术债规则

工具核心思想：

先做完全 deterministic 的工程分析，再用 LLM 进行语义增强，但绝不改变事实。

✨ 核心能力
Phase 1 — 工程级确定性分析

Git diff 解析

AST 规则引擎

分层架构校验（boundary rules）

风险等级计算

影响面聚合（touchedAreas / riskPoints）

Markdown / JSON 双输出

严格 schemaVersion 2.0.0

Phase 2 — 语义增强能力

可选启用：

本地知识库检索（SQLite + FTS5）

增量索引（hash 对比）

可选 Embedding 相似度检索

LLM 安全增强（仅增强 summary 和 checklist）

如果 LLM 或 KB 不可用：

工具自动优雅降级，不影响基础分析结果。

🚀 安装

全局安装：

npm install -g @finn_ryu/tech-debt

或项目内使用：

npm install --save-dev @finn_ryu/tech-debt
🛠 基础用法
1️⃣ 最简单用法（只做确定性分析）
tech-debt analyze --git-range origin/main..HEAD

适用于：

日常 PR 自查

CI 预检查

不需要知识库和 LLM

2️⃣ 指定工作目录
tech-debt analyze \
  --git-range HEAD~1..HEAD \
  --cwd ./my-project

适用于：

monorepo

外部 repo 分析

CI 指定工作目录

3️⃣ 输出 JSON（用于 CI 或系统集成）
tech-debt analyze \
  --git-range origin/main..HEAD \
  --format json

输出结构：

{
  "schemaVersion": "2.0.0",
  "engine": { "name": "...", "version": "..." },
  "analysis": {
    "schemaVersion": "2.0.0",
    "summary": {...},
    "items": [...],
    "impact": {...}
  }
}
4️⃣ 输出 Markdown 报告
tech-debt analyze \
  --git-range origin/main..HEAD \
  --format markdown

适用于：

直接贴到 PR 评论

内部评审报告

周报

📚 使用本地知识库（RAG）

当你希望：

让分析结合架构文档

引入 ADR

结合内部规范说明

使用：

tech-debt analyze \
  --git-range origin/main..HEAD \
  --kb-dir ./docs \
  --kb-dir ./adr

支持：

多目录

默认扫描 **/*.md

自动增量索引

索引存储在：

.project-root/.tech-debt/
  ├── kb.sqlite
  └── meta.json
禁用知识库
tech-debt analyze --kb-off

适用于：

CI 场景

只做快速 deterministic 校验

🤖 启用 LLM 增强

LLM 是可选的。

方式一：使用 OpenAI 兼容接口

环境变量：

export TECH_DEBT_LLM_PROVIDER=openai-compatible
export TECH_DEBT_LLM_MODEL=gpt-4o-mini
export TECH_DEBT_LLM_BASE_URL=https://api.openai.com
export TECH_DEBT_LLM_API_KEY=xxx

然后执行：

tech-debt analyze --git-range HEAD~1..HEAD
方式二：使用 mock（测试用）
export TECH_DEBT_LLM_PROVIDER=mock
export TECH_DEBT_LLM_MODEL=mock
禁用 LLM
tech-debt analyze --llm-off
🧩 CLI 参数说明
参数	说明
--git-range	Git diff 范围
--cwd	指定工作目录
--config	指定配置文件
--format	json / markdown
--kb-dir	知识库目录（可重复）
--kb-glob	知识库匹配规则
--kb-off	禁用知识库
--llm-off	禁用 LLM
--llm-provider	指定 LLM 类型
--llm-model	指定模型
--llm-base-url	指定 API 地址
--llm-api-key	指定 API Key
⚙ 配置文件说明

.ai-debt.json

示例：

{
  "schemaVersion": "2.0.0",
  "layers": [
    { "name": "domain", "match": ["src/domain/**"] },
    { "name": "pages", "match": ["src/pages/**"] }
  ],
  "rules": [
    {
      "id": "ast-boundary",
      "from": "pages",
      "to": ["domain"],
      "disallow": []
    }
  ]
}
🔐 安全模型

LLM 只能：

替换 impact.summary

追加回归测试建议

LLM 不能：

修改 riskPoints

修改 touchedAreas

修改 deterministic findings

若 LLM 失败：

报告仍然有效

🧪 测试覆盖

150+ 单元测试

FTS5 检索验证

Embedding BLOB roundtrip

JSON 严格解析

LLM 失败回退测试

增量索引测试

🏗 架构概览
CLI
 ├── Diff 解析
 ├── 确定性规则引擎
 ├── Impact Builder
 ├── Knowledge Provider
 │     ├── SQLite
 │     ├── FTS5
 │     └── Embedding
 ├── LLM Provider
 └── Report Renderer
📈 适用场景

PR 影响面分析

技术债监控

架构边界守护

CI 自动风险评估

架构文档增强分析

🗺 Roadmap

GitHub Action 集成

Hybrid 知识库（本地 + API）

更细粒度风险模型

CI 阻断策略

Web UI 可视化

📜 License

MIT