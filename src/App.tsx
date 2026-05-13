import { useEffect, useMemo, useState } from "react";
import { BoardPreview } from "./BoardPreview";
import { mechanicLabel } from "./lib/bazaar-data/mechanics";
import { recommendNextItems, searchGeneratedBuilds } from "./lib/bazaar-data/searchGeneratedBuilds";
import { semanticHasWarning, semanticSearchIndex, semanticSummary } from "./lib/bazaar-data/semanticConsumption";
import { structuredEffectHasUnknown, structuredEffectView, structuredEffectViews, type StructuredEffectView } from "./lib/bazaar-data/structuredEffects";
import type {
  GeneratedBuild,
  HeroDef,
  ItemIndexEntry,
  MechanicKey,
  SearchMode,
  SkillIndexEntry
} from "./lib/bazaar-data/types";

type StaticData = {
  items: ItemIndexEntry[];
  skills: SkillIndexEntry[];
  heroes: HeroDef[];
  builds: GeneratedBuild[];
};

type AppView = "builds" | "catalog";
type CatalogKind = "all" | "items" | "skills";
type CatalogEntity =
  | (ItemIndexEntry & { entityType: "item" })
  | (SkillIndexEntry & { entityType: "skill" });

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }
  return response.json() as Promise<T>;
}

function itemMatchesHero(item: Pick<ItemIndexEntry, "hero">, hero: string): boolean {
  return item.hero == null || item.hero === hero;
}

function scoreLabel(value: number | undefined): string {
  return value == null ? "0" : String(Math.round(value));
}

const eventLabels: Record<string, string> = {
  always: "常驻",
  combat_start: "战斗开始",
  cooldown_ready: "主动/冷却",
  item_used: "使用物品",
  skill_active: "技能生效",
  tag_item_used: "使用标签物品",
  adjacent_item_used: "相邻物品使用",
  gain_shield: "获得护盾",
  heal: "治疗",
  apply_burn: "施加燃烧",
  apply_poison: "施加中毒",
  deal_damage: "造成伤害",
  enemy_damaged: "敌人受伤",
  enemy_healed: "敌人治疗",
  enemy_shielded: "敌人获得护盾",
  buy: "购买",
  sell: "出售",
  level_up: "升级",
  transformed: "被转化",
  fight_end: "战斗结束",
  win: "胜利",
  lose: "失败",
  ammo_empty: "弹药耗尽",
  destroyed: "被摧毁",
  merchant: "访问商人",
  crit: "暴击",
  enrage: "激怒",
  player_attribute_threshold: "玩家属性阈值",
  condition_active: "条件生效",
  unknown: "未识别触发"
};

const actionLabels: Record<string, string> = {
  damage: "伤害",
  shield: "护盾",
  heal: "治疗",
  regen: "生命再生",
  lifesteal: "吸血",
  burn: "燃烧",
  poison: "中毒",
  haste: "加速",
  slow: "减速",
  freeze: "冻结",
  charge: "充能",
  reduce_cooldown: "减少冷却",
  gain_stat: "获得属性",
  gain_item: "获得物品",
  buff_tag: "标签增益",
  increase_value: "增加价值",
  gain_gold: "获得金币",
  gain_health: "获得生命值",
  multicast: "多重施放",
  reload: "装填",
  repair: "修理",
  transform: "转化",
  enchant: "附魔",
  flying: "飞行状态",
  cleanse: "净化",
  upgrade: "升级",
  use: "使用",
  destroy: "摧毁",
  redirect: "转移目标",
  modify_stat: "调整属性",
  modify_slot: "调整栏位",
  modify_effect: "调整效果",
  modify_status_duration: "调整状态时长",
  modify_player_state: "调整玩家状态",
  modify_variable: "调整变量",
  start_sandstorm: "沙尘暴",
  unknown: "未识别动作"
};

const targetLabels: Record<string, string> = {
  self: "自身",
  enemy: "敌人",
  adjacent: "相邻物品",
  left: "左侧物品",
  right: "右侧物品",
  leftmost: "最左侧物品",
  rightmost: "最右侧物品",
  allied_items: "己方物品",
  enemy_items: "敌方物品",
  all_items: "所有物品",
  allied_skills: "己方技能",
  random: "随机目标",
  unknown: "未识别目标"
};

const conditionLabels: Record<string, string> = {
  exactly_one: "恰好1个",
  target_has_tag: "目标有",
  has_tag: "拥有标签",
  minimum_count: "至少数量",
  maximum_count: "至多数量"
};

const coreOutputOptions: MechanicKey[] = ["damage", "weapon_damage", "crit", "burn", "poison", "shield_scaling"];
const tempoOptions: MechanicKey[] = ["haste", "charge", "reduce_cooldown", "multicast"];
const controlOptions: MechanicKey[] = ["freeze", "slow"];
const sustainOptions: MechanicKey[] = ["shield", "heal"];
const actionFilterOptions = Object.keys(actionLabels).filter((action) => action !== "unknown");

function formatCooldown(ms: number | null | undefined): string {
  if (!ms) return "无主动冷却";
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}秒冷却`;
}

function formatEffect(effect: StructuredEffectView): string {
  const triggerTag = effect.trigger.tag ? ` / ${effect.trigger.tag}` : "";
  const value = effect.action.value != null ? ` ${effect.action.value}` : "";
  const actionTag = effect.action.tag ? ` / ${effect.action.tag}` : "";
  const stat = effect.action.stat ? ` / ${effect.action.stat}` : "";
  const conditions = effect.conditions?.length
    ? ` [条件: ${effect.conditions
        .map((condition) => {
          const count = "count" in condition && condition.count != null ? ` ${condition.count}` : "";
          return `${conditionLabels[condition.type] ?? condition.type}${count}${condition.tag ? ` ${condition.tag}` : ""}`;
        })
        .join("; ")}]`
    : "";
  const target = effect.target
    ? ` -> ${targetLabels[effect.target.scope] ?? effect.target.scope}${effect.target.tag ? ` / ${effect.target.tag}` : ""}${
        effect.target.size ? ` / ${effect.target.size}格` : ""
      }`
    : "";

  return `${eventLabels[effect.trigger.event] ?? effect.trigger.event}${triggerTag}${conditions} -> ${
    actionLabels[effect.action.type] ?? effect.action.type
  }${value}${actionTag}${stat}${target}`;
}

function toggleMechanic(current: MechanicKey[], mechanic: MechanicKey): MechanicKey[] {
  return current.includes(mechanic) ? current.filter((entry) => entry !== mechanic) : [...current, mechanic];
}

function MechanicFilterGroup(props: {
  title: string;
  options: MechanicKey[];
  selected: MechanicKey[];
  onChange: (next: MechanicKey[]) => void;
}) {
  const { title, options, selected, onChange } = props;

  return (
    <section className="mechanic-filter" aria-label={title}>
      <div className="mechanic-filter-heading">
        <span>{title}</span>
        <button type="button" className={selected.length === 0 ? "active" : ""} onClick={() => onChange([])}>
          Any
        </button>
      </div>
      <div className="mechanic-options">
        {options.map((mechanic) => (
          <button
            type="button"
            key={mechanic}
            className={selected.includes(mechanic) ? "active" : ""}
            onClick={() => onChange(toggleMechanic(selected, mechanic))}
          >
            {mechanicLabel(mechanic)}
          </button>
        ))}
      </div>
    </section>
  );
}

function topMechanicScores(build: GeneratedBuild): Array<[MechanicKey, number]> {
  const profile = build.mechanicProfile;
  return [profile.primary, ...profile.secondary]
    .map((mechanic): [MechanicKey, number] => [mechanic, profile.scores[mechanic] ?? 0])
    .filter(([, score]) => score > 0)
    .slice(0, 6);
}

function entityEffectViews(entity: Pick<CatalogEntity, "structuredEffects">): StructuredEffectView[] {
  return structuredEffectViews(entity.structuredEffects);
}

function hasUnknownParse(entity: Pick<CatalogEntity, "structuredEffects" | "semanticEffects">): boolean {
  return (
    entity.structuredEffects.some(structuredEffectHasUnknown) ||
    Boolean(entity.semanticEffects?.clauses.some((clause) => clause.actions.some((node) => node.node === "atomic" && node.action.type === "unknown")))
  );
}

function catalogEntityMatchesQuery(entity: CatalogEntity, query: string): boolean {
  if (!query) return true;
  const semanticIndex = semanticSearchIndex(entity.semanticEffects);
  const searchable = [
    entity.name,
    entity.slug,
    entity.id,
    entity.text,
    ...entity.tags,
    semanticIndex.text,
    ...semanticIndex.mechanics,
    ...semanticIndex.itemTypes,
    ...semanticIndex.statuses,
    ...semanticIndex.actions,
    ...semanticIndex.triggers,
    ...semanticIndex.warnings,
    ...semanticSummary(entity.semanticEffects),
    ...entityEffectViews(entity).map((effect) => effect.rawText),
    ...entityEffectViews(entity).map(formatEffect)
  ]
    .join(" ")
    .toLowerCase();
  return searchable.includes(query);
}

function CatalogBrowser(props: {
  data: StaticData;
  onSelectItem: (item: ItemIndexEntry) => void;
  onSelectSkill: (skill: SkillIndexEntry) => void;
}) {
  const { data, onSelectItem, onSelectSkill } = props;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CatalogKind>("all");
  const [heroFilter, setHeroFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [unknownOnly, setUnknownOnly] = useState(false);

  const entities = useMemo<CatalogEntity[]>(
    () => [
      ...data.items.map((item) => ({ ...item, entityType: "item" as const })),
      ...data.skills.map((skill) => ({ ...skill, entityType: "skill" as const }))
    ],
    [data.items, data.skills]
  );

  const filteredEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entities
      .filter((entity) => kind === "all" || (kind === "items" ? entity.entityType === "item" : entity.entityType === "skill"))
      .filter((entity) => !heroFilter || itemMatchesHero(entity, heroFilter))
      .filter((entity) => !actionFilter || entityEffectViews(entity).some((effect) => effect.action.type === actionFilter))
      .filter((entity) => !unknownOnly || hasUnknownParse(entity))
      .filter((entity) => catalogEntityMatchesQuery(entity, normalizedQuery))
      .sort((a, b) => {
        const unknownDelta = Number(hasUnknownParse(b)) - Number(hasUnknownParse(a));
        if (unknownDelta !== 0 && unknownOnly) return unknownDelta;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 180);
  }, [actionFilter, entities, heroFilter, kind, query, unknownOnly]);

  const unknownCount = filteredEntities.filter(hasUnknownParse).length;
  const semanticWarningCount = filteredEntities.filter((entity) => semanticHasWarning(entity.semanticEffects)).length;

  return (
    <div className="catalog-workbench">
      <aside className="control-panel catalog-panel" aria-label="物品技能查询控件">
        <label className="field">
          <span>关键词</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、标签、效果文本、解析结果" />
        </label>

        <div className="segmented catalog-kind" role="group" aria-label="查询类型">
          <button type="button" className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>
            全部
          </button>
          <button type="button" className={kind === "items" ? "active" : ""} onClick={() => setKind("items")}>
            物品
          </button>
          <button type="button" className={kind === "skills" ? "active" : ""} onClick={() => setKind("skills")}>
            技能
          </button>
        </div>

        <label className="field">
          <span>英雄</span>
          <select value={heroFilter} onChange={(event) => setHeroFilter(event.target.value)}>
            <option value="">All / Common</option>
            {data.heroes.map((entry) => (
              <option value={entry.slug} key={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>动作类型</span>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">全部动作</option>
            {actionFilterOptions.map((action) => (
              <option value={action} key={action}>
                {actionLabels[action] ?? action}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle-row">
          <input type="checkbox" checked={unknownOnly} onChange={(event) => setUnknownOnly(event.target.checked)} />
          <span>只看未识别解析</span>
        </label>

        <div className="catalog-summary" aria-label="查询统计">
          <div>
            <strong>{filteredEntities.length}</strong>
            <span>当前结果</span>
          </div>
          <div>
            <strong>{unknownCount}</strong>
            <span>含未识别</span>
          </div>
          <div>
            <strong>{semanticWarningCount}</strong>
            <span>语义警告</span>
          </div>
        </div>

        <button
          type="button"
          className="reset-button"
          onClick={() => {
            setQuery("");
            setKind("all");
            setHeroFilter("");
            setActionFilter("");
            setUnknownOnly(false);
          }}
        >
          重置查询
        </button>
      </aside>

      <section className="catalog-results" aria-label="物品技能查询结果">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>物品 / 技能查询</h2>
            <p className="subtle">直接查看本地 JSON 的中文文本、标签和 parser 结构。</p>
          </div>
        </div>

        <div className="catalog-grid">
          {filteredEntities.map((entity) => (
            <article className={`catalog-card ${entity.entityType === "skill" ? "skill-card" : ""}`} key={`${entity.entityType}-${entity.id}`}>
              <div className="entity-title-row">
                {entity.imageUrl ? <img src={entity.imageUrl} alt="" loading="lazy" /> : null}
                <div>
                  <div className="catalog-title-line">
                    <h3>{entity.name}</h3>
                    <span className={entity.entityType === "skill" ? "type-badge skill" : "type-badge"}>{entity.entityType === "skill" ? "技能" : "物品"}</span>
                  </div>
                  <div className="meta-pills">
                    {entity.entityType === "item" ? <span>{entity.size}格</span> : <span>技能</span>}
                    <span>{entity.rarity ?? "未知稀有度"}</span>
                    {entity.entityType === "item" ? <span>{formatCooldown(entity.cooldownMs)}</span> : null}
                    <span>{entity.hero ?? "common"}</span>
                  </div>
                </div>
              </div>

              <p className="effect-text">{entity.text || "没有可展示的效果文本。"}</p>

              <div className="tag-row">
                {entity.tags.slice(0, 10).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <div className="structured-effects catalog-effects">
                {semanticSummary(entity.semanticEffects).slice(0, 4).map((summary, index) => (
                  <span className={semanticHasWarning(entity.semanticEffects) ? "semantic-effect semantic-warning" : "semantic-effect"} key={`${entity.id}-semantic-${index}`}>
                    {summary}
                  </span>
                ))}
                {entityEffectViews(entity).map((effect, index) => (
                  <span
                    className={
                      effect.trigger.event === "unknown" || effect.action.type === "unknown" || effect.target?.scope === "unknown"
                        ? "unknown-effect"
                        : ""
                    }
                    key={`${entity.id}-${index}`}
                    title={effect.rawText}
                  >
                    {formatEffect(effect)}
                  </span>
                ))}
              </div>

              <details className="raw-effect-block">
                <summary>原始效果文本</summary>
                <ul>
                  {entity.structuredEffects.map((effect, index) => (
                    <li key={`${entity.id}-raw-${index}`}>{effect.rawText || "空文本"}</li>
                  ))}
                </ul>
              </details>

              <button
                type="button"
                className="catalog-use-button"
                onClick={() => {
                  if (entity.entityType === "item") {
                    onSelectItem(entity);
                  } else {
                    onSelectSkill(entity);
                  }
                }}
              >
                加入构筑筛选
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<StaticData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("builds");
  const [hero, setHero] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [coreOutputs, setCoreOutputs] = useState<MechanicKey[]>([]);
  const [tempoMechanics, setTempoMechanics] = useState<MechanicKey[]>([]);
  const [controlMechanics, setControlMechanics] = useState<MechanicKey[]>([]);
  const [sustainMechanics, setSustainMechanics] = useState<MechanicKey[]>([]);
  const [mode, setMode] = useState<SearchMode>("similar");
  const [expandedBuildId, setExpandedBuildId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<ItemIndexEntry[]>("/item-index.json"),
      fetchJson<SkillIndexEntry[]>("/skill-index.json"),
      fetchJson<HeroDef[]>("/hero-index.json"),
      fetchJson<GeneratedBuild[]>("/generated-builds.json")
    ])
      .then(([items, skills, heroes, builds]) => {
        setData({ items, skills, heroes, builds });
        setHero(heroes[0]?.slug ?? "");
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to load generated data.");
      });
  }, []);

  const itemById = useMemo(() => new Map(data?.items.map((item) => [item.id, item]) ?? []), [data]);
  const skillById = useMemo(() => new Map(data?.skills.map((skill) => [skill.id, skill]) ?? []), [data]);

  const itemOptions = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!data || !hero || !query) return [];
    return data.items
      .filter((item) => itemMatchesHero(item, hero))
      .filter((item) => !selectedItemIds.includes(item.id))
      .filter((item) => item.name.toLowerCase().includes(query) || item.tags.some((tag) => tag.includes(query)))
      .slice(0, 8);
  }, [data, hero, itemQuery, selectedItemIds]);

  const skillOptions = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    if (!data || !hero || !query) return [];
    return data.skills
      .filter((skill) => itemMatchesHero(skill, hero))
      .filter((skill) => !selectedSkillIds.includes(skill.id))
      .filter((skill) => skill.name.toLowerCase().includes(query) || skill.tags.some((tag) => tag.includes(query)))
      .slice(0, 8);
  }, [data, hero, skillQuery, selectedSkillIds]);

  const selectedMechanicCount = coreOutputs.length + tempoMechanics.length + controlMechanics.length + sustainMechanics.length;

  const primaryResults = useMemo(() => {
    if (!data) return [];
    return searchGeneratedBuilds(data.builds, {
      hero,
      itemIds: selectedItemIds,
      skillIds: selectedSkillIds,
      coreOutputs,
      tempoMechanics,
      controlMechanics,
      sustainMechanics,
      mode,
      limit: 60
    });
  }, [data, hero, selectedItemIds, selectedSkillIds, coreOutputs, tempoMechanics, controlMechanics, sustainMechanics, mode]);

  const fallbackResults = useMemo(() => {
    if (!data || mode !== "exact" || primaryResults.length > 0 || selectedItemIds.length + selectedSkillIds.length === 0) {
      return [];
    }

    return searchGeneratedBuilds(data.builds, {
      hero,
      itemIds: selectedItemIds,
      skillIds: selectedSkillIds,
      coreOutputs,
      tempoMechanics,
      controlMechanics,
      sustainMechanics,
      mode: "similar",
      limit: 60
    });
  }, [data, hero, selectedItemIds, selectedSkillIds, coreOutputs, tempoMechanics, controlMechanics, sustainMechanics, mode, primaryResults.length]);

  const results = primaryResults.length > 0 ? primaryResults : fallbackResults;
  const showingSimilarFallback = mode === "exact" && primaryResults.length === 0 && fallbackResults.length > 0;

  const recommendations = useMemo(() => {
    if (!data) return [];
    return recommendNextItems(data.builds, {
      hero,
      itemIds: selectedItemIds,
      skillIds: selectedSkillIds,
      coreOutputs,
      tempoMechanics,
      controlMechanics,
      sustainMechanics
    }, 12, data.items);
  }, [data, hero, selectedItemIds, selectedSkillIds, coreOutputs, tempoMechanics, controlMechanics, sustainMechanics]);

  const selectedItems = selectedItemIds.map((id) => itemById.get(id)).filter((item): item is ItemIndexEntry => Boolean(item));
  const selectedSkills = selectedSkillIds.map((id) => skillById.get(id)).filter((skill): skill is SkillIndexEntry => Boolean(skill));

  const addItem = (item: ItemIndexEntry) => {
    setSelectedItemIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
    setItemQuery("");
  };

  const addSkill = (skill: SkillIndexEntry) => {
    setSelectedSkillIds((current) => (current.includes(skill.id) ? current : [...current, skill.id]));
    setSkillQuery("");
  };

  const selectedHeroName = data?.heroes.find((entry) => entry.slug === hero)?.name ?? "全部英雄";

  return (
    <main className="app-shell">
      <section className="toolbar-band">
        <div className="toolbar-copy">
          <p className="eyebrow">本地静态数据</p>
          <h1>The Bazaar 理论构筑查找器</h1>
          <p className="subtle">
            这些生成构筑来自本地 JSON 和可解释评分，只用于理论参考，不是已验证的环境构筑，也不是真实胜率预测。
          </p>
        </div>
        <div className="stat-strip" aria-label="Generated data summary">
          <span>{data?.items.length ?? 0} 个物品</span>
          <span>{data?.skills.length ?? 0} 个技能</span>
          <span>{data?.builds.length ?? 0} 个生成构筑</span>
        </div>
      </section>

      {data ? (
        <nav className="view-tabs" aria-label="主视图">
          <button type="button" className={activeView === "builds" ? "active" : ""} onClick={() => setActiveView("builds")}>
            构筑查找
          </button>
          <button type="button" className={activeView === "catalog" ? "active" : ""} onClick={() => setActiveView("catalog")}>
            物品 / 技能查询
          </button>
        </nav>
      ) : null}

      {error ? (
        <section className="empty-state">
          <h2>缺少生成文件</h2>
          <p>运行 <code>npm run generate:builds</code>，在 <code>public/</code> 中生成静态 JSON。</p>
          <p className="subtle">{error}</p>
        </section>
      ) : null}

      {data ? activeView === "builds" ? (
        <div className="workbench">
          <aside className="control-panel" aria-label="构筑搜索控件">
            <label className="field">
              <span>英雄</span>
              <select
                value={hero}
                onChange={(event) => {
                  setHero(event.target.value);
                  setSelectedItemIds([]);
                  setSelectedSkillIds([]);
                }}
              >
                {data.heroes.map((entry) => (
                  <option value={entry.slug} key={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="segmented" role="group" aria-label="搜索模式">
              <button className={mode === "exact" ? "active" : ""} type="button" onClick={() => setMode("exact")}>
                精确物品
              </button>
              <button className={mode === "similar" ? "active" : ""} type="button" onClick={() => setMode("similar")}>
                相似物品
              </button>
              <button className={mode === "mechanic" ? "active" : ""} type="button" onClick={() => setMode("mechanic")}>
                机制匹配
              </button>
            </div>

            <label className="field autocomplete">
              <span>物品</span>
              <input
                value={itemQuery}
                onChange={(event) => setItemQuery(event.target.value)}
                placeholder="搜索物品或标签"
              />
              {itemOptions.length > 0 ? (
                <div className="suggestions">
                  {itemOptions.map((item) => (
                    <button type="button" key={item.id} onClick={() => addItem(item)}>
                      <span>{item.name}</span>
                      <small>{item.tags.slice(0, 3).join(" / ")}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <div className="chip-zone" aria-label="已选择物品">
              {selectedItems.map((item) => (
                <button
                  className="chip"
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemIds((current) => current.filter((id) => id !== item.id))}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <label className="field autocomplete">
              <span>可选技能</span>
              <input
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
                placeholder="搜索技能或标签"
              />
              {skillOptions.length > 0 ? (
                <div className="suggestions">
                  {skillOptions.map((skill) => (
                    <button type="button" key={skill.id} onClick={() => addSkill(skill)}>
                      <span>{skill.name}</span>
                      <small>{skill.tags.slice(0, 3).join(" / ")}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <div className="chip-zone" aria-label="已选择技能">
              {selectedSkills.map((skill) => (
                <button
                  className="chip skill"
                  key={skill.id}
                  type="button"
                  onClick={() => setSelectedSkillIds((current) => current.filter((id) => id !== skill.id))}
                >
                  {skill.name}
                </button>
              ))}
            </div>

            <MechanicFilterGroup title="Core Output" options={coreOutputOptions} selected={coreOutputs} onChange={setCoreOutputs} />
            <MechanicFilterGroup title="Tempo" options={tempoOptions} selected={tempoMechanics} onChange={setTempoMechanics} />
            <MechanicFilterGroup title="Control" options={controlOptions} selected={controlMechanics} onChange={setControlMechanics} />
            <MechanicFilterGroup title="Sustain" options={sustainOptions} selected={sustainMechanics} onChange={setSustainMechanics} />

            <section className="recommendations" aria-label="推荐下一件物品">
              <h2>推荐下一件物品</h2>
              {recommendations.length > 0 ? (
                recommendations.map((item) => (
                  <button
                    type="button"
                    key={item.itemId}
                    onClick={() => setSelectedItemIds((current) => [...current, item.itemId])}
                    disabled={selectedItemIds.includes(item.itemId)}
                  >
                    <span>{item.itemName}</span>
                    <strong>{item.recommendationScore}</strong>
                  </button>
                ))
              ) : (
                <p className="subtle">选择物品、技能或机制后，会根据匹配的生成构筑推荐后续物品。</p>
              )}
            </section>
          </aside>

          <section className="results-panel" aria-label="生成构筑搜索结果">
            <div className="results-heading">
              <div>
                <p className="eyebrow">{selectedHeroName}</p>
                <h2>{results.length} 个理论构筑</h2>
                {selectedMechanicCount > 0 ? <p className="subtle">已应用 {selectedMechanicCount} 个机制筛选。</p> : null}
                {showingSimilarFallback ? (
                  <p className="subtle">没有找到同时包含全部已选项的精确构筑，下面展示包含部分已选项的相似构筑。</p>
                ) : null}
              </div>
              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  setSelectedItemIds([]);
                  setSelectedSkillIds([]);
                  setCoreOutputs([]);
                  setTempoMechanics([]);
                  setControlMechanics([]);
                  setSustainMechanics([]);
                  setItemQuery("");
                  setSkillQuery("");
                }}
              >
                重置
              </button>
            </div>

            <div className="build-list">
              {results.length === 0 ? (
                <article className="empty-state">
                  <h2>没有匹配结果</h2>
                  <p className="subtle">这些已选物品可能没有进入当前静态生成集合。可以切到“相似构筑”，或重新生成更大的构筑集合。</p>
                </article>
              ) : null}
              {results.map((build) => {
                const isExpanded = expandedBuildId === build.id;

                return (
                  <article className={`build-card ${isExpanded ? "expanded" : ""}`} key={build.id}>
                    <div className="build-row">
                      <div className="build-row-meta">
                        <span>{build.archetype}</span>
                        <strong>{scoreLabel(build.finalScore ?? build.powerScore)}</strong>
                        <small>{mechanicLabel(build.mechanicProfile.primary)}</small>
                      </div>
                      {build.layout ? <BoardPreview layout={build.layout} itemById={itemById} showHeader={false} /> : null}
                      <button
                        type="button"
                        className="build-detail-toggle"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedBuildId((current) => (current === build.id ? null : build.id))}
                      >
                        {isExpanded ? "收起" : "详情"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="build-detail-panel">
                        <section className="mechanic-profile" aria-label="机制画像">
                          <div className="mechanic-primary">
                            <span>Primary</span>
                            <strong>{mechanicLabel(build.mechanicProfile.primary)}</strong>
                          </div>
                          {build.mechanicProfile.labels.length > 0 ? (
                            <div className="mechanic-labels">
                              {build.mechanicProfile.labels.map((label) => (
                                <span key={label}>{label}</span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mechanic-score-badges">
                            {topMechanicScores(build).map(([mechanic, score]) => (
                              <span key={mechanic}>
                                {mechanicLabel(mechanic)}
                                <strong>{score}</strong>
                              </span>
                            ))}
                          </div>
                          {build.mechanicProfile.explanation.length > 0 ? (
                            <ul className="mechanic-explanation">
                              {build.mechanicProfile.explanation.slice(0, 3).map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>

                        <dl className="score-row">
                          <div>
                            <dt>强度</dt>
                            <dd>{build.powerScore}</dd>
                          </div>
                          <div>
                            <dt>匹配</dt>
                            <dd>{scoreLabel(build.matchScore)}</dd>
                          </div>
                          <div>
                            <dt>机制</dt>
                            <dd>{scoreLabel(build.mechanicMatchScore)}</dd>
                          </div>
                          <div>
                            <dt>布局</dt>
                            <dd>{scoreLabel(build.layoutScore)}</dd>
                          </div>
                          <div>
                            <dt>格子</dt>
                            <dd>{build.usedSlots}/10</dd>
                          </div>
                        </dl>

                        {build.layout ? <BoardPreview layout={build.layout} itemById={itemById} showHeader={false} variant="detail" /> : null}

                        {build.skillIds.length > 0 ? (
                          <details className="effect-section">
                            <summary>技能特效详情</summary>
                            <div className="entity-detail-list">
                              {build.skillIds.map((id) => skillById.get(id)).filter((skill): skill is SkillIndexEntry => Boolean(skill)).map((skill) => (
                                <div className="entity-detail skill-detail" key={skill.id}>
                                  <div className="entity-title-row">
                                    {skill.imageUrl ? <img src={skill.imageUrl} alt="" loading="lazy" /> : null}
                                    <div>
                                      <h3>{skill.name}</h3>
                                      <div className="meta-pills">
                                        <span>技能</span>
                                        <span>{skill.rarity ?? "未知稀有度"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="effect-text">{skill.text || "没有可展示的效果文本。"}</p>
                                  <div className="tag-row">
                                    {skill.tags.slice(0, 6).map((tag) => (
                                      <span key={tag}>{tag}</span>
                                    ))}
                                  </div>
                                  <div className="structured-effects">
                                    {skill.structuredEffects.slice(0, 4).map((effect, index) => (
                                      <span key={`${skill.id}-${index}`}>{formatEffect(structuredEffectView(effect))}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        <div className="list-block">
                          <h3>评分理由</h3>
                          <ul>
                            {build.reasons.slice(0, 4).map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                        {build.warnings.length > 0 ? (
                          <div className="warnings">
                            {build.warnings.slice(0, 3).map((warning) => (
                              <span key={warning}>{warning}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <CatalogBrowser
          data={data}
          onSelectItem={(item) => {
            addItem(item);
            setActiveView("builds");
          }}
          onSelectSkill={(skill) => {
            addSkill(skill);
            setActiveView("builds");
          }}
        />
      ) : null}
    </main>
  );
}
