# Source Data Analysis

## 结论

这批 JSON 可以直接作为 Build Finder 的第一版原始数据。最适合作为主入口的是 `cards.json`，它已经包含 `1080` 个 Item 和 `431` 个 Skill，并且每条记录都有唯一 `Id`、`Type`、英文和中文 `i18n`、标签、英雄归属、基础阶级、图片 URL 和本地图片路径。

`items.json` 和 `skills.json` 与 `cards.json` 内容重叠，但适合在开发早期做按类型调试。正式索引可以只读 `cards.json`，再用 `Type` 分出 Item 和 Skill。

## 已复制的数据

| File | Role | Count | Notes |
| --- | --- | ---: | --- |
| `cards.json` | 主卡池 | 1511 | Item + Skill 的双语聚合全集 |
| `items.json` | Item 子集 | 1080 | 与 `cards.json` 中 `Type=Item` 对应 |
| `skills.json` | Skill 子集 | 431 | 与 `cards.json` 中 `Type=Skill` 对应 |
| `heroes.json` | 英雄到卡牌映射 | 8 | 可用于英雄筛选 |
| `enchantments.json` | 附魔到卡牌映射 | 13 | 可用于附魔筛选 |
| `sources.json` | 来源到卡牌映射 | 143 | 包含 Event 和 Monster 来源 |
| `tags.json` | 标签集合 | 79 | 可用于筛选面板或标签规范化 |
| `image_manifest.json` | 图片清单 | 1511 | 图片下载状态和路径元数据 |
| `manifests/*.json` | 采集来源清单 | n/a | 保留 patch、时间、计数和失败信息 |

## 关键字段

卡牌记录的高价值字段：

- `Id`: 稳定主键。
- `Type`: `Item` 或 `Skill`。
- `Title.Text`: 默认英文标题。
- `i18n.en-US` / `i18n.zh-CN`: 同一记录内的双语完整数据。
- `Heroes`: 英雄归属，包含 `Common`、`Vanessa`、`Pygmalien`、`Dooley`、`Mak`、`Stelle`、`Jules`、`Karnok`。
- `BaseTier`: `Bronze`、`Silver`、`Gold`、`Diamond`、`Legendary`。
- `Size`: Item 有 `Small`、`Medium`、`Large`，Skill 当前都是 `Medium`。
- `DisplayTags` / `HiddenTags` / `Tags`: 类型、机制和隐藏机制标签。
- `Tiers`: 分阶属性和能力引用。
- `Tooltips` / `TooltipReplacements`: 文本说明和数值替换。
- `DroppedBy`: 来源关系，部分卡牌有。
- `image_url`: 远程 `@400.webp` 图片。
- `local_image_path`: 原 bazaar-db 项目内的本地图片相对路径。

## 暂时不复制的内容

- `cards_en.json`、`cards_zh.json`、`items_en.json`、`items_zh.json`、`skills_en.json`、`skills_zh.json`: 单语重复数据。后续如果要做差异检查再复制。
- `data/raw/14.0/pages/**`: 抓取分页中间产物，体积大且比聚合 JSON 更难直接用。
- `data/images/cards/**`: 图片文件还没有复制。当前 JSON 已经保留远程 `image_url` 和原项目的 `local_image_path`，后续如果 Build Finder 需要离线图片，再单独迁移图片资源。

## 后续建模建议

第一版索引可以从 `cards.json` 生成一个更轻的派生文件，例如 `data/derived/cards-index.json`，只保留：

- `id`
- `type`
- `name_en`
- `name_zh`
- `heroes`
- `base_tier`
- `size`
- `display_tags`
- `hidden_tags`
- `all_tags`
- `text_en`
- `text_zh`
- `image_url`
- `local_image_path`
- `source_ids`
- `enchantment_names`

原始 JSON 先不要改动。Build Finder 的解析、清洗和索引都应该写到派生数据层，方便以后重新从 BazaarDB 刷新。
