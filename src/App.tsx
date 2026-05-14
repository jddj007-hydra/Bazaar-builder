import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { BoardPreview } from "./BoardPreview";
import { getEmptySlots, isValidPlacement, placeItem, scoreLayout } from "./lib/bazaar-data/layout";
import { mechanicLabel } from "./lib/bazaar-data/mechanics";
import { optimizeLayoutForBuild } from "./lib/bazaar-data/optimizeLayout";
import { recommendNextItems, searchGeneratedBuilds } from "./lib/bazaar-data/searchGeneratedBuilds";
import { semanticHasWarning, semanticSearchIndex, semanticSummary } from "./lib/bazaar-data/semanticConsumption";
import { simulateCustomBuild, type BuildSimulationResult } from "./lib/bazaar-data/simulateCustomBuild";
import { structuredEffectHasUnknown, structuredEffectView, structuredEffectViews, type StructuredEffectView } from "./lib/bazaar-data/structuredEffects";
import type {
  BoardLayout,
  GeneratedBuild,
  HeroDef,
  ItemIndexEntry,
  MechanicKey,
  PlacedItem,
  SearchMode,
  SkillIndexEntry
} from "./lib/bazaar-data/types";

type StaticData = {
  items: ItemIndexEntry[];
  skills: SkillIndexEntry[];
  heroes: HeroDef[];
  builds: GeneratedBuild[];
};

type AppView = "builds" | "custom" | "catalog";
type CatalogKind = "items" | "skills";
type CatalogFilters = {
  query: string;
  hero: string;
  categories: string[];
  size: string;
  actions: string[];
  unknownOnly: boolean;
};
type AppRoute =
  | { view: "builds" }
  | { view: "custom" }
  | { view: "catalog"; kind: CatalogKind; params: URLSearchParams };
type CatalogEntity =
  | (ItemIndexEntry & { entityType: "item" })
  | (SkillIndexEntry & { entityType: "skill" });
type CustomBuildDraft = {
  id: string;
  name: string;
  hero: string;
  itemIds: string[];
  skillIds: string[];
  placements?: PlacedItem[];
  durationSeconds: number;
  savedAt: string;
};

const customBuildStorageKey = "bazaar-builder.custom-builds.v1";

function defaultCatalogFilters(): CatalogFilters {
  return {
    query: "",
    hero: "",
    categories: [],
    size: "",
    actions: [],
    unknownOnly: false
  };
}

function csvParam(value: string | null): string[] {
  return value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : [];
}

function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const categories = csvParam(params.get("cat")).filter((category) => itemCategoryOptions.some((option) => option.value === category));
  const actions = csvParam(params.get("actions")).filter((action) => actionFilterOptions.includes(action));
  const size = params.get("size") ?? "";

  return {
    query: params.get("q") ?? "",
    hero: params.get("hero") ?? "",
    categories,
    size: itemSizeOptions.some((option) => option.value === size) ? size : "",
    actions,
    unknownOnly: params.get("unknown") === "1"
  };
}

function catalogFiltersToParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.hero) params.set("hero", filters.hero);
  if (filters.categories.length > 0) params.set("cat", filters.categories.join(","));
  if (filters.size) params.set("size", filters.size);
  if (filters.actions.length > 0) params.set("actions", filters.actions.join(","));
  if (filters.unknownOnly) params.set("unknown", "1");
  return params;
}

function defaultCatalogRoute(): Extract<AppRoute, { view: "catalog" }> {
  return { view: "catalog", kind: "items", params: new URLSearchParams() };
}

function parseHashRoute(hash: string): AppRoute {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathText, searchText = ""] = raw.split("?");
  const parts = pathText.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  if (parts[0] === "custom") return { view: "custom" };
  if (parts[0] === "catalog") {
    return {
      view: "catalog",
      kind: parts[1] === "skills" ? "skills" : "items",
      params: new URLSearchParams(searchText)
    };
  }
  return { view: "builds" };
}

function currentRoute(): AppRoute {
  return typeof window === "undefined" ? { view: "builds" } : parseHashRoute(window.location.hash);
}

function routeToHash(route: AppRoute): string {
  if (route.view === "builds") return "#/builds";
  if (route.view === "custom") return "#/custom";
  const search = route.params.toString();
  return `#/catalog/${route.kind}${search ? `?${search}` : ""}`;
}

function storedCatalogRoute(): Extract<AppRoute, { view: "catalog" }> {
  const route = currentRoute();
  return route.view === "catalog" ? route : defaultCatalogRoute();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }
  return response.json() as Promise<T>;
}

function loadSavedCustomBuilds(): CustomBuildDraft[] {
  try {
    const raw = window.localStorage.getItem(customBuildStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry): CustomBuildDraft | null => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const itemIds = Array.isArray(record.itemIds) ? record.itemIds.filter((id): id is string => typeof id === "string") : [];
        const skillIds = Array.isArray(record.skillIds) ? record.skillIds.filter((id): id is string => typeof id === "string") : [];
        if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.hero !== "string") return null;
        return {
          id: record.id,
          name: record.name,
          hero: record.hero,
          itemIds,
          skillIds,
          placements: Array.isArray(record.placements)
            ? record.placements
                .map((placement): PlacedItem | null => {
                  if (!placement || typeof placement !== "object") return null;
                  const value = placement as Record<string, unknown>;
                  if (
                    typeof value.itemId !== "string" ||
                    typeof value.itemName !== "string" ||
                    typeof value.size !== "number" ||
                    typeof value.startSlot !== "number" ||
                    typeof value.endSlot !== "number"
                  ) {
                    return null;
                  }
                  if (![1, 2, 3].includes(value.size)) return null;
                  return {
                    itemId: value.itemId,
                    itemName: value.itemName,
                    size: value.size as 1 | 2 | 3,
                    startSlot: value.startSlot,
                    endSlot: value.endSlot
                  };
                })
                .filter((placement): placement is PlacedItem => Boolean(placement))
            : undefined,
          durationSeconds: typeof record.durationSeconds === "number" ? record.durationSeconds : 30,
          savedAt: typeof record.savedAt === "string" ? record.savedAt : new Date().toISOString()
        };
      })
      .filter((entry): entry is CustomBuildDraft => Boolean(entry));
  } catch {
    return [];
  }
}

function saveCustomBuilds(builds: CustomBuildDraft[]): void {
  window.localStorage.setItem(customBuildStorageKey, JSON.stringify(builds));
}

function itemMatchesHero(item: Pick<ItemIndexEntry, "hero">, hero: string): boolean {
  return item.hero == null || item.hero === hero;
}

function totalItemSize(items: Array<Pick<ItemIndexEntry, "size">>): number {
  return items.reduce((sum, item) => sum + item.size, 0);
}

function itemsAsLayoutItems(items: ItemIndexEntry[]) {
  return items.map((item) => ({ ...item, raw: null }));
}

function skillsAsLayoutSkills(skills: SkillIndexEntry[]) {
  return skills.map((skill) => ({ ...skill, raw: null }));
}

function compactLayoutFromPlacements(items: ItemIndexEntry[], skills: SkillIndexEntry[], placements: PlacedItem[]): BoardLayout {
  const layoutItems = itemsAsLayoutItems(items);
  const layoutSkills = skillsAsLayoutSkills(skills);
  const scored = scoreLayout({
    items: layoutItems,
    skills: layoutSkills,
    placements,
    slotLimit: 10
  });
  const usedSlots = placements.reduce((sum, placement) => sum + placement.size, 0);
  return {
    slotLimit: 10,
    placements: [...placements].sort((a, b) => a.startSlot - b.startSlot),
    usedSlots,
    emptySlots: getEmptySlots(placements, 10),
    layoutScore: scored.score,
    reasons: scored.reasons,
    warnings: scored.warnings
  };
}

function sanitizePlacements(items: ItemIndexEntry[], placements: PlacedItem[] | undefined): PlacedItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const next: PlacedItem[] = [];

  for (const placement of placements ?? []) {
    const item = itemById.get(placement.itemId);
    if (!item) continue;
    if (!isValidPlacement(next, item.size, placement.startSlot, 10)) continue;
    next.push({
      itemId: item.id,
      itemName: item.name,
      size: item.size,
      startSlot: placement.startSlot,
      endSlot: placement.startSlot + item.size - 1
    });
  }

  let cursor = 0;
  for (const item of items) {
    if (next.some((placement) => placement.itemId === item.id)) continue;
    while (cursor <= 10 - item.size && !isValidPlacement(next, item.size, cursor, 10)) {
      cursor += 1;
    }
    if (cursor <= 10 - item.size) {
      next.push({
        itemId: item.id,
        itemName: item.name,
        size: item.size,
        startSlot: cursor,
        endSlot: cursor + item.size - 1
      });
      cursor += item.size;
    }
  }

  return next.sort((a, b) => a.startSlot - b.startSlot);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
  effect_sequence_completed: "效果序列完成",
  player_attribute_threshold: "玩家属性阈值",
  player_attribute_changed: "玩家属性变化",
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
  lowest_value: "最低价值物品",
  highest_value: "最高价值物品",
  allied_items: "己方物品",
  enemy_items: "敌方物品",
  all_items: "所有物品",
  allied_skills: "己方技能",
  trigger_source: "触发源物品",
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
const itemCategoryOptions = [
  { value: "weapon", label: "武器" },
  { value: "tool", label: "工具" },
  { value: "friend", label: "伙伴" },
  { value: "property", label: "地产" },
  { value: "food", label: "食物" },
  { value: "vehicle", label: "载具" },
  { value: "relic", label: "遗物" },
  { value: "apparel", label: "服饰" },
  { value: "toy", label: "玩具" },
  { value: "potion", label: "药水" },
  { value: "loot", label: "战利品" },
  { value: "aquatic", label: "水生" },
  { value: "drone", label: "无人机" },
  { value: "core", label: "核心" },
  { value: "reagent", label: "试剂" },
  { value: "trap", label: "陷阱" }
];
const itemSizeOptions = [
  { value: "1", label: "小" },
  { value: "2", label: "中" },
  { value: "3", label: "大" }
];

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

function itemMatchesCategory(item: Pick<ItemIndexEntry, "tags">, categories: string[]): boolean {
  return categories.length === 0 || categories.some((category) => item.tags.includes(category));
}

function itemMatchesSize(item: Pick<ItemIndexEntry, "size">, size: string): boolean {
  return !size || item.size === Number(size);
}

function itemMatchesItemFilters(item: Pick<ItemIndexEntry, "tags" | "size">, categories: string[], size: string): boolean {
  return itemMatchesCategory(item, categories) && itemMatchesSize(item, size);
}

function toggleString(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
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

function ChoiceFilter(props: {
  title: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  const { title, value, options, allLabel, onChange } = props;
  const allOptions = [{ value: "", label: allLabel }, ...options];

  return (
    <section className="choice-filter" aria-label={title}>
      <span>{title}</span>
      <div className="choice-options" role="radiogroup" aria-label={title}>
        {allOptions.map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "active" : ""}
            key={option.value || "all"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function MultiChoiceFilter(props: {
  title: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (values: string[]) => void;
}) {
  const { title, values, options, allLabel, onChange } = props;

  return (
    <section className="choice-filter" aria-label={title}>
      <span>{title}</span>
      <div className="choice-options" role="group" aria-label={title}>
        <button type="button" className={values.length === 0 ? "active" : ""} onClick={() => onChange([])}>
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            type="button"
            aria-pressed={values.includes(option.value)}
            className={values.includes(option.value) ? "active" : ""}
            key={option.value}
            onClick={() => onChange(toggleString(values, option.value))}
          >
            {option.label}
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
  kind: CatalogKind;
  filters: CatalogFilters;
  selectedItems: ItemIndexEntry[];
  selectedSkills: SkillIndexEntry[];
  previewLayout: BoardLayout | null;
  itemById: Map<string, ItemIndexEntry>;
  onKindChange: (kind: CatalogKind) => void;
  onFiltersChange: (filters: CatalogFilters) => void;
  onSelectItem: (item: ItemIndexEntry) => void;
  onSelectSkill: (skill: SkillIndexEntry) => void;
}) {
  const {
    data,
    filters,
    kind,
    selectedItems,
    selectedSkills,
    previewLayout,
    itemById,
    onFiltersChange,
    onKindChange,
    onSelectItem,
    onSelectSkill
  } = props;
  const { query, hero: heroFilter, categories: itemCategoryFilter, size: itemSizeFilter, actions: actionFilter, unknownOnly } = filters;
  const [showBuildPreview, setShowBuildPreview] = useState(false);
  const updateFilters = (next: Partial<CatalogFilters>) => onFiltersChange({ ...filters, ...next });
  const previewUsedSlots = totalItemSize(selectedItems);

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
      .filter((entity) => entity.entityType === (kind === "items" ? "item" : "skill"))
      .filter((entity) => !heroFilter || itemMatchesHero(entity, heroFilter))
      .filter((entity) => entity.entityType === "skill" || itemMatchesItemFilters(entity, itemCategoryFilter, itemSizeFilter))
      .filter((entity) => actionFilter.length === 0 || entityEffectViews(entity).some((effect) => actionFilter.includes(effect.action.type)))
      .filter((entity) => !unknownOnly || hasUnknownParse(entity))
      .filter((entity) => catalogEntityMatchesQuery(entity, normalizedQuery))
      .sort((a, b) => {
        const unknownDelta = Number(hasUnknownParse(b)) - Number(hasUnknownParse(a));
        if (unknownDelta !== 0 && unknownOnly) return unknownDelta;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 180);
  }, [actionFilter, entities, heroFilter, itemCategoryFilter, itemSizeFilter, kind, query, unknownOnly]);

  const unknownCount = filteredEntities.filter(hasUnknownParse).length;
  const semanticWarningCount = filteredEntities.filter((entity) => semanticHasWarning(entity.semanticEffects)).length;

  return (
    <div className="catalog-workbench">
      <aside className="control-panel catalog-panel" aria-label="物品技能查询控件">
        <label className="field">
          <span>关键词</span>
          <input value={query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="名称、标签、效果文本、解析结果" />
        </label>

        <div className="segmented catalog-kind" role="group" aria-label="查询类型">
          <button type="button" className={kind === "items" ? "active" : ""} onClick={() => onKindChange("items")}>
            物品
          </button>
          <button type="button" className={kind === "skills" ? "active" : ""} onClick={() => onKindChange("skills")}>
            技能
          </button>
        </div>

        <ChoiceFilter
          title="英雄"
          value={heroFilter}
          options={data.heroes.map((entry) => ({ value: entry.slug, label: entry.name }))}
          allLabel="全部"
          onChange={(hero) => updateFilters({ hero })}
        />

        {kind === "items" ? (
          <>
            <MultiChoiceFilter
              title="物品类别"
              values={itemCategoryFilter}
              options={itemCategoryOptions}
              allLabel="全部"
              onChange={(categories) => updateFilters({ categories })}
            />

            <ChoiceFilter
              title="物品尺寸"
              value={itemSizeFilter}
              options={itemSizeOptions}
              allLabel="全部"
              onChange={(size) => updateFilters({ size })}
            />
          </>
        ) : null}

        <MultiChoiceFilter
          title="动作类型"
          values={actionFilter}
          options={actionFilterOptions.map((action) => ({ value: action, label: actionLabels[action] ?? action }))}
          allLabel="全部"
          onChange={(actions) => updateFilters({ actions })}
        />

        <label className="toggle-row">
          <input type="checkbox" checked={unknownOnly} onChange={(event) => updateFilters({ unknownOnly: event.target.checked })} />
          <span>只看未识别解析</span>
        </label>

        <label className="toggle-row">
          <input type="checkbox" checked={showBuildPreview} onChange={(event) => setShowBuildPreview(event.target.checked)} />
          <span>预览当前构筑</span>
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
          onClick={() => onFiltersChange(defaultCatalogFilters())}
        >
          重置查询
        </button>
      </aside>

      <section className="catalog-results" aria-label="物品技能查询结果">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>{kind === "items" ? "物品查询" : "技能查询"}</h2>
            <p className="subtle">{kind === "items" ? "筛选物品并加入自定义构筑的物品栏。" : "筛选技能并加入自定义构筑的技能栏。"}</p>
          </div>
        </div>

        {showBuildPreview ? (
          <section className="catalog-build-preview" aria-label="当前自定义构筑预览">
            <div className="catalog-preview-heading">
              <div>
                <h3>当前自定义构筑</h3>
                <p>
                  {previewUsedSlots}/10 格 · {selectedItems.length} 个物品 · {selectedSkills.length} 个技能
                </p>
              </div>
            </div>

            {selectedItems.length === 0 && selectedSkills.length === 0 ? <p className="subtle">还没有选择物品或技能。</p> : null}
            {previewLayout ? <BoardPreview layout={previewLayout} itemById={itemById} showHeader={false} /> : null}
            {selectedItems.length > 0 && !previewLayout ? (
              <p className="slot-summary invalid">已选择 {previewUsedSlots}/10 格，移除部分物品后才能生成棋盘布局。</p>
            ) : null}

            {selectedItems.length > 0 ? (
              <div className="catalog-preview-chips" aria-label="当前构筑物品">
                {selectedItems.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            ) : null}

            {selectedSkills.length > 0 ? (
              <div className="catalog-preview-chips skills" aria-label="当前构筑技能">
                {selectedSkills.map((skill) => (
                  <span key={skill.id}>{skill.name}</span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

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
                {entity.entityType === "item" ? "加入物品栏" : "加入技能栏"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CustomBoardEditor(props: {
  layout: BoardLayout;
  itemById: Map<string, ItemIndexEntry>;
  selectedItems: ItemIndexEntry[];
  selectedSkills: SkillIndexEntry[];
  onPlacementsChange: (placements: PlacedItem[]) => void;
  onAutoLayout: () => void;
}) {
  const { layout, itemById, selectedItems, selectedSkills, onPlacementsChange, onAutoLayout } = props;
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [layoutMessage, setLayoutMessage] = useState<string>("");

  const occupiedSlots = new Set(layout.placements.flatMap((placement) =>
    Array.from({ length: placement.size }, (_, index) => placement.startSlot + index)
  ));
  const draggedItem = draggedItemId ? itemById.get(draggedItemId) ?? null : null;
  const validHover = draggedItem && hoverSlot != null
    ? isValidPlacement(layout.placements.filter((placement) => placement.itemId !== draggedItem.id), draggedItem.size, hoverSlot, 10)
    : false;

  const moveItem = (itemId: string, startSlot: number) => {
    const item = itemById.get(itemId);
    if (!item) return;
    const otherPlacements = layout.placements.filter((placement) => placement.itemId !== itemId);
    if (!isValidPlacement(otherPlacements, item.size, startSlot, 10)) {
      setLayoutMessage(`${item.name} 不能放在 ${startSlot + 1} 号格。`);
      return;
    }

    const next = placeItem(otherPlacements, { ...item, raw: null }, startSlot);
    onPlacementsChange(next);
    setLayoutMessage(`${item.name} 已移动到 ${startSlot + 1}-${startSlot + item.size}。`);
  };

  return (
    <section className="custom-board-editor" aria-label="自定义棋盘布局">
      <div className="board-preview-heading custom-board-heading">
        <div>
          <h3>自定义棋盘布局</h3>
          <p>{layout.usedSlots}/10 格 · 布局分 {layout.layoutScore}</p>
        </div>
        <button
          type="button"
          className="reset-button"
          onClick={() => {
            onAutoLayout();
            setLayoutMessage("已恢复自动布局。");
          }}
        >
          自动布局
        </button>
      </div>

      <div className="custom-board-grid" style={{ gridTemplateColumns: `repeat(${layout.slotLimit}, minmax(72px, 1fr))` }}>
        {Array.from({ length: layout.slotLimit }, (_, slot) => (
          <button
            type="button"
            aria-label={`放到第 ${slot + 1} 格`}
            className={[
              "custom-board-slot",
              occupiedSlots.has(slot) ? "occupied" : "",
              hoverSlot === slot && validHover ? "drop-valid" : "",
              hoverSlot === slot && draggedItem && !validHover ? "drop-invalid" : ""
            ].filter(Boolean).join(" ")}
            key={`custom-slot-${slot}`}
            style={{ gridColumn: `${slot + 1} / span 1`, gridRow: 1 }}
            onDragOver={(event) => {
              event.preventDefault();
              setHoverSlot(slot);
            }}
            onDragLeave={() => setHoverSlot((current) => (current === slot ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const itemId = event.dataTransfer.getData("text/plain") || draggedItemId;
              setHoverSlot(null);
              setDraggedItemId(null);
              if (itemId) moveItem(itemId, slot);
            }}
          >
            {slot + 1}
          </button>
        ))}

        {layout.placements.map((placement) => {
          const item = itemById.get(placement.itemId);
          if (!item) return null;
          return (
            <div
              className="custom-board-item"
              draggable
              key={placement.itemId}
              style={{ gridColumn: `${placement.startSlot + 1} / span ${placement.size}`, gridRow: 1 }}
              title={`${item.name}，拖拽可改变位置`}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
                setDraggedItemId(item.id);
                setLayoutMessage("");
              }}
              onDragEnd={() => {
                setDraggedItemId(null);
                setHoverSlot(null);
              }}
            >
              <div className="board-card-art">
                {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="board-card-fallback">{item.name.slice(0, 2)}</span>}
                {item.value != null && item.value > 0 ? <span className="board-card-value">{item.value}</span> : null}
                {item.cooldownMs ? <span className="board-card-cooldown">{formatCooldown(item.cooldownMs).replace("秒冷却", "s")}</span> : null}
                <span className="board-card-name">{item.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="custom-board-roster" aria-label="当前卡牌顺序">
        {layout.placements.map((placement) => {
          const item = itemById.get(placement.itemId);
          return item ? (
            <button
              type="button"
              key={`${placement.itemId}-roster`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
                setDraggedItemId(item.id);
              }}
              onClick={() => setLayoutMessage(`${item.name} 当前在 ${placement.startSlot + 1}-${placement.endSlot + 1} 号格。`)}
            >
              <span>{item.name}</span>
              <small>{placement.startSlot + 1}-{placement.endSlot + 1}</small>
            </button>
          ) : null;
        })}
      </div>

      {selectedSkills.length > 0 ? (
        <div className="custom-board-skills">
          {selectedSkills.map((skill) => (
            <span key={skill.id}>{skill.name}</span>
          ))}
        </div>
      ) : null}

      {layoutMessage ? <p className="custom-board-message">{layoutMessage}</p> : null}
      {layout.reasons.length > 0 ? (
        <ul className="layout-notes">
          {layout.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {layout.warnings.length > 0 ? (
        <div className="layout-warnings">
          {layout.warnings.slice(0, 3).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      {selectedItems.length !== layout.placements.length ? (
        <div className="layout-warnings">
          <span>部分物品没有合法位置，请检查 10 格占用。</span>
        </div>
      ) : null}
    </section>
  );
}

function CustomBuildWorkbench(props: {
  data: StaticData;
  hero: string;
  setHero: (hero: string) => void;
  selectedItems: ItemIndexEntry[];
  selectedSkills: SkillIndexEntry[];
  selectedItemIds: string[];
  selectedSkillIds: string[];
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  setSelectedSkillIds: Dispatch<SetStateAction<string[]>>;
  addItem: (item: ItemIndexEntry) => void;
  addSkill: (skill: SkillIndexEntry) => void;
  itemById: Map<string, ItemIndexEntry>;
}) {
  const {
    data,
    hero,
    setHero,
    selectedItems,
    selectedSkills,
    selectedItemIds,
    selectedSkillIds,
    setSelectedItemIds,
    setSelectedSkillIds,
    addItem,
    addSkill,
    itemById
  } = props;
  const [itemQuery, setItemQuery] = useState("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string[]>([]);
  const [itemSizeFilter, setItemSizeFilter] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [customName, setCustomName] = useState("自定义构筑");
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [savedBuilds, setSavedBuilds] = useState<CustomBuildDraft[]>(() => loadSavedCustomBuilds());
  const [activeSavedId, setActiveSavedId] = useState<string>("");
  const [manualPlacements, setManualPlacements] = useState<PlacedItem[]>([]);

  const selectedHeroName = data.heroes.find((entry) => entry.slug === hero)?.name ?? "全部英雄";
  const activeSavedBuild = savedBuilds.find((build) => build.id === activeSavedId) ?? null;
  const isEditingSavedBuild = Boolean(activeSavedBuild);
  const usedSlots = totalItemSize(selectedItems);
  const isOverSlotLimit = usedSlots > 10;

  const itemOptions = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!hero || !query) return [];
    return data.items
      .filter((item) => itemMatchesHero(item, hero))
      .filter((item) => !selectedItemIds.includes(item.id))
      .filter((item) => usedSlots + item.size <= 10)
      .filter((item) => itemMatchesItemFilters(item, itemCategoryFilter, itemSizeFilter))
      .filter((item) => catalogEntityMatchesQuery({ ...item, entityType: "item" }, query))
      .slice(0, 10);
  }, [data.items, hero, itemCategoryFilter, itemQuery, itemSizeFilter, selectedItemIds, usedSlots]);

  const skillOptions = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    if (!hero || !query) return [];
    return data.skills
      .filter((skill) => itemMatchesHero(skill, hero))
      .filter((skill) => !selectedSkillIds.includes(skill.id))
      .filter((skill) => catalogEntityMatchesQuery({ ...skill, entityType: "skill" }, query))
      .slice(0, 10);
  }, [data.skills, hero, selectedSkillIds, skillQuery]);

  const autoLayout = useMemo<BoardLayout | null>(() => {
    if (selectedItems.length === 0 || isOverSlotLimit) return null;
    return optimizeLayoutForBuild({
      items: itemsAsLayoutItems(selectedItems),
      skills: skillsAsLayoutSkills(selectedSkills),
      beamWidth: 120,
      maxLayouts: 1200
    });
  }, [isOverSlotLimit, selectedItems, selectedSkills]);

  useEffect(() => {
    if (selectedItems.length === 0 || isOverSlotLimit) {
      setManualPlacements([]);
      return;
    }

    setManualPlacements((current) => {
      const base = current.length > 0 ? current : autoLayout?.placements;
      return sanitizePlacements(selectedItems, base);
    });
  }, [autoLayout, isOverSlotLimit, selectedItems]);

  const customLayout = useMemo<BoardLayout | null>(() => {
    if (selectedItems.length === 0 || isOverSlotLimit) return null;
    const placements = sanitizePlacements(selectedItems, manualPlacements.length > 0 ? manualPlacements : autoLayout?.placements);
    return compactLayoutFromPlacements(selectedItems, selectedSkills, placements);
  }, [autoLayout, isOverSlotLimit, manualPlacements, selectedItems, selectedSkills]);

  const simulation = useMemo<BuildSimulationResult>(() => {
    return simulateCustomBuild({
      items: selectedItems,
      skills: selectedSkills,
      layout: customLayout,
      durationSeconds
    });
  }, [customLayout, durationSeconds, selectedItems, selectedSkills]);

  const persistBuilds = (next: CustomBuildDraft[]) => {
    setSavedBuilds(next);
    saveCustomBuilds(next);
  };

  const saveCurrentBuild = () => {
    if (selectedItems.length === 0) return;
    const now = new Date().toISOString();
    const id = isEditingSavedBuild ? activeSavedId : `custom-${Date.now().toString(36)}`;
    const nextBuild: CustomBuildDraft = {
      id,
      name: customName.trim() || `${selectedHeroName} 自定义构筑`,
      hero,
      itemIds: selectedItemIds,
      skillIds: selectedSkillIds,
      placements: customLayout?.placements ?? [],
      durationSeconds,
      savedAt: now
    };
    const next = [nextBuild, ...savedBuilds.filter((build) => build.id !== id)].slice(0, 30);
    persistBuilds(next);
    setActiveSavedId(id);
    setCustomName(nextBuild.name);
  };

  const startNewBuild = () => {
    setActiveSavedId("");
    setCustomName("自定义构筑");
    setDurationSeconds(30);
    setSelectedItemIds([]);
    setSelectedSkillIds([]);
    setManualPlacements([]);
    setItemQuery("");
    setItemCategoryFilter([]);
    setItemSizeFilter("");
    setSkillQuery("");
  };

  const loadBuild = (build: CustomBuildDraft) => {
    setActiveSavedId(build.id);
    setCustomName(build.name);
    setHero(build.hero);
    setDurationSeconds(build.durationSeconds);
    setSelectedItemIds(build.itemIds.filter((id) => data.items.some((item) => item.id === id)));
    setSelectedSkillIds(build.skillIds.filter((id) => data.skills.some((skill) => skill.id === id)));
    setManualPlacements(build.placements ?? []);
    setItemQuery("");
    setItemCategoryFilter([]);
    setItemSizeFilter("");
    setSkillQuery("");
  };

  const deleteBuild = (id: string) => {
    persistBuilds(savedBuilds.filter((build) => build.id !== id));
    if (activeSavedId === id) setActiveSavedId("");
  };

  return (
    <div className="custom-workbench">
      <aside className="control-panel custom-panel" aria-label="自定义构筑控件">
        <label className="field">
          <span>构筑名称</span>
          <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="例如 Vanessa Burn Tempo" />
        </label>

        <label className="field">
          <span>英雄</span>
          <select
            value={hero}
            onChange={(event) => {
              setHero(event.target.value);
              setSelectedItemIds([]);
              setSelectedSkillIds([]);
              setManualPlacements([]);
              setActiveSavedId("");
            }}
          >
            {data.heroes.map((entry) => (
              <option value={entry.slug} key={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>模拟时间</span>
          <input
            type="number"
            min={1}
            max={300}
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
          />
        </label>

        <label className="field autocomplete">
          <span>添加物品</span>
          <input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="搜索物品、标签或效果" />
          {itemOptions.length > 0 ? (
            <div className="suggestions">
              {itemOptions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    addItem(item);
                    setItemQuery("");
                  }}
                >
                  <span>{item.name}</span>
                  <small>{item.size} 格 · {item.tags.slice(0, 3).join(" / ")}</small>
                </button>
              ))}
            </div>
          ) : null}
        </label>

        <MultiChoiceFilter title="类别" values={itemCategoryFilter} options={itemCategoryOptions} allLabel="全部" onChange={setItemCategoryFilter} />
        <ChoiceFilter title="尺寸" value={itemSizeFilter} options={itemSizeOptions} allLabel="全部" onChange={setItemSizeFilter} />

        <div className="chip-zone" aria-label="自定义构筑物品">
          {selectedItems.map((item) => (
            <button className="chip" key={item.id} type="button" onClick={() => setSelectedItemIds((current) => current.filter((id) => id !== item.id))}>
              {item.name}
            </button>
          ))}
        </div>

        <label className="field autocomplete">
          <span>添加技能</span>
          <input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="搜索技能、标签或效果" />
          {skillOptions.length > 0 ? (
            <div className="suggestions">
              {skillOptions.map((skill) => (
                <button
                  type="button"
                  key={skill.id}
                  onClick={() => {
                    addSkill(skill);
                    setSkillQuery("");
                  }}
                >
                  <span>{skill.name}</span>
                  <small>{skill.tags.slice(0, 3).join(" / ")}</small>
                </button>
              ))}
            </div>
          ) : null}
        </label>

        <div className="chip-zone" aria-label="自定义构筑技能">
          {selectedSkills.map((skill) => (
            <button className="chip skill" key={skill.id} type="button" onClick={() => setSelectedSkillIds((current) => current.filter((id) => id !== skill.id))}>
              {skill.name}
            </button>
          ))}
        </div>

        <div className="custom-actions">
          <button type="button" className="reset-button" onClick={startNewBuild}>
            新建构筑
          </button>
          <button type="button" className="primary-action" onClick={saveCurrentBuild} disabled={selectedItems.length === 0 || isOverSlotLimit}>
            {isEditingSavedBuild ? "更新构筑" : "保存为新构筑"}
          </button>
          <button
            type="button"
            className="reset-button"
            onClick={() => {
              setSelectedItemIds([]);
              setSelectedSkillIds([]);
              setManualPlacements([]);
            }}
          >
            清空
          </button>
        </div>

        <p className="custom-edit-state">
          {isEditingSavedBuild ? `正在编辑：${activeSavedBuild?.name}` : "当前是新建草稿，保存会创建新构筑。"}
        </p>

        <section className="saved-builds" aria-label="已保存自定义构筑">
          <h2>已保存</h2>
          {savedBuilds.length > 0 ? (
            savedBuilds.map((build) => (
              <div className={build.id === activeSavedId ? "saved-build active" : "saved-build"} key={build.id}>
                <button type="button" onClick={() => loadBuild(build)}>
                  <strong>{build.name}</strong>
                  <span>{formatDateTime(build.savedAt)}</span>
                </button>
                <button type="button" className="delete-build" onClick={() => deleteBuild(build.id)}>
                  删除
                </button>
              </div>
            ))
          ) : (
            <p className="subtle">保存后会存到当前浏览器本地。</p>
          )}
        </section>
      </aside>

      <section className="custom-results" aria-label="自定义构筑模拟结果">
        <div className="results-heading">
          <div>
            <p className="eyebrow">{selectedHeroName}</p>
            <h2>{customName || "自定义构筑"}</h2>
            <p className={isOverSlotLimit ? "slot-summary invalid" : "slot-summary"}>
              {usedSlots}/10 格 · {selectedItems.length} 个物品 · {selectedSkills.length} 个技能 · {simulation.durationSeconds} 秒模拟
            </p>
          </div>
        </div>

        {selectedItems.length === 0 ? (
          <article className="empty-state">
            <h2>还没有选择物品</h2>
            <p className="subtle">从左侧搜索物品和技能，保存后可以随时加载。</p>
          </article>
        ) : null}

        {isOverSlotLimit ? (
          <article className="empty-state">
            <h2>物品超过 10 格</h2>
            <p className="subtle">移除部分物品后才能生成棋盘布局和模拟结果。</p>
          </article>
        ) : null}

        {customLayout && selectedItems.length > 0 ? (
          <CustomBoardEditor
            layout={customLayout}
            itemById={itemById}
            selectedItems={selectedItems}
            selectedSkills={selectedSkills}
            onPlacementsChange={setManualPlacements}
            onAutoLayout={() => setManualPlacements(autoLayout?.placements ?? [])}
          />
        ) : null}

        {selectedItems.length > 0 && !isOverSlotLimit ? (
          <div className="simulation-grid">
            <section className="simulation-summary">
              <div>
                <span>主动使用</span>
                <strong>{simulation.totalItemUses}</strong>
              </div>
              <div>
                <span>效果触发</span>
                <strong>{simulation.cards.reduce((sum, card) => sum + card.totalTriggers, 0)}</strong>
              </div>
              {simulation.totals.slice(0, 6).map((total) => (
                <div key={total.key}>
                  <span>{total.label}</span>
                  <strong>{scoreLabel(total.value)}</strong>
                </div>
              ))}
            </section>

            {simulation.warnings.length > 0 ? (
              <section className="warnings simulation-warnings">
                {simulation.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </section>
            ) : null}

            <section className="simulation-card-list" aria-label="每张卡模拟统计">
              {simulation.cards.map((card) => (
                <article className={card.entityKind === "skill" ? "simulation-card skill" : "simulation-card"} key={`${card.entityKind}-${card.entityId}`}>
                  <div className="simulation-card-heading">
                    <div>
                      <h3>{card.entityName}</h3>
                      <span>{card.entityKind === "skill" ? "技能" : "物品"} · 主动 {card.activeUses} · 触发 {card.totalTriggers}</span>
                    </div>
                    <div className="simulation-card-totals">
                      {card.totals.slice(0, 4).map((total) => (
                        <span key={total.key}>
                          {total.label} <strong>{scoreLabel(total.value)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="simulation-effects">
                    {card.effects.map((effect, index) => (
                      <div className={effect.unsupportedReason ? "simulation-effect unsupported" : "simulation-effect"} key={`${card.entityId}-${effect.effectId}-${index}`}>
                        <span>{eventLabels[effect.triggerEvent] ?? effect.triggerEvent}</span>
                        <strong>x{effect.triggerCount}</strong>
                        <p>{effect.rawText || `${actionLabels[effect.actionType] ?? effect.actionType}`}</p>
                        {effect.totalValue != null && effect.totalLabel ? <em>{effect.totalLabel} {scoreLabel(effect.totalValue)}</em> : null}
                        {effect.unsupportedReason ? <small>{effect.unsupportedReason}</small> : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            {simulation.unsupported.length > 0 ? (
              <details className="effect-section unsupported-detail">
                <summary>未完整模拟的效果 ({simulation.unsupported.length})</summary>
                <div className="unsupported-list">
                  {simulation.unsupported.slice(0, 30).map((entry, index) => (
                    <div key={`${entry.entityName}-${index}`}>
                      <strong>{entry.entityName}</strong>
                      <p>{entry.rawText || "空效果文本"}</p>
                      <span>{entry.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<StaticData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => currentRoute());
  const [hero, setHero] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string[]>([]);
  const [itemSizeFilter, setItemSizeFilter] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [coreOutputs, setCoreOutputs] = useState<MechanicKey[]>([]);
  const [tempoMechanics, setTempoMechanics] = useState<MechanicKey[]>([]);
  const [controlMechanics, setControlMechanics] = useState<MechanicKey[]>([]);
  const [sustainMechanics, setSustainMechanics] = useState<MechanicKey[]>([]);
  const [mode, setMode] = useState<SearchMode>("similar");
  const [expandedBuildId, setExpandedBuildId] = useState<string | null>(null);
  const [lastCatalogRoute, setLastCatalogRoute] = useState<Extract<AppRoute, { view: "catalog" }>>(() => storedCatalogRoute());

  const activeView: AppView = route.view;
  const catalogRoute = route.view === "catalog" ? route : defaultCatalogRoute();
  const catalogFilters = parseCatalogFilters(catalogRoute.params);

  const navigate = (next: AppRoute) => {
    const hash = routeToHash(next);
    if (window.location.hash === hash) {
      setRoute(next);
    } else {
      window.location.hash = hash;
    }
  };

  const updateCatalogRoute = (kind: CatalogKind, filters: CatalogFilters) => {
    navigate({ view: "catalog", kind, params: catalogFiltersToParams(filters) });
  };

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", routeToHash(route));
    }
    const handleHashChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (route.view === "catalog") {
      setLastCatalogRoute(route);
    }
  }, [route]);

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
      .filter((item) => itemMatchesItemFilters(item, itemCategoryFilter, itemSizeFilter))
      .filter((item) => item.name.toLowerCase().includes(query) || item.tags.some((tag) => tag.includes(query)))
      .slice(0, 8);
  }, [data, hero, itemCategoryFilter, itemQuery, itemSizeFilter, selectedItemIds]);

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

  const selectedItems = useMemo(
    () => selectedItemIds.map((id) => itemById.get(id)).filter((item): item is ItemIndexEntry => Boolean(item)),
    [itemById, selectedItemIds]
  );
  const selectedSkills = useMemo(
    () => selectedSkillIds.map((id) => skillById.get(id)).filter((skill): skill is SkillIndexEntry => Boolean(skill)),
    [selectedSkillIds, skillById]
  );
  const selectedUsedSlots = totalItemSize(selectedItems);
  const selectedPreviewLayout = useMemo<BoardLayout | null>(() => {
    if (selectedItems.length === 0 || selectedUsedSlots > 10) return null;
    return optimizeLayoutForBuild({
      items: itemsAsLayoutItems(selectedItems),
      skills: skillsAsLayoutSkills(selectedSkills),
      beamWidth: 120,
      maxLayouts: 1200
    });
  }, [selectedItems, selectedSkills, selectedUsedSlots]);

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
          <button type="button" className={activeView === "builds" ? "active" : ""} onClick={() => navigate({ view: "builds" })}>
            构筑查找
          </button>
          <button type="button" className={activeView === "custom" ? "active" : ""} onClick={() => navigate({ view: "custom" })}>
            自定义构筑
          </button>
          <button
            type="button"
            className={activeView === "catalog" ? "active" : ""}
            onClick={() => navigate(route.view === "catalog" ? route : lastCatalogRoute)}
          >
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

            <MultiChoiceFilter title="类别" values={itemCategoryFilter} options={itemCategoryOptions} allLabel="全部" onChange={setItemCategoryFilter} />
            <ChoiceFilter title="尺寸" value={itemSizeFilter} options={itemSizeOptions} allLabel="全部" onChange={setItemSizeFilter} />

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
                  setItemCategoryFilter([]);
                  setItemSizeFilter("");
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
      ) : activeView === "custom" ? (
        <CustomBuildWorkbench
          data={data}
          hero={hero}
          setHero={setHero}
          selectedItems={selectedItems}
          selectedSkills={selectedSkills}
          selectedItemIds={selectedItemIds}
          selectedSkillIds={selectedSkillIds}
          setSelectedItemIds={setSelectedItemIds}
          setSelectedSkillIds={setSelectedSkillIds}
          addItem={addItem}
          addSkill={addSkill}
          itemById={itemById}
        />
      ) : (
        <CatalogBrowser
          data={data}
          kind={catalogRoute.kind}
          filters={catalogFilters}
          selectedItems={selectedItems}
          selectedSkills={selectedSkills}
          previewLayout={selectedPreviewLayout}
          itemById={itemById}
          onKindChange={(kind) => updateCatalogRoute(kind, catalogFilters)}
          onFiltersChange={(filters) => updateCatalogRoute(catalogRoute.kind, filters)}
          onSelectItem={(item) => {
            addItem(item);
          }}
          onSelectSkill={(skill) => {
            addSkill(skill);
          }}
        />
      ) : null}
    </main>
  );
}
