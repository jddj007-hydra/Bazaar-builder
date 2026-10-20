# 真实 GameData 与现有 JSON 格式的适配性评估

- 评估日期：2026-10-19
- 数据来源：`C:\Users\jddj0\AppData\LocalLow\Tempo Storm\The Bazaar\prod\cache\GameData.db`（2026-10-13，3375 条 cards）+ `translations/zh-CN.bytes`（9025 条）
- 对照对象：`data/raw/bazaardb`（BazaarDB 2026-05-09，patch 14.0，1511 张卡）
- 结论：**仓库的 normalized 契约（`ItemDef` / `SkillDef` / index 条目）基本可以继续用；raw 层契约不能直接承载真实数据，需要新增一个 importer，把游戏 DSL 下沉成仓库现有的 raw 形状，并做少量字段扩展。**

## 1. 数据对齐结果

| 项目 | 旧数据 | 新数据 | 说明 |
| --- | --- | --- | --- |
| Item + Skill | 1511 | 1956 | 1393 items + 563 skills |
| 新增卡 | — | 445 | 旧 ID 全部保留，0 删除 |
| 改名卡 | — | 4 | 如 Burning Shield → Defender's Flames |
| 调试 / 模板卡 | 0 | 47 | 需按 `InternalName` / `$type` 排除 |
| 英雄 | 8 | 9 | 新增 `Hero8`，中文名为「巨龙」 |
| 附魔 | 13 | 13 | 名称集合一致 |
| 起始等级变化 | — | 95 | 需要重算 `defaultTier` |
| 尺寸变化 | — | 1 | |
| 多英雄卡 | 152 | 290 | 另有 103 张面向全部 8 英雄 |

## 2. 逐项评估

### 2.1 文本：格式可用，但必须由 importer 完成 token 求值

新数据的 `Localization.Tooltips[].Content.Text` 是模板，含 2923 个 token：

- `{ability.N}` 2133 个、`{aura.N}` 583 个
- `{ability.N.targets}` 119 个
- `{aura.N.mod}` 88 个

旧 BazaarDB 已经用 `TooltipReplacements` 把值替换好；新数据没有这个字段，值要从 `Abilities` / `Auras` 的 `Action` 加上当前等级属性推导。

**验证结果**：在底层属性未变化的卡上，用推导值与旧 `TooltipReplacements` 对比 3272 次，**3170 次一致（96.88%）**，50 次不一致、52 次无法静态求值。不一致的样本都是真实改动（如 Myrrh 从 Regen 改成 Heal、VIP Pass 换了目标），不是推导错误。

求值规则（importer 实现）：

| token | 取值 |
| --- | --- |
| `{ability.N}` / `{aura.N}` | `Action.Value`：`TFixedValue` 直接取；`TReferenceValueCardAttribute` 取该等级属性；否则取 `Action.AttributeType` 对应的等级属性 |
| `{ability.N.targets}` | `Action.TargetCount`，否则 `<AttributeType>Targets` 属性（如 `FreezeTargets`） |
| `{aura.N.mod}` | `Action.Value.Modifier.Value` 链，遇到卡属性引用时取该等级属性 |

毫秒转秒：`CooldownMax`、`FreezeAmount`、`SlowAmount`、`HasteAmount`、`ChargeAmount`、`FlatCooldownReduction` 等时间类属性除以 1000；`ReloadAmount` 是弹药数，不能除。

**关键字补全**：新模板省略了旧数据自动注入的关键字。有 603 个 token 需要补 Damage / Shield / Heal / Burn / Poison / Regen / Haste / Slow / Freeze / Charge / Ammo / Multicast / Crit Chance 等词（其中 Damage 191、Shield 78、Burn 57、Haste 55、Charge 52、Slow 45、Poison 32）。

实际实现没有走 `TooltipReplacementKeywords`：旧 BazaarDB 的渲染路径会把关键字直接拼在数值后面，导致「Deal 5 Damage Damage」「造成 1 Poison剧毒」。importer 改为在文本层插入关键字，规则是「token 所在标点分段内既没有该关键字、也没有该关键字的量词（`second`、`Health`、`%` 等）时才插入」，中英文各一套量词表（`KEYWORD_UNITS`），因此 `TooltipReplacementKeywords` 保持为空对象。

**文本权威性**：`InternalDescription` 已废弃，8 条非空记录全部与 tooltip 不一致（Eagle Talisman 的 InternalDescription 仍写 Damage，实际是 Crit Chance）。**只能以 `Localization.Tooltips` 为准。**

### 2.2 等级属性：必须前向继承后落成 Base + Override

新数据只有 `Tiers[tier].Attributes`，且从 `StartingTier` 向上继承；没有 `BaseAttributes`。1224 张卡、7708 个属性键依赖继承。

importer 应输出旧形状：

- `BaseAttributes` = `StartingTier` 时的有效属性
- `Tiers[tier].OverrideAttributes` = 该等级的**完整有效属性**（可含与 Base 相同的键）

这样 `effectiveAttributes()`、`getCooldownMsForTier()` 等现有函数不用改。

边界情况：

- 41 张卡有 `Legendary` 等级；其中 6 张 `StartingTier: Legendary` 但 `Tiers` 里只有 `Diamond`，需要按「Legendary 继承 Diamond 属性」处理。
- 13 张卡等级不连续（主要是 Package），按实际存在的等级输出即可。

### 2.3 价格：可由 `game_modes.StandardPrices` 推导，旧数据里的例外是过期值

- 新数据只有 199 张卡显式带 `BuyPrice` / `SellPrice`（Package、Chunk of Gold 等），其余 1757 张需按 `StandardPrices[Item|Skill][Buy|SellPrices][Size][Tier]` 推导。
- 与旧数据对比 3343 次，3283 次一致（98.2%），60 次不同。
- 旧数据中 19 张 Legendary 卡的非标准价格（如 Scythe / Dragon Heart / The Boss 卖价 32）在新数据里没有显式值，游戏按标准表推导为 24。**这是旧 BazaarDB 的过期例外，不应保留。**
- `Chunk of Gold` 这类新数据显式给出的价格优先于标准表。

### 2.4 英雄：`hero: string | null` 不够用

- 290 张卡属于 2–8 个英雄，103 张属于全部 8 英雄，共 71 种英雄组合。
- 当前 `getHeroSlug()` 只在「恰好一个非 Common 英雄」时返回 slug，多英雄卡会变成 `null`，在 UI 里被当成通用卡，对所有英雄可见。
- 生成器用的是 `isEntityAvailableForHero(raw, hero.slug)`，读取 `raw.Heroes`，这部分是对的；**出错的是 index 与筛选**。

需要扩展：

- `ItemDef` / `SkillDef` / `ItemIndexEntry` / `SkillIndexEntry` 增加 `heroes: string[]`（slug 数组，不含 Common）。
- 保留 `hero` 作为「单英雄时的兼容字段」，多英雄与 Common 为 `null`。
- `App.tsx` 的 `itemMatchesHero()` 改为按 `heroes` 判断（空数组 = 通用）。
- `normalizeHeroes.ts` 增加 `Hero8: "巨龙"`；`cardRecord.ts` 的 `HERO_TAGS` 增加 `Hero8`。

### 2.5 `SpawningEligibility`：生成器必须排除 `Never`

| 值 | Item | Skill | 含义 |
| --- | --- | --- | --- |
| `Always` | 1173 | 503 | 正常卡池 |
| `GuidOnly` | 160 | 14 | 事件 / 特定来源专用 |
| `Never` | 60 | 46 | 不应出现在构筑里 |

当前生成器不区分，会把 106 张 `Never` 卡（含 Keen Edge、Poison Blades、各 Package）编进理论构筑。需要在 `ItemDef` / `SkillDef` 增加 `spawningEligibility`，`generateBuilds` 过滤 `Never`（`GuidOnly` 保留，但在 meta/warning 里标注）。

**补充（2026-10-20）**：`SpawningEligibility` 之外还需要一个战斗相关性标记。`Always` / `GuidOnly` 里有 213 个物品、23 个技能只在战斗外生效（战利品、商人包裹、每日奖励、经济光环），此前会进入理论构筑，占 1011/4500 条构筑的至少一个格子。importer 现在从效果 DSL 推导 `CombatRelevance`，生成器同时过滤 `economy`；详见 `docs/source-data-analysis.md` 的「战斗相关性」一节。

### 2.6 等级属性白名单：16/19 个键扩到 48 个

新数据共有 48 个等级属性键。现有 `tierAttributes.ts` 的 item 白名单 16 个、skill 白名单 19 个，会丢掉大量信息：

- Item 未覆盖：`Custom_0`–`Custom_8`、`ChargeAmount` / `ChargeTargets`、`BuyPrice`、`HasteTargets`、`SlowTargets`、`FreezeTargets`、`FlyingTargets`、`DisableTargets`、`ReloadTargets`、`RageApplyAmount`、`TempoCost`、`TempoApplyAmount`、`Lifesteal`、`FlatTempoCostReduction`、`PercentTempoCostReduction`、`PercentSlowReduction`、`UpgradeTargets`、`EnchantTargets`、`TransformTargets`、`BurnRemoveAmount`、`PoisonRemoveAmount` 等。
- Skill 未覆盖：`Custom_3`–`Custom_8`、`SlowTargets`、`FreezeTargets`、`TempoApplyAmount`、`FlyingTargets`、`RageApplyAmount`、`ReloadAmount`、`ReloadTargets` 等。

建议把白名单改为「排除价格与纯内部键」的完整集合，并在 `tierAttributeLabels` 补齐中文标签。

### 2.7 来源：没有 `DroppedBy`，只能从遭遇图推导，覆盖率会下降

- 新数据没有 `DroppedBy` 字段。
- 遭遇卡通过 `TSpawnFilterIdList` 指向卡 ID；把 Event / Step / Combat / Pedestal 遭遇递归展开，只能覆盖 **664 / 1393** 个 Item。
- 旧数据有 143 个 source，覆盖 632 / 1511。
- `level_ups` 的奖励只额外覆盖 34 张卡，且与遭遇图高度重叠。

importer 把遭遇卡转成 `sources.json`（source_id、标题、分类、day 条件、card_ids），实际产出 **224 个来源**（旧数据 143）。覆盖率下降是数据本身的限制，UI 需要允许「无来源」而不是把卡隐藏掉。`TRunConditionalCurrentDay` 可以恢复部分 day 信息（52 个遭遇带运行条件）。

### 2.8 商人：可以从遭遇约束生成，替代手工维护的 47 条

- 新数据有 108 个非 DEBUG 的 Merchant 遭遇，旧 `merchant-data.json` 只有 47 条。
- 商人过滤器已经是结构化的 `ConstraintTag` / `ConstraintHiddenTag` / `ConstraintSize` / `ConstraintTier` / `ConstraintHero` / `ConstraintCardType` / `ConstraintEnchantmentEligible` / `ConstraintAnd` / `ConstraintOr`，与现有 `MerchantFilter` 模型高度对应。
- 39 个商人用 `TSpawnFilterIdList` 直接列卡，其余用 `TSpawnFilterQuery`。
- 新增商人：Private Pitchfork、Merchant Club、The Dragons、Laurel、Thieves Guild Discount、Uitar Center、Stickybeans。
- importer 已生成 `manifests/merchant_data.json`（**52 条**，每条都有 `filters`），旧手工表不再被默认读取；手工表只保留中文名等补充。

### 2.9 附魔：现有契约可用

新数据的 `card.Enchantments[name]` 含 `Localization.Tooltips`、`Abilities`、`Auras`，importer 转成旧形状（`Localization.Tooltips` + `TooltipReplacementKeywords`）即可。356/360 个附魔数值与旧数据一致，4 个差异是真实改动。

### 2.10 其他需要处理的数据特征

| 特征 | 数量 | 处理 |
| --- | --- | --- |
| 重复标题 | 42 个标题 / 126 张卡 | slug 已按 ID 去重，保留全部 ID；Package 是等级变体 |
| 无 tooltip | 1 张（Keen Edge，`Never`） | 允许空效果 |
| Tooltip 引用缺失 ability | 2 个 token | 保留 token，不伪造数值 |
| Tooltip 分级差异 | 7 张卡 | importer 按等级输出 `TooltipIds` 对应的模板 |
| 中文标题缺失 | 88 张 | 回退英文 |
| 中文 tooltip 缺失 | 90 条 | 回退英文 |
| 中文 tooltip 含 token | 2497 条 | 与英文同一套 `TooltipReplacements` |
| 新 DSL 节点 | 188 种 | 文本层解析不依赖节点类型，但 parser 需覆盖新机制文本 |
| 当前 parser 未知效果 | 13 张卡 / 15 条 clause | Tempo、Encounter reroll、G Notes 等新模式 |

### 2.11 图片：可以从 Unity addressables 抽取，覆盖率 98%

`ArtKey` 是哈希或资源名，图片不在 DB 里。实际抽取路径：

1. `catalog_*.bin` 中 `ArtKey` 哈希 → `<Name>_CardData.asset` 名。
2. `card_*_assets_all.bundle` 中 `CardData` MonoBehaviour 的 `cardMaterial` → 材质 `_MainTex` → `Texture2D`（1024×1024）。
3. Skill 直接按 `ArtKey` 匹配 `skills_assets_all.bundle` 里的 `Icon_Skill_*`。

覆盖率：

- Item：1126 张按 `cardGUID` 命中，248 张按 `ArtKey` → catalog → 资源名命中，合计 **1374 / 1393**；18 张无 `ArtKey`，1 张未解析。
- Skill：**558 / 563** 按图标名命中；5 张需要名称修正或缺失。

仓库已经包含官方卡图（`public/images/cards`，1511 张 webp），因此抽取新卡图不改变授权状态；只需为新增/缺失卡补图，旧图可继续复用。

英雄头像同样来自 addressables：主菜单 `heroselect/hero_button_*.png` 与 `karnok_icon` / `thedragons_icon` bundle，导出为 `public/images/heroes/<slug>.webp`（8 个英雄，`Common` 无头像），索引写在 `manifests/hero_art.json`，由 `normalizeHeroes` 读取。

## 3. 推荐的 raw 契约

保留 `data/raw/bazaardb` 的文件结构，importer 输出到 `data/raw/gamedata`：

```
data/raw/gamedata/
  cards.json          # 派生后的卡（保留 token 模板 + TooltipReplacements）
  items.json          # 与 cards.json 同构的 item 子集
  skills.json         # skill 子集
  heroes.json         # 含 Hero8
  enchantments.json
  sources.json        # 由遭遇图生成
  tags.json
  image_manifest.json
  manifests/
  meta.json           # 数据版本、来源文件、统计
```

单张卡的扩展形状：

```json
{
  "Id": "...",
  "Type": "Item",
  "InternalName": "EagleTalisman",
  "Title": { "Text": "Eagle Talisman" },
  "BaseTier": "Silver",
  "Size": "Small",
  "Heroes": ["Common"],
  "SpawningEligibility": "Always",
  "Tags": ["Loot"],
  "HiddenTags": ["Crit", "CritReference"],
  "BaseAttributes": { "Custom_0": 5, "SellPrice": 2, "BuyPrice": 4 },
  "Tiers": {
    "Silver": { "OverrideAttributes": {}, "AbilityIds": ["0"], "ActiveTooltips": [0] },
    "Gold": { "OverrideAttributes": { "Custom_0": 10, "SellPrice": 4, "BuyPrice": 8 }, "...": "..." }
  },
  "Tooltips": [{ "Content": { "Text": "When you sell this, your leftmost item permanently gains {ability.0}% Crit Chance" }, "TooltipType": "Passive" }],
  "TooltipReplacements": { "{ability.0}": { "Silver": 5, "Gold": 10, "Diamond": 20 } },
  "TooltipReplacementKeywords": {},
  "i18n": { "en-US": { "...": "..." }, "zh-CN": { "...": "..." } },
  "ArtKey": "ef57f8899ff555b4d98d03124c1608a7",
  "image_url": "/images/cards/0022c409-c839-41e8-8022-65a407457dfe.webp",
  "source_url": null,
  "patch": "2026-10-13",
  "scraped_at": "2026-10-13T00:00:00+00:00"
}
```

关键点：

- **保留 token 模板 + 每级替换值**，而不是把文本提前渲染死；现有 `getTooltipTextsForTier()` 可以直接工作，并能生成中文。
- **`BaseAttributes` + 每级 `OverrideAttributes`** 是前向继承后的结果，normalizer 不需要知道继承规则。
- **新增 `heroes`、`spawningEligibility`、`internalName`、`artKey`**，其余字段保持旧名。

## 4. normalized 层需要的改动

| 文件 | 改动 |
| --- | --- |
| `types.ts` | `ItemDef` / `SkillDef` / index 增加 `heroes: string[]`、`spawningEligibility`、`combatRelevance` |
| `cardRecord.ts` | `getHeroSlugs()`；`HERO_TAGS` 加 `Hero8` |
| `normalizeItems.ts` / `normalizeSkills.ts` | 输出 `heroes`、`spawningEligibility` |
| `normalizeHeroes.ts` | 加 `Hero8: "巨龙"` |
| `tierAttributes.ts` | 白名单扩到 48 键，补中文标签 |
| `generateBuilds.ts` | 过滤 `Never`；多英雄卡按 `heroes` 判断；过滤 `combatRelevance === "economy"` 的非战斗卡 |
| `App.tsx` | `itemMatchesHero()` 改用 `heroes` |
| `normalizeSources.ts` | 读取 importer 生成的遭遇来源 |
| `normalizeMerchants.ts` | 读取 importer 生成的商人定义 |
| `scripts/generate-builds.ts` | 默认 raw 目录切到 `data/raw/gamedata` |

## 5. 迁移步骤与完成状态

1. ✅ 写 `scripts/import-gamedata.ts`：SQLite → 派生 raw（token 求值、等级继承、价格推导、双语、来源、商人）。核心逻辑在 `src/lib/bazaar-data/gamedataImport.ts`，有 `gamedataImport.test.ts` 覆盖。
2. ✅ 用旧数据做回归校验：token 求值 97.96% 一致、价格 97.70% 一致、等级属性 100% 可推导。
3. ✅ 补全 `docs/source-data-analysis.md` 与 README 的统计。
4. ✅ normalized 层按第 4 节改动，`npm run typecheck` / `npm test` 通过。
5. ✅ 抽取新增卡图（Python + UnityPy，脚本不提交仓库，只提交图片与 `manifests/art_index.json`）。最终 1937 张有图、19 张缺失（18 张为 `Never`，仅 Cirrus Feather 是 `Always` 且无 addressables 资源）。新图与旧图使用同一构图规则：item 整图缩放到 Small 200×400 / Medium 400×400 / Large 600×400，skill 图标保留原生分辨率。
6. ✅ `npm run generate:builds` 重新生成 `public/`：4500 条理论构筑（9 个英雄 × 500），按英雄拆分到 `public/builds/<hero>.json`，输出 JSON 去掉缩进。
7. ✅ parser 补齐新数据的主要文本模式（Package 奖励 + XP、Heat / Chill、随机 Types、玩家 Crit、敌方 Gold、Rage 需求、商人折扣、回合外字段等），并更新 audit 报告。剩余 15 条未知见 `docs/unknown-unsupported-report.md`。

