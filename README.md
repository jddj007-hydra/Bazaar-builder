# Bazaar Build Finder

这是一个基于本地 BazaarDB JSON 的静态 The Bazaar Build Finder 和理论构筑生成器。

项目不连接游戏客户端、官方服务或外部数据源；运行时只读取本仓库内的 TypeScript / JSON。生成结果用于浏览、搜索和解释理论构筑，不表示真实胜率、meta 强度或官方验证结果。

## App Workflow

当前实现是一个静态、无数据库的理论构筑生成器和 Build Finder：

- `npm run inspect:data`：检查本地 BazaarDB JSON 的数量、字段和前几条 normalized 记录。
- `npm run generate:builds`：从 `data/raw/bazaardb` 生成 `public/generated-builds.json`、`public/item-index.json`、`public/skill-index.json`、`public/hero-index.json` 和 `public/build-generator-meta.json`。
- `npm run dev`：启动前端页面，读取 `public/` 下的静态 JSON。
- `npm run typecheck` / `npm test`：类型检查和 Vitest 单元测试。
- `npm run build`：执行 TypeScript project build 并生成 Vite 静态产物。

协同分权重集中在 `src/lib/bazaar-data/synergy.ts` 的 `scoringConfig`，机制画像权重集中在 `src/lib/bazaar-data/mechanics.ts` 的 `mechanicWeights`。

生成构筑会带上 `mechanicProfile`，用于按核心输出、节奏、控制和防御维度筛选。机制画像先从物品/技能效果文本计算潜力，再在布局优化后按相邻、左右侧等位置关系计算兑现后的分数。

## Effect Parser / IR

项目已经从旧的扁平 effect 解析扩展为结构化 parser 和 semantic IR 双层管线：

- legacy structured effects：`src/lib/bazaar-data/parseEffects.ts`、`src/lib/bazaar-data/structuredEffects.ts`、`src/lib/bazaar-data/types.ts`
- semantic IR：`src/lib/bazaar-data/semanticEffects.ts`
- parser tests：`src/lib/bazaar-data/bazaar-data.test.ts`
- raw text corpus：`docs/effect-rawtext-corpus.jsonl`
- audit report：`docs/effect-text-parse-audit.md`
- parser / IR audit：`docs/effect-parser-ir-audit.md`
- current unknown / unsupported report：`docs/unknown-unsupported-report.md`

当前 IR 覆盖了触发限制、布尔 tag 表达式、board slot terrain、effect modifier、status duration modifier、player state / faction、内部变量、health threshold crossing、动态 value 和 facets。关键新增结构保持为 TypeScript union 的增量扩展，避免破坏现有 UI、搜索和评分流程。

Parser 评估脚本：

- `npm run evaluate:effect-parser`：统计 structured / semantic unknown、structured unknown token、unsupported projection、projection status 和可疑解析。
- `npm run export:effect-corpus`：导出英文 effect corpus JSONL，包含版本、来源、clause 文本、当前 parser 结果、projection 状态、warning 和审计原因。
- `npm run import:pattern-candidates`：导入离线 LLM 生成的 pattern candidates，做 JSON schema、ontology、变量类型和 IR 可编译校验，只生成 review queue，不引入运行时 LLM。

最近一次本地评估结果：

- Structured effects: `2938`
- Parsed structured effects: `2938`
- Structured unknown effects: `0`
- Structured unknown tokens: `0`
- Semantic clauses: `2763`
- Semantic unknown actions: `0`
- Unsupported projected semantic effects: `0`
- Suspicious parse results: `0`
- Projection status: `exact 1524`
- Corpus-eligible entities: `1523` of `1524` normalized entities have non-empty English raw effect text.

当前没有 structured unknown token、semantic unknown action、unsupported projection、lossy projection 或 partial projection。generated / transform item specs 已通过 `GeneratedCards` / `TransformInto` sidecar 表达，动态 type-copy/random type 已通过 `StructuredTagMutation` sidecar 表达，未指定附魔已通过 `EnchantmentSelection: "Unspecified"` 表达，heal-to-health threshold 已通过 `HealthSetMode: "HealToThreshold"` 表达，compound action graph flattening 已通过 `StructuredActionGraphLink` sidecar 表达。trigger-player 和 trigger-source anchored targets 已能在 IR、view target 和 facets 中表达；repair-or-transform combat trigger 通过 `TTriggerOnRepairOrTransform` 和 `CombatOnly` 表达；shorthand previous-value modifiers 通过 `TTargetEffect.Anchor = "PreviousSemanticAction"` 表达；bonus reset threshold 通过 `TVariableConditionalValue` 表达。Incoming damage reduction 已通过 effect recipient binding 表达；destroy replacement timing 已通过 replacement trigger/original target/timing 表达；布尔歧义和未指定 rounding warning 仍导出供审计，但在 canonical IR 已明确表达时不再降级 projectionStatus。

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

## Cloudflare Pages

这个项目是纯静态 Vite 应用，适合部署到 Cloudflare Pages。

Pages 项目设置：

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 由 `.node-version` 固定为 `22`
- Cloudflare Pages project: `bazaar-builder`
- Pages production URL: `https://bazaar-builder.pages.dev/`
- Last deployment checked: `2026-05-16`, deployment `5e872a84-dc4c-4b8f-951c-b9d499b5d0ee`, production branch `main`

也可以用 Wrangler CLI 部署：

```bash
npm run deploy:cf
```

本机部署使用 `~/cf.key` 中的 Cloudflare `Uid` 和 `token`，不要把该文件提交到仓库。直接部署时可把它们导出为环境变量：

```bash
CLOUDFLARE_ACCOUNT_ID=$(node -e 'const fs=require("fs"); const v=JSON.parse(fs.readFileSync(process.env.HOME+"/cf.key","utf8")); process.stdout.write(v.Uid||v.uid||v.account_id||"")') \
CLOUDFLARE_API_TOKEN=$(node -e 'const fs=require("fs"); const v=JSON.parse(fs.readFileSync(process.env.HOME+"/cf.key","utf8")); process.stdout.write(v.token||v.Token||v.api_token||"")') \
npm run deploy:cf
```

自定义域名状态：

- `bazaar-builder.com` 已通过 Pages API 绑定到项目 `bazaar-builder`。
- 绑定创建时间：`2026-05-16`。
- Verified at `2026-05-16`: `https://bazaar-builder.com/` 返回 `200`，首页 HTML 和 `build-generator-meta.json` 均可访问。
- Cloudflare Pages API 曾短时间仍显示 custom domain `pending`，但正式域名 HTTPS 已实际可用；这是 Pages 域名状态同步滞后，不影响访问。
- `~/cf.key` 里的 token 没有 DNS Records 读写权限，DNS API 返回 `403`。如后续需要自动管理 DNS，需要换成包含 Zone DNS Read/Edit 权限的 token。
- 当前 DNS 目标应保持为 Pages 项目：`bazaar-builder.pages.dev`。
