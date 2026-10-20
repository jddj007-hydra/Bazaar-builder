# Source Data Analysis

## 结论

当前主数据来自游戏运行时缓存 `GameData.db`（2026-10-13，3375 条 card 记录）与同目录的 `translations/zh-CN.bytes`。经 `npm run import:gamedata` 转换后，得到 `1956` 张可玩卡（1393 Item + 563 Skill），其中 `445` 张是旧 BazaarDB 数据（patch 14.0，1511 张）没有的新卡。

旧 `data/raw/bazaardb` 仍保留在仓库里作为对照，但默认管线（`loadRawData`）读取的是 `data/raw/gamedata`。

## 已生成的数据

| File | Role | Count | Notes |
| --- | --- | ---: | --- |
| `cards.json` | 主卡池 | 1956 | Item + Skill 的双语聚合全集 |
| `items.json` | Item 子集 | 1393 | 与 `cards.json` 中 `Type=Item` 对应 |
| `skills.json` | Skill 子集 | 563 | 与 `cards.json` 中 `Type=Skill` 对应 |
| `heroes.json` | 英雄到卡牌映射 | 9 | 新增 `Hero8`（巨龙） |
| `enchantments.json` | 附魔到卡牌映射 | 13 | 名称集合与旧数据一致 |
| `sources.json` | 来源到卡牌映射 | 224 | 由遭遇生成图推导 |
| `tags.json` | 标签集合 | 89 | visible 22 / hidden 53 / mechanic 14 |
| `image_manifest.json` | 图片清单 | 1956 | 1937 有图，19 缺失 |
| `manifests/merchant_data.json` | 商人定义 | 52 | 由 `TSpawnFilterQuery` 约束树推导 |
| `manifests/art_index.json` | Unity 资源索引 | 1937 | 从 addressables 扫描得到 |
| `manifests/hero_art.json` | 英雄头像索引 | 8 | 不含 `Common`；输出到 `public/images/heroes/` |
| `meta.json` | 导入元数据 | n/a | patch、计数、来源文件 |

## 关键字段

转换后的 raw 记录沿用旧 BazaarDB 的字段名，normalized 层因此不需要重写：

- `Id`: 稳定主键（游戏 Guid）。
- `Type`: `Item` 或 `Skill`。
- `Title.Text`: 默认英文标题。
- `i18n.en-US` / `i18n.zh-CN`: 同一记录内的双语标题和 tooltip。
- `Heroes`: 英雄归属，可为多英雄；`Common` 表示通用。
- `SpawningEligibility`: `Always` / `GuidOnly` / `Never`，构筑生成会排除 `Never`。
- `CombatRelevance` / `CombatRelevanceReason`: 由效果 DSL 推导的战斗相关性。`economy` 表示这张卡只在战斗外生效（出售、购买、日/小时开始、升级、遭遇、纯经济属性），不参与构筑生成。
- `BaseTier` / `BaseAttributes`: 起始等级及其有效属性。
- `Size`: `Small`、`Medium`、`Large`；Skill 为 `Medium`。
- `DisplayTags` / `HiddenTags` / `Tags`: 类型、机制和隐藏机制标签。
- `Tiers`: 每级的**完整有效属性**（前向继承后）和 ability / aura / tooltip 引用。
- `Tooltips` / `TooltipReplacements`: 带 token 的模板文本和每级替换值。
- `Enchantments`: 每种附魔的 tooltip 与替换值。
- `ArtKey` / `image_url`: Unity art key 和本地图片路径。

## 数据来源与限制

- 数据只来自本机游戏运行时缓存，不包含插件、内存读取、封包或服务端交互。
- 游戏 DSL 的 `{ability.N}` / `{aura.N}` 由 importer 静态求值；无法静态求值的 token 不会写入 `TooltipReplacements`。
- `{aura.N}` 在旧 BazaarDB 中有时被写成 `Fixed: 0`（数量缩放光环），新 importer 按游戏的实际 aura 值解析，这是两版数据的主要文本差异来源。
- 19 张卡没有可用图片：18 张是 `Never`（无 ArtKey），另 1 张 `Cirrus Feather`（`Always`）在 addressables 中没有对应纹理，`imageUrl` 为 `null`。
- 旧图与抽取图同源：item 旧图就是游戏内同一张 1024×1024 纹理按卡面比例缩放的结果（Medium 逐像素一致），因此迁移时保留旧图，只补新增卡。
- 新增图沿用同一构图规则：item 整图缩放到 Small 200×400 / Medium 400×400 / Large 600×400；skill 图标保留原生分辨率（256 或 512）。

## 后续建模建议

- 派生索引仍从 `public/` 下的静态 JSON 读取；不要把 importer 的求值逻辑放进前端运行时。
- 构筑文件按英雄拆分在 `public/builds/`，前端只加载当前英雄。旧的单文件 `generated-builds.json` 已移除。
- 新增机制文本（Heat / Chill、Tempo、SpawnCards、Flying、Upgrade、reroll Encounters）需要继续补 parser 规则，并更新 `docs/effect-text-parse-audit.md`。
- 刷新数据时先跑 `npm run import:gamedata`，再跑 `npm run generate:builds`，最后核对 `docs/data-format-evaluation.md` 中的对齐指标。

## 战斗相关性（非战斗卡排除）

游戏数据里没有「这张卡能不能在战斗中使用」的单一字段，importer 从效果 DSL 推导：

| 判定 | 规则 |
| --- | --- |
| `combat` | 存在任一效果满足：`WorksIn = CombatOnly`；或触发器不在战斗外集合中且动作不只是经济修改 |
| `economy` | 所有效果都挂在战斗外触发器（出售 / 购买 / 选择 / 日与小时开始 / 升级 / 遭遇 / 通关），或只改 `BuyPrice`、`Gold`、`Income`、`Experience`、`Prestige`、`Level`、`RerollCostModifier`、`SellPrice`，或物品完全没有效果 |
| 技能特例 | 没有效果 DSL 的技能（如各调式 Major / Note）保留为 `combat`，因为它们改的是战斗中的多重释放 |

`SellPrice` 就是游戏内的 `Value`（`ECardAttributeType.SellPrice = 38`），所以「+Value」类光环被视为经济效果；但如果同一张卡还有战斗效果，整张卡仍然是 `combat`。

最近一次统计（2026-10-13 数据）：`combat` 1720 张（1180 item + 540 skill），`economy` 236 张（213 item + 23 skill）。排除后 4500 条构筑里不再出现非战斗卡，物品索引仍保留它们供查询。
