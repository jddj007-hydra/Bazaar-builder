# Bazaar Build Finder

这是一个基于游戏运行时缓存 `GameData.db` 导入的本地静态 The Bazaar Build Finder 和理论构筑生成器。

项目不连接游戏客户端、官方服务或外部数据源；运行时只读取本仓库内的 TypeScript / JSON。生成结果用于浏览、搜索和解释理论构筑，不表示真实胜率、meta 强度或官方验证结果。

`GameData.db` 只在离线导入时作为输入读取一次，应用运行时仍然没有数据库（符合 V1 的「no database」约束）；导入产物是普通的 JSON 文件。

## App Workflow

当前实现是一个静态、无数据库的理论构筑生成器和 Build Finder：

- `npm run import:gamedata`：从本机游戏运行时缓存（`GameData.db` + `zh-CN.bytes` 翻译表）重新生成 `data/raw/gamedata` 下的 raw JSON。该脚本使用 `node:sqlite`，需要 Node 22.5+（本地开发使用 Node 24；若 Node 22 提示缺少模块，用 `node --experimental-sqlite` 运行 tsx）。
- `npm run inspect:data`：检查本地 raw JSON 的数量、字段和前几条 normalized 记录。
- `npm run generate:builds`：从 `data/raw/gamedata` 生成 `public/builds/<hero>.json`（每个英雄一个构筑文件）、`public/builds/index.json`、`public/item-index.json`、`public/skill-index.json`、`public/hero-index.json` 和 `public/build-generator-meta.json`。
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

最近一次本地评估结果（2026-10-13 数据）：

- Entities: `1969`
- Structured effects: `3473`
- Parsed structured effects: `3386`
- Structured unknown effects: `87`
- Structured unknown tokens: `233`
- Semantic clauses: `3288`
- Semantic unknown actions: `15`
- Unsupported projected semantic effects: `15`
- Suspicious parse results: `0`
- Projection status: `exact 1956` / `partial 10` / `unsupported 3`
- Corpus-eligible entities: `1957` of `1969` normalized entities have non-empty English raw effect text.

新数据带来了 445 张旧数据没有的卡。新包奖励文本 `get an Enchanted <size> <tag> item and N XP`（100 条 clause）已经能解析成「获得物品 + 获得 XP」两个动作；剩余 15 条未知主要集中在：

- Tempo 消耗/返还（`spend 1 Tempo`、`Spend All Tempo:`）
- `reroll your hourly Encounters`（3 张卡）
- `visit an Encounter of the same tier`、`spend 4 to use it again`
- G Notes 专属文本、Radiant / Shiny 的「guaranteed」尾句
- `Rapid Thaw` 一条未翻译 token（`reduce the duration by 2000 second(s)`）

这些会体现在 `docs/effect-text-parse-audit.md` 与 `docs/unknown-unsupported-report.md`，属于已知缺口，不影响构筑生成（未知效果会降低该实体的机制置信度）。

## Raw Data

原始数据来自本机游戏的运行时缓存，而不是 Steam 安装目录或旧 BazaarDB 导出：

- 数据库：`%LOCALAPPDATA%Low\Tempo Storm\The Bazaar\prod\cache\GameData.db`（WSL 下为 `/mnt/c/Users/<user>/AppData/LocalLow/Tempo Storm/The Bazaar/prod/cache/GameData.db`）
- 中文翻译：同目录 `translations/zh-CN.bytes`（SQLite 表 `translation(hash, text)`，`hash = md5(英文原文)`）

`npm run import:gamedata` 读取这两份文件，用 `src/lib/bazaar-data/gamedataImport.ts` 把游戏 DSL 转换成项目既有的 raw 形状，输出到：

- `data/raw/gamedata/cards.json`
- `data/raw/gamedata/items.json`
- `data/raw/gamedata/skills.json`
- `data/raw/gamedata/heroes.json`
- `data/raw/gamedata/enchantments.json`
- `data/raw/gamedata/sources.json`
- `data/raw/gamedata/tags.json`
- `data/raw/gamedata/image_manifest.json`
- `data/raw/gamedata/manifests/`（`art_index.json`、`hero_art.json`、`build_manifest.json`、`merchant_data.json`）

可选参数：`--db`、`--translations`、`--out`、`--art-index`、`--images`、`--patch`、`--no-art-index`。也可以用环境变量 `BAZAAR_GAMEDATA_DB` / `BAZAAR_ZH_TRANSLATIONS` 覆盖默认路径。

导入时做的关键转换：

- 等级属性按 `StartingTier` 前向继承，落成 `BaseAttributes` + 每级完整 `OverrideAttributes`。
- `{ability.N}` / `{aura.N}` / `{ability.N.targets}` / `{aura.N.mod}` 由 `Abilities` / `Auras` 的 `Action` 与当前等级属性求值，写入 `TooltipReplacements`。`TActionGameSpawnCards` 的数量取 `SpawnContext.Limit`；无法静态求值的跨卡聚合值按游戏默认值 0 输出，保证文本里不残留原始 token。
- 游戏在 tooltip 末尾追加的运行时读数（如 `[{aura.0}]`、`[Total Duration: {aura.9}]`）会在导入时移除，与旧 BazaarDB 的展示口径一致。
- 时间类属性（`CooldownMax`、`HasteAmount`、`FreezeAmount` 等）毫秒转秒；`ReloadAmount` 是弹药数，不换算。
- 模板省略的关键字（Damage / Shield / Burn / Poison / Haste 等）只在上下文既没有关键字也没有量词时补入，避免出现「5 Damage Damage」。
- 价格缺失时从 `game_modes[0].StandardPrices` 推导 `BuyPrice` / `SellPrice`。
- 来源由遭遇生成图（`TSpawnFilterIdList` + 怪物手牌/技能 + 天数条件）推导；商人由 `TSpawnFilterQuery` 约束树推导。
- 排除 `[DEBUG]`、模板卡、`Unused Card` 等调试记录；`SpawningEligibility` 为 `Never` 的卡不进入构筑生成。
- 导入时按游戏 DSL 推导 `CombatRelevance`（`combat` / `economy`）：所有效果都挂在出售、购买、日/小时开始、升级、遭遇选择等战斗外触发器上，或只修改 `BuyPrice` / `Gold` / `Experience` 等经济属性、或没有任何效果的物品，会被标记为 `economy`。这些卡仍出现在卡牌查询里（带「非战斗」标记），但不参与理论构筑生成，也不出现在构筑/自定义构筑的选卡建议里。

旧的 `data/raw/bazaardb` 保留作对照，不再被默认管线读取。

## Source Snapshot

- Patch: `2026-10-13`（游戏运行时缓存）
- Cards: `1956`（1393 Items + 563 Skills）
- 排除的调试 / 模板记录：`47`
- Heroes: `9`（新增 `Hero8` / 巨龙）
- Enchantments: `13`
- Sources: `224`
- Merchants: `52`
- 图片：`1937` 张有图（1511 张旧图 + 426 张 Unity 抽取），`19` 张缺失（其中 18 张为 `Never`）
- 英雄头像：`8` 个英雄（不含通用）从 Unity `heroselect` / `*_icon` 资源抽取，输出到 `public/images/heroes/`，路径记录在 `manifests/hero_art.json`
- 多英雄卡：`290`（其中 `103` 张面向全部 8 个英雄；item 98 / skill 192）
- 战斗相关性：`combat` `1720`（1180 item + 540 skill），`economy` `236`（213 item + 23 skill）。`economy` 卡只出现在卡牌查询里，不参与构筑生成。
- 构筑输出：`4500` 条，按英雄拆成 `public/builds/<hero>.json`（每份约 1.8–2.4 MB，brotli 后约 40–50 KB），`public/builds/index.json` 记录每个英雄的条数与路径。

详细分析见 `docs/source-data-analysis.md`，格式适配评估见 `docs/data-format-evaluation.md`。

## Cloudflare Pages

这个项目是纯静态 Vite 应用，适合部署到 Cloudflare Pages。

Pages 项目设置：

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 由 `.node-version` 固定为 `22`
- Cloudflare Pages project: `bazaar-builder`
- Pages production URL: `https://bazaar-builder.pages.dev/`
- Last deployment checked: `2026-10-20`, deployment `5bf107c6`（source `e4d6918`，catalog card art sized by item size），production branch `main`

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
- Verified at `2026-10-20`: `https://bazaar-builder.com/` 返回 `200`，`/builds/index.json` 与各英雄构筑文件均可访问。
- Cloudflare Pages API 曾短时间仍显示 custom domain `pending`，但正式域名 HTTPS 已实际可用；这是 Pages 域名状态同步滞后，不影响访问。
- `~/cf.key` 里的 token 没有 DNS Records 读写权限，DNS API 返回 `403`。如后续需要自动管理 DNS，需要换成包含 Zone DNS Read/Edit 权限的 token。
- 当前 DNS 目标应保持为 Pages 项目：`bazaar-builder.pages.dev`。
