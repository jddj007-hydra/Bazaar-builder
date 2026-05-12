# Build Finder

这是给 Bazaar Build Finder 预留的独立工作目录。当前只初始化了原始数据区，还没有开始写应用逻辑。

## App Workflow

当前实现是一个静态、无数据库的理论构筑生成器和 Build Finder：

- `npm run inspect:data`：检查本地 BazaarDB JSON 的数量、字段和前几条 normalized 记录。
- `npm run generate:builds`：从 `data/raw/bazaardb` 生成 `public/generated-builds.json`、`public/item-index.json`、`public/skill-index.json`、`public/hero-index.json` 和 `public/build-generator-meta.json`。
- `npm run dev`：启动前端页面，读取 `public/` 下的静态 JSON。
- `npm run typecheck` / `npm test`：类型检查和 Vitest 单元测试。

生成结果只表示 theoretical/generated builds，不表示真实胜率、meta 强度或官方验证结果。协同分权重集中在 `src/lib/bazaar-data/synergy.ts` 的 `scoringConfig`，机制画像权重集中在 `src/lib/bazaar-data/mechanics.ts` 的 `mechanicWeights`。

生成构筑会带上 `mechanicProfile`，用于按核心输出、节奏、控制和防御维度筛选。机制画像先从物品/技能效果文本计算潜力，再在布局优化后按相邻、左右侧等位置关系计算兑现后的分数。

## Raw Data

原始数据来自 `/projects/bazaar-db/data/json` 和 `/projects/bazaar-db/data/manifests`，当前放在：

- `data/raw/bazaardb/cards.json`
- `data/raw/bazaardb/items.json`
- `data/raw/bazaardb/skills.json`
- `data/raw/bazaardb/heroes.json`
- `data/raw/bazaardb/enchantments.json`
- `data/raw/bazaardb/sources.json`
- `data/raw/bazaardb/tags.json`
- `data/raw/bazaardb/image_manifest.json`
- `data/raw/bazaardb/manifests/`

没有复制 `*_en.json` 和 `*_zh.json` 单语文件，因为 `cards.json`、`items.json`、`skills.json` 已经把 `en-US` 和 `zh-CN` 放在同一条记录的 `i18n` 里。Build Finder 后续应优先从双语聚合文件建索引。

## Source Snapshot

- Patch: `14.0`
- Scraped at: `2026-05-09T00:55:09+00:00`
- Locales: `en-US`, `zh-CN`
- Cards: `1511`
- Items: `1080`
- Skills: `431`
- Heroes: `8`
- Enchantments: `13`
- Sources: `143`

详细分析见 `docs/source-data-analysis.md`。
