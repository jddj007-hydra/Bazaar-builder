import { useEffect, useMemo, useState } from "react";
import { BoardPreview } from "./BoardPreview";
import { mechanicLabel } from "./lib/bazaar-data/mechanics";
import { recommendNextItems, searchGeneratedBuilds } from "./lib/bazaar-data/searchGeneratedBuilds";
import type {
  EffectDef,
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
  unknown: "未识别触发"
};

const actionLabels: Record<string, string> = {
  damage: "伤害",
  shield: "护盾",
  heal: "治疗",
  burn: "燃烧",
  poison: "中毒",
  haste: "加速",
  slow: "减速",
  freeze: "冻结",
  charge: "充能",
  reduce_cooldown: "减少冷却",
  gain_stat: "获得属性",
  buff_tag: "标签增益",
  increase_value: "增加价值",
  gain_gold: "获得金币",
  gain_health: "获得生命值",
  multicast: "多重施放",
  destroy: "摧毁",
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
  allied_skills: "己方技能",
  random: "随机目标",
  unknown: "未识别目标"
};

const coreOutputOptions: MechanicKey[] = ["damage", "weapon_damage", "crit", "burn", "poison", "shield_scaling"];
const tempoOptions: MechanicKey[] = ["haste", "charge", "reduce_cooldown", "multicast"];
const controlOptions: MechanicKey[] = ["freeze", "slow"];
const sustainOptions: MechanicKey[] = ["shield", "heal"];

function formatCooldown(ms: number | null | undefined): string {
  if (!ms) return "无主动冷却";
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}秒冷却`;
}

function formatEffect(effect: EffectDef): string {
  const triggerTag = effect.trigger.tag ? ` / ${effect.trigger.tag}` : "";
  const value = effect.action.value != null ? ` ${effect.action.value}` : "";
  const actionTag = effect.action.tag ? ` / ${effect.action.tag}` : "";
  const stat = effect.action.stat ? ` / ${effect.action.stat}` : "";
  const target = effect.target
    ? ` -> ${targetLabels[effect.target.scope] ?? effect.target.scope}${effect.target.tag ? ` / ${effect.target.tag}` : ""}${
        effect.target.size ? ` / ${effect.target.size}格` : ""
      }`
    : "";

  return `${eventLabels[effect.trigger.event] ?? effect.trigger.event}${triggerTag} -> ${
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

export default function App() {
  const [data, setData] = useState<StaticData | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setSelectedItemIds((current) => [...current, item.id]);
    setItemQuery("");
  };

  const addSkill = (skill: SkillIndexEntry) => {
    setSelectedSkillIds((current) => [...current, skill.id]);
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

      {error ? (
        <section className="empty-state">
          <h2>缺少生成文件</h2>
          <p>运行 <code>npm run generate:builds</code>，在 <code>public/</code> 中生成静态 JSON。</p>
          <p className="subtle">{error}</p>
        </section>
      ) : null}

      {data ? (
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

            <div className="build-grid">
              {results.length === 0 ? (
                <article className="empty-state">
                  <h2>没有匹配结果</h2>
                  <p className="subtle">这些已选物品可能没有进入当前静态生成集合。可以切到“相似构筑”，或重新生成更大的构筑集合。</p>
                </article>
              ) : null}
              {results.map((build) => (
                <article className="build-card" key={build.id}>
                  <div className="build-topline">
                    <span>{build.archetype}</span>
                    <strong>{scoreLabel(build.finalScore ?? build.powerScore)}</strong>
                  </div>
                  {build.imageUrls && build.imageUrls.length > 0 ? (
                    <div className="image-row" aria-hidden="true">
                      {build.imageUrls.slice(0, 5).map((url) => (
                        <img src={url} alt="" loading="lazy" key={url} />
                      ))}
                    </div>
                  ) : null}
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
                  {build.layout ? <BoardPreview layout={build.layout} itemById={itemById} /> : null}
                  <details className="effect-section" open>
                    <summary>物品特效详情</summary>
                    <div className="entity-detail-list">
                      {build.itemIds.map((id) => itemById.get(id)).filter((item): item is ItemIndexEntry => Boolean(item)).map((item) => (
                        <div className="entity-detail" key={item.id}>
                          <div className="entity-title-row">
                            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
                            <div>
                              <h3>{item.name}</h3>
                              <div className="meta-pills">
                                <span>{item.size}格</span>
                                <span>{item.rarity ?? "未知稀有度"}</span>
                                <span>{formatCooldown(item.cooldownMs)}</span>
                              </div>
                            </div>
                          </div>
                          <p className="effect-text">{item.text || "没有可展示的效果文本。"}</p>
                          <div className="tag-row">
                            {item.tags.slice(0, 6).map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                          <div className="parsed-effects">
                            {item.effects.slice(0, 4).map((effect, index) => (
                              <span key={`${item.id}-${index}`}>{formatEffect(effect)}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
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
                            <div className="parsed-effects">
                              {skill.effects.slice(0, 4).map((effect, index) => (
                                <span key={`${skill.id}-${index}`}>{formatEffect(effect)}</span>
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
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
