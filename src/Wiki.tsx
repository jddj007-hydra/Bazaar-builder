import { useMemo, useState } from "react";
import { compareCatalogNames } from "./lib/bazaar-data/catalogSort";
import { tierOrder } from "./lib/bazaar-data/tierAttributes";
import type {
  CardTier,
  HeroDef,
  ItemIndexEntry,
  SkillIndexEntry,
  WikiEncounterEntry,
  WikiKeywordEntry,
  WikiLevelUpEntry,
  WikiRulesEntry
} from "./lib/bazaar-data/types";

export type WikiSection = "rules" | "keywords" | "encounters" | "levels";

export type WikiData = {
  encounters: WikiEncounterEntry[];
  keywords: WikiKeywordEntry[];
  levelUps: WikiLevelUpEntry[];
  rules: WikiRulesEntry | null;
};

const SECTION_LABELS: Array<{ value: WikiSection; label: string; hint: string }> = [
  { value: "rules", label: "规则速查", hint: "单局结构、威望、棋盘、刷新与价格" },
  { value: "keywords", label: "术语", hint: "游戏内关键词的中文释义" },
  { value: "encounters", label: "遭遇", hint: "事件、事件选项、商人、底座与怪物" },
  { value: "levels", label: "等级奖励", hint: "1–30 级的奖励选项" }
];

const CATEGORY_LABELS: Record<WikiEncounterEntry["category"], string> = {
  event: "事件",
  "event-step": "事件选项",
  pedestal: "底座",
  monster: "怪物",
  merchant: "商人"
};

const TIER_LABELS_ZH: Record<string, string> = {
  Bronze: "青铜",
  Silver: "白银",
  Gold: "黄金",
  Diamond: "钻石",
  Legendary: "传说"
};

function percent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function tierZh(tier: string): string {
  return TIER_LABELS_ZH[tier] ?? tier;
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "");
}

function matches(haystack: string, query: string): boolean {
  if (!query) return true;
  return normalize(haystack).includes(normalize(query));
}

/** A card mentioned by a wiki page, linking back into the catalog. */
function CardChip(props: {
  cardId: string;
  itemById: Map<string, ItemIndexEntry>;
  skillById: Map<string, SkillIndexEntry>;
}) {
  const { cardId, itemById, skillById } = props;
  const item = itemById.get(cardId);
  const skill = item ? null : skillById.get(cardId);
  const entity = item ?? skill;
  if (!entity) {
    return <span className="wiki-card-chip wiki-card-chip-missing">{cardId.slice(0, 8)}…</span>;
  }
  const kind = item ? "items" : "skills";
  const href = `#/catalog-${kind}?q=${encodeURIComponent(entity.nameEn || entity.name)}`;
  return (
    <a className={`wiki-card-chip wiki-card-chip-${kind === "items" ? "item" : "skill"}`} href={href} title={entity.nameEn}>
      {entity.imageUrl ? <img src={entity.imageUrl} alt="" loading="lazy" /> : <span className="wiki-card-chip-fallback">{entity.name.slice(0, 1)}</span>}
      <span>{entity.name}</span>
    </a>
  );
}

function RulesSection(props: { rules: WikiRulesEntry | null }) {
  const { rules } = props;
  if (!rules) {
    return <p className="wiki-empty">这份数据快照没有 `game_modes` 常量表，无法显示规则速查。</p>;
  }

  const tiers = tierOrder.filter((tier) => tier !== "Legendary" || Object.values(rules.tiersByDay).some((day) => day.Legendary));
  const days = Object.keys(rules.tiersByDay)
    .map(Number)
    .filter((day) => Number.isInteger(day) && day <= (rules.numberOfDays ?? 10))
    .sort((a, b) => a - b);
  const sizes = ["Small", "Medium", "Large"].filter((size) => rules.itemBuyPrices[size]);
  const sizeLabels: Record<string, string> = { Small: "小型", Medium: "中型", Large: "大型" };

  return (
    <div className="wiki-doc">
      <section className="wiki-block">
        <h2>单局结构</h2>
        <p className="wiki-note">以下数字直接来自游戏运行时的 <code>game_modes</code> 表，不是社区资料。</p>
        <dl className="wiki-facts">
          <div><dt>一天小时数</dt><dd>{rules.hoursInDay ?? "—"}</dd></div>
          <div><dt>天数</dt><dd>{rules.numberOfDays ?? "—"}</dd></div>
          <div><dt>胜利条件</dt><dd>{rules.victoriesToWin ?? "—"} 场 PvP 胜利</dd></div>
          <div><dt>升级所需经验</dt><dd>{rules.experiencePerLevel ?? "—"} XP</dd></div>
          <div><dt>每小时经验</dt><dd>{rules.experiencePerHour ?? "—"} XP</dd></div>
          <div><dt>初始威望</dt><dd>{rules.prestige.initial ?? "—"}</dd></div>
          <div><dt>威望上限</dt><dd>{rules.prestige.max ?? "—"}</dd></div>
          <div><dt>PvE 失败扣威望</dt><dd>{rules.prestige.lossFromMonsters ?? "—"}</dd></div>
          <div><dt>暴击倍率</dt><dd>{rules.critPercentMultiplier != null ? `${rules.critPercentMultiplier}%` : "—"}</dd></div>
          <div><dt>灼烧每次衰减</dt><dd>{rules.burnDecrementPercent != null ? `${rules.burnDecrementPercent}%` : "—"}</dd></div>
        </dl>
        <p className="wiki-note">
          威望归零时游戏会把玩家拉到 {rules.fates.afterPrestige ?? 1} 点威望并给出 Fate 三选一（Bounty / Crossroads / Legacy）。
          触发阈值 {rules.fates.spawnAtOrBelow ?? 0}，即「首次归零」。
        </p>
        <p className="wiki-note">
          打赢怪物给的经验和金币不在这张常量表里：每场战斗自己的卡上写着 <code>RewardCombatXp</code> 和
          <code>RewardCombatGold</code>，多数是 3 XP，也有 2 XP 和 4 XP 的，金币从 0 到 6 不等，具体数字在对应的遭遇详情里。
          另外，多数非战斗遭遇在被选中时就给 1 XP（<code>ExperienceAwardUponSelection</code>），和每小时固定的
          {rules.experiencePerHour ?? "—"} XP 是分开算的。
        </p>
        {rules.fateOptions.length > 0 ? (
          <>
            <h3>Fate 三选一</h3>
            <ul className="wiki-option-list">
              {rules.fateOptions.map((option) => (
                <li key={option.name}>
                  <div>
                    <strong>{option.nameZh || option.name}</strong>
                    {option.nameZh && option.nameZh !== option.name ? <span>{option.name}</span> : null}
                  </div>
                  <p>{option.descriptionZh || option.description}</p>
                </li>
              ))}
            </ul>
            <p className="wiki-note">
              这三项来自 <code>game_modes.Fates.TemplateId</code> 指向的 Futura 事件，是数据里的原文；
              其中「Fate's Legacy」的卡面文字仍是旧版「升到 Gold」，2026 changelog 已改为升一级。
            </p>
          </>
        ) : null}
      </section>

      <section className="wiki-block">
        <h2>棋盘成长</h2>
        <dl className="wiki-facts">
          <div><dt>初始棋盘格</dt><dd>4</dd></div>
          <div><dt>每级解锁</dt><dd>{rules.boardSocketsPerLevel ?? "—"}</dd></div>
          <div><dt>上限</dt><dd>10</dd></div>
          <div><dt>仓库</dt><dd>10 格</dd></div>
          <div><dt>占格</dt><dd>小型 1 / 中型 2 / 大型 3</dd></div>
          <div><dt>技能槽</dt><dd>无上限</dd></div>
          <div><dt>等级上限</dt><dd>{rules.maxLevel ?? "—"}</dd></div>
        </dl>
        <p className="wiki-note">
          数据里只有「每级解锁 {rules.boardSocketsPerLevel ?? "—"} 格」这一个常数（<code>NumCarpetSocketsUnlockPerLevel</code>），
          初始 4 格、上限 10 格与「技能无上限」来自游戏表现与社区核对，不在 <code>game_modes</code> 里。
          <code>MaxLevel</code> 是 {rules.maxLevel ?? "—"}，它是防止越界的兜底值，不是设计上的等级上限。
        </p>
      </section>

      <section className="wiki-block">
        <h2>遭遇刷新</h2>
        <p className="wiki-note">
          刷新次数与价格直接来自遭遇卡的 <code>SelectionContext.Rules.RerollRules</code>，按级别汇总：
        </p>
        <div className="wiki-table-scroll">
          <table className="wiki-table">
            <thead>
              <tr>
                <th>级别</th>
                <th>可刷新</th>
                <th>首次费用</th>
                <th>每次递增</th>
                <th>遭遇数</th>
              </tr>
            </thead>
            <tbody>
              {rules.encounterRerolls.map((row) => (
                <tr key={`${row.tier}-${row.total}-${row.startingCost}-${row.costIncrease}`}>
                  <th scope="row">{row.tier ? tierZh(row.tier) : "—"}</th>
                  <td>{row.total == null ? "无限" : row.total === 0 ? "不能刷新" : `${row.total} 次`}</td>
                  <td>{row.startingCost > 0 ? `${row.startingCost} 金` : "—"}</td>
                  <td>{row.costIncrease > 0 ? `+${row.costIncrease}` : "—"}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wiki-note">
          绝大多数遭遇是「1 次、按级别定价」（青铜 2 / 白银 3 / 黄金 4–6 / 钻石 8）。
          真正无限刷新的只有 Pearl's Dig Site（1 金起、每次 +1）；Aerodrome 卡面写「infinite」，
          但数据里是 50 次上限。教程遭遇的刷新次数是 0。
        </p>
      </section>

      {rules.sandstorm ? (
        <section className="wiki-block">
          <h2>沙暴</h2>
          <dl className="wiki-facts">
            <div><dt>开始倒计时</dt><dd>{(rules.sandstorm.countdownStartTime ?? 0) / 1000}s</dd></div>
            <div><dt>倒计时时长</dt><dd>{(rules.sandstorm.countdownDuration ?? 0) / 1000}s</dd></div>
            <div><dt>基础伤害</dt><dd>{rules.sandstorm.baseDamage ?? "—"}</dd></div>
            <div><dt>每次递增</dt><dd>{rules.sandstorm.additiveScalar ?? "—"}</dd></div>
            <div><dt>基础 tick</dt><dd>{rules.sandstorm.baseTickRate ?? "—"}ms</dd></div>
            <div><dt>每次缩短</dt><dd>{rules.sandstorm.tickRateDecrement ?? "—"}ms</dd></div>
            <div><dt>最短 tick</dt><dd>{rules.sandstorm.tickRateFloor ?? "—"}ms</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="wiki-block">
        <h2>每日物品 / 技能稀有度</h2>
        <p className="wiki-note">每个物品或技能在生成时按当天这一行掷骰，不是「到某天解锁」。</p>
        <div className="wiki-table-scroll">
          <table className="wiki-table">
            <thead>
              <tr>
                <th>天数</th>
                {tiers.map((tier) => <th key={tier}>{tierZh(tier)}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day}>
                  <th scope="row">{day === 10 ? "10+" : day}</th>
                  {tiers.map((tier) => {
                    const weight = rules.tiersByDay[String(day)]?.[tier] ?? 0;
                    return (
                      <td key={tier} className={weight > 0 ? "wiki-cell-on" : "wiki-cell-off"}>
                        {weight > 0 ? percent(weight) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wiki-note">
          遭遇卡另有一套 Tier 权重：{Object.entries(rules.encounterTierWeights).map(([tier, weight]) => `${tierZh(tier)} ${percent(weight)}`).join(" / ")}。
        </p>
      </section>

      <section className="wiki-block">
        <h2>价格表</h2>
        <div className="wiki-price-grid">
          {(
            [
              ["物品买入", rules.itemBuyPrices],
              ["物品卖出", rules.itemSellPrices]
            ] as const
          ).map(([label, table]) => (
            <div key={label} className="wiki-price-table">
              <h3>{label}</h3>
              <table className="wiki-table">
                <thead>
                  <tr>
                    <th>尺寸</th>
                    {tierOrder.map((tier) => <th key={tier}>{tierZh(tier)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size}>
                      <th scope="row">{sizeLabels[size]}</th>
                      {tierOrder.map((tier) => (
                        <td key={tier}>{table[size]?.[tier] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div className="wiki-price-table">
          <h3>技能</h3>
          <table className="wiki-table">
            <thead>
              <tr>
                <th>等级</th>
                {tierOrder.map((tier) => <th key={tier}>{tierZh(tier)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">买入</th>
                {tierOrder.map((tier) => <td key={tier}>{rules.skillBuyPrices.Medium?.[tier] ?? "—"}</td>)}
              </tr>
              <tr>
                <th scope="row">卖出</th>
                {tierOrder.map((tier) => <td key={tier}>{rules.skillSellPrices.Medium?.[tier] ?? "—"}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="wiki-block">
        <h2>说明</h2>
        <p className="wiki-note">
          本页只呈现游戏数据里写明的常数。完整的小时级遭遇日程（`dayByHourManager`）没有随客户端下发，
          所以这里不提供「第几天第几小时会遇到什么」；只有在遭遇卡自己的名字里带天数窗口的（例如
          「Candy Stash (Day 4-6)」）才会在遭遇详情里显示「出现天数」，这类记录一共 8 个。
          模拟器里的近似规则不写进这一页，避免和实际游戏混淆。
        </p>
      </section>
    </div>
  );
}

function KeywordsSection(props: { keywords: WikiKeywordEntry[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      props.keywords.filter((keyword) =>
        matches(`${keyword.name} ${keyword.nameEn} ${keyword.description} ${keyword.descriptionZh}`, query)
      ),
    [props.keywords, query]
  );

  if (props.keywords.length === 0) {
    return <p className="wiki-empty">这份数据快照没有导出关键词表。</p>;
  }

  return (
    <div className="wiki-doc">
      <div className="wiki-search-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索术语，例如「灼烧」「Ammo」"
          aria-label="搜索术语"
        />
        <span className="wiki-count">{filtered.length} / {props.keywords.length} 条</span>
      </div>
      <div className="wiki-keyword-grid">
        {filtered.map((keyword) => (
          <article className="wiki-keyword" key={keyword.id}>
            <header>
              <h3>{keyword.name}</h3>
              {keyword.name !== keyword.nameEn ? <span>{keyword.nameEn}</span> : null}
            </header>
            <p>{keyword.descriptionZh || keyword.description}</p>
            {keyword.descriptionZh && keyword.descriptionZh !== keyword.description ? (
              <p className="wiki-keyword-en">{keyword.description}</p>
            ) : null}
          </article>
        ))}
      </div>
      {filtered.length === 0 ? <p className="wiki-empty">没有匹配的术语。</p> : null}
    </div>
  );
}

function EncounterDetail(props: {
  encounter: WikiEncounterEntry;
  itemById: Map<string, ItemIndexEntry>;
  skillById: Map<string, SkillIndexEntry>;
  heroBySlug: Map<string, HeroDef>;
  sourceIds: Set<string>;
  merchantIds: Set<string>;
  onClose: () => void;
}) {
  const { encounter, heroBySlug, itemById, merchantIds, skillById, onClose, sourceIds } = props;
  // Only encounters that the catalog knows as a source can be filtered by id;
  // event steps and grouped variants are not sources of their own.
  const catalogSourceId = [encounter.id, ...encounter.variants.map((variant) => variant.id)].find((id) =>
    sourceIds.has(id)
  );
  // Merchant pages share their id with the catalog's merchant index, so the
  // shop's shelf can be filtered directly instead of by the encounter id.
  const catalogMerchantId =
    encounter.category === "merchant"
      ? [encounter.id, ...encounter.variants.map((variant) => variant.id)].find((id) => merchantIds.has(id))
      : undefined;
  const heroNames = encounter.heroes.map((slug) => heroBySlug.get(slug)?.name ?? slug);
  const rewardCards = encounter.rewardCardIds ?? [];
  const rewardGroups = (encounter.rewards ?? []).filter((reward) => reward.description);

  return (
    <section className="wiki-detail" aria-label={`${encounter.name} 详情`}>
      <button type="button" className="wiki-detail-close" onClick={onClose} aria-label="关闭详情">×</button>
      <header className="wiki-detail-head">
        {encounter.portrait ? <img src={encounter.portrait} alt="" className="wiki-detail-portrait" loading="lazy" /> : null}
        <div>
          <p className="eyebrow">{CATEGORY_LABELS[encounter.category]}</p>
          <h2>{encounter.name}</h2>
          {encounter.nameEn !== encounter.name ? <p className="wiki-detail-en">{encounter.nameEn}</p> : null}
          <div className="wiki-pills">
            {encounter.tiers.map((tier) => <span key={tier}>{tierZh(tier)}</span>)}
            {heroNames.map((name) => <span key={name}>{name}</span>)}
          </div>
        </div>
      </header>

      {encounter.description || encounter.descriptionZh ? (
        <p className="wiki-detail-desc">{encounter.descriptionZh || encounter.description}</p>
      ) : null}

      {encounter.rules || (encounter.days && encounter.days.length > 0) ? (
        <dl className="wiki-facts wiki-facts-compact">
          {encounter.rules ? (
            <>
              <div><dt>选项费用</dt><dd>{encounter.rules.free ? "免费" : "按选项标价"}</dd></div>
              <div><dt>可离开</dt><dd>{encounter.rules.canExit ? "是" : "否"}</dd></div>
              <div><dt>可多选</dt><dd>{encounter.rules.canSelectMultiple ? "是" : "否"}</dd></div>
            </>
          ) : null}
          {encounter.rules?.rerolls ? (
            <div>
              <dt>刷新</dt>
              <dd>
                {encounter.rules.rerolls.total == null
                  ? "无限次"
                  : encounter.rules.rerolls.total === 0
                    ? "不能刷新"
                    : `${encounter.rules.rerolls.total} 次`}
                {encounter.rules.rerolls.total !== 0 && encounter.rules.rerolls.startingCost > 0
                  ? `，首次 ${encounter.rules.rerolls.startingCost} 金`
                  : ""}
                {encounter.rules.rerolls.total !== 0 && encounter.rules.rerolls.costIncrease > 0
                  ? `，每次 +${encounter.rules.rerolls.costIncrease}`
                  : ""}
              </dd>
            </div>
          ) : null}
          {encounter.days && encounter.days.length > 0 ? (
            <div><dt>出现天数</dt><dd>{encounter.days.join(" / ")}</dd></div>
          ) : null}
          {encounter.takeover ? <div><dt>出现方式</dt><dd>独占该小时</dd></div> : null}
          {encounter.xpOnSelection ? <div><dt>选中即得</dt><dd>{encounter.xpOnSelection} XP</dd></div> : null}
        </dl>
      ) : null}

      {encounter.options && encounter.options.length > 0 ? (
        <div className="wiki-detail-section">
          <h3>选项</h3>
          <ul className="wiki-option-list">
            {encounter.options.map((option) => (
              <li key={option.id}>
                <div>
                  <strong>{option.nameZh || option.name}</strong>
                  {option.nameZh && option.nameZh !== option.name ? <span>{option.name}</span> : null}
                </div>
                <p>{option.descriptionZh || option.description}</p>
                {option.price ? <span className="wiki-price-tag">{option.price} 金</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {encounter.monster ? (
        <div className="wiki-detail-section">
          <h3>战斗数据</h3>
          <dl className="wiki-facts wiki-facts-compact">
            {[encounter.monster.nameZh, encounter.monster.name].includes(encounter.name) ? null : (
              <div><dt>名称</dt><dd>{encounter.monster.nameZh || encounter.monster.name}</dd></div>
            )}
            <div><dt>等级</dt><dd>{encounter.monster.level ?? "—"}</dd></div>
            <div><dt>生命</dt><dd>{encounter.monster.health ?? "—"}</dd></div>
            <div><dt>威望</dt><dd>{encounter.monster.prestige ?? "—"}</dd></div>
            {encounter.combatRewards ? (
              <>
                <div><dt>胜利经验</dt><dd>{encounter.combatRewards.xp ?? "—"} XP</dd></div>
                <div><dt>胜利金币</dt><dd>{encounter.combatRewards.gold ?? "—"}</dd></div>
              </>
            ) : null}
          </dl>
          {encounter.monster.itemIds.length > 0 ? (
            <>
              <h4>卡组（{encounter.monster.itemIds.length} 件物品）</h4>
              <div className="wiki-chip-row">
                {encounter.monster.itemIds.map((id) => (
                  <CardChip key={id} cardId={id} itemById={itemById} skillById={skillById} />
                ))}
              </div>
            </>
          ) : null}
          {encounter.monster.skillIds.length > 0 ? (
            <>
              <h4>技能</h4>
              <div className="wiki-chip-row">
                {encounter.monster.skillIds.map((id) => (
                  <CardChip key={id} cardId={id} itemById={itemById} skillById={skillById} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {rewardCards.length > 0 || rewardGroups.length > 0 ? (
        <div className="wiki-detail-section">
          <h3>可获得</h3>
          {rewardCards.length > 0 ? (
            <div className="wiki-chip-row">
              {rewardCards.map((id) => (
                <CardChip key={id} cardId={id} itemById={itemById} skillById={skillById} />
              ))}
            </div>
          ) : null}
          {rewardGroups.length > 0 ? (
            <ul className="wiki-reward-list">
              {rewardGroups.map((reward, index) => (
                <li key={`${reward.description}-${index}`}>
                  {reward.descriptionZh || reward.description}
                  {reward.limit && reward.limit > 1 ? <span className="wiki-price-tag">×{reward.limit}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {catalogSourceId || catalogMerchantId ? (
        <div className="wiki-detail-links">
          {catalogSourceId ? (
            <a href={`#/catalog-items?source=${encodeURIComponent(catalogSourceId)}`}>在物品查询中查看该来源的卡牌</a>
          ) : null}
          {catalogMerchantId ? (
            <a href={`#/catalog-items?merchant=${encodeURIComponent(`merchant:${catalogMerchantId}`)}`}>
              在物品查询中查看该商人的货架
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function EncountersSection(props: {
  encounters: WikiEncounterEntry[];
  itemById: Map<string, ItemIndexEntry>;
  skillById: Map<string, SkillIndexEntry>;
  heroBySlug: Map<string, HeroDef>;
  sourceIds: Set<string>;
  merchantIds: Set<string>;
  selectedSlug: string;
  sourceId: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
}) {
  const { encounters, heroBySlug, itemById, merchantIds, onClose, onSelect, selectedSlug, skillById, sourceId, sourceIds } = props;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WikiEncounterEntry["category"] | "">("");
  const [hero, setHero] = useState("");
  const [tier, setTier] = useState("");
  const [limit, setLimit] = useState(120);

  const filtered = useMemo(() => {
    return encounters.filter((entry) => {
      if (sourceId && entry.id !== sourceId && !entry.variants.some((variant) => variant.id === sourceId)) return false;
      if (category && entry.category !== category) return false;
      if (hero && !entry.heroes.includes(hero)) return false;
      if (tier && !entry.tiers.includes(tier as CardTier)) return false;
      return matches(`${entry.name} ${entry.nameEn} ${entry.description} ${entry.descriptionZh}`, query);
    });
  }, [category, encounters, hero, query, sourceId, tier]);

  const selected = encounters.find((entry) => entry.slug === selectedSlug) ?? null;
  const heroes = useMemo(
    () => [...new Set(encounters.flatMap((entry) => entry.heroes))].sort((a, b) => compareCatalogNames(a, b)),
    [encounters]
  );

  if (encounters.length === 0) {
    return <p className="wiki-empty">这份数据快照没有导出遭遇数据。</p>;
  }

  return (
    <div className="wiki-encounters">
      <div className="wiki-encounters-list">
        <div className="wiki-search-row">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(120);
            }}
            placeholder="搜索事件、怪物或描述"
            aria-label="搜索遭遇"
          />
          <span className="wiki-count">{filtered.length} / {encounters.length} 条</span>
        </div>
        <div className="wiki-filter-row">
          <select value={category} onChange={(event) => { setCategory(event.target.value as WikiEncounterEntry["category"] | ""); setLimit(120); }} aria-label="类型">
            <option value="">全部类型</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          <select value={hero} onChange={(event) => { setHero(event.target.value); setLimit(120); }} aria-label="英雄">
            <option value="">全部英雄</option>
            {heroes.map((slug) => (
              <option value={slug} key={slug}>{heroBySlug.get(slug)?.name ?? slug}</option>
            ))}
          </select>
          <select value={tier} onChange={(event) => { setTier(event.target.value); setLimit(120); }} aria-label="级别">
            <option value="">全部级别</option>
            {tierOrder.map((entry) => (
              <option value={entry} key={entry}>{tierZh(entry)}</option>
            ))}
          </select>
        </div>

        <div className="wiki-encounter-grid">
          {filtered.slice(0, limit).map((entry) => (
            <button
              type="button"
              key={entry.slug}
              className={`wiki-encounter-card${entry.slug === selectedSlug ? " active" : ""}`}
              onClick={() => onSelect(entry.slug)}
            >
              {entry.portrait ? (
                <img src={entry.portrait} alt="" loading="lazy" />
              ) : (
                <span className="wiki-encounter-fallback">{entry.name.slice(0, 2)}</span>
              )}
              <span className="wiki-encounter-body">
                <strong>{entry.name}</strong>
                <small>{entry.nameEn}</small>
                <span className="wiki-encounter-meta">
                  {CATEGORY_LABELS[entry.category]}
                  {entry.tiers.length > 0 ? ` · ${entry.tiers.map(tierZh).join("/")}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
        {filtered.length === 0 ? <p className="wiki-empty">没有匹配的遭遇。</p> : null}
        {filtered.length > limit ? (
          <button type="button" className="wiki-load-more" onClick={() => setLimit((current) => current + 180)}>
            继续加载（还有 {filtered.length - limit} 条）
          </button>
        ) : null}
      </div>

      {selected ? (
        <EncounterDetail
          encounter={selected}
          heroBySlug={heroBySlug}
          itemById={itemById}
          skillById={skillById}
          sourceIds={sourceIds}
          merchantIds={merchantIds}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}

function LevelsSection(props: { levelUps: WikiLevelUpEntry[]; heroBySlug: Map<string, HeroDef> }) {
  const { heroBySlug, levelUps } = props;
  const heroNames = (slugs: string[]): string => slugs.map((slug) => heroBySlug.get(slug)?.name ?? slug).join("/");
  if (levelUps.length === 0) {
    return <p className="wiki-empty">这份数据快照没有导出等级奖励表。</p>;
  }

  return (
    <div className="wiki-doc">
      <p className="wiki-note">
        每一级给出若干组候选奖励，游戏从中抽出固定组数（每级不同，见各级标题）；组内的选项再由你挑选。
        带英雄条件的组只对对应英雄生效，权重是组被抽中的相对概率。
      </p>
      <div className="wiki-level-list">
        {levelUps.map((entry) => (
          <section className="wiki-level" key={entry.level}>
            <header>
              <h3>{entry.level} 级</h3>
              <span>
                {entry.pick != null ? `抽 ${entry.pick} 组` : null}
                {entry.pick != null && entry.health != null ? " · " : ""}
                {entry.health != null ? `最大生命 ${entry.health}` : null}
              </span>
            </header>
            <div className="wiki-level-groups">
              {entry.groups.map((group, index) => (
                <div className="wiki-level-group" key={`${entry.level}-${index}`}>
                  <span className="wiki-level-group-meta">
                    {group.heroes.length === 0
                      ? "通用"
                      : group.heroOperator === "None"
                        ? `除 ${heroNames(group.heroes)} 外的英雄`
                        : group.heroOperator === "All"
                          ? `仅 ${heroNames(group.heroes)}`
                          : `含 ${heroNames(group.heroes)}`}
                    {group.limit > 1 ? ` · 取 ${group.limit}` : ""}
                    {group.weight > 0 ? ` · 权重 ${group.weight}` : ""}
                  </span>
                  <div className="wiki-chip-row">
                    {group.options.map((option) => (
                      <span className="wiki-level-option" key={`${option.id}-${index}`} title={option.descriptionZh || option.description}>
                        {option.nameZh || option.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="wiki-note">
        组内的奖励选项是游戏数据里的原始条目，点不进卡牌页的（例如「获得一件青铜级物品」）本身就是一次生成查询。
        卡牌奖励可以在
        <a href="#/catalog-items">物品查询</a> / <a href="#/catalog-skills">技能查询</a> 里查到。
      </p>
    </div>
  );
}

export function WikiPage(props: {
  section: WikiSection;
  params: URLSearchParams;
  data: WikiData;
  heroes: HeroDef[];
  itemById: Map<string, ItemIndexEntry>;
  skillById: Map<string, SkillIndexEntry>;
  sourceIds: Set<string>;
  merchantIds: Set<string>;
  onNavigate: (section: WikiSection, params?: URLSearchParams) => void;
}) {
  const { data, heroes, itemById, merchantIds, onNavigate, params, section, skillById, sourceIds } = props;
  const heroBySlug = useMemo(() => new Map(heroes.map((hero) => [hero.slug, hero])), [heroes]);
  const selectedSlug = params.get("e") ?? "";
  const sourceId = params.get("source") ?? "";

  const counts: Record<WikiSection, number | null> = {
    rules: null,
    keywords: data.keywords.length,
    encounters: data.encounters.length,
    levels: data.levelUps.length
  };

  return (
    <div className="wiki-shell">
      <nav className="wiki-tabs" aria-label="百科分栏">
        {SECTION_LABELS.map((entry) => (
          <button
            type="button"
            key={entry.value}
            className={section === entry.value ? "active" : ""}
            onClick={() => onNavigate(entry.value)}
          >
            <strong>{entry.label}</strong>
            <small>{counts[entry.value] != null ? `${counts[entry.value]} 条` : entry.hint}</small>
          </button>
        ))}
      </nav>

      {section === "rules" ? <RulesSection rules={data.rules} /> : null}
      {section === "keywords" ? <KeywordsSection keywords={data.keywords} /> : null}
      {section === "levels" ? <LevelsSection levelUps={data.levelUps} heroBySlug={heroBySlug} /> : null}
      {section === "encounters" ? (
        <EncountersSection
          encounters={data.encounters}
          heroBySlug={heroBySlug}
          itemById={itemById}
          skillById={skillById}
          sourceIds={sourceIds}
          merchantIds={merchantIds}
          selectedSlug={selectedSlug}
          sourceId={sourceId}
          onSelect={(slug) => onNavigate("encounters", new URLSearchParams({ e: slug }))}
          onClose={() => onNavigate("encounters")}
        />
      ) : null}
    </div>
  );
}

export function wikiSectionFromHash(hash: string): { section: WikiSection; params: URLSearchParams } {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathText, searchText = ""] = raw.split("?");
  const parts = pathText.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const section = parts[1];
  const valid = SECTION_LABELS.some((entry) => entry.value === section);
  return {
    section: (valid ? section : "rules") as WikiSection,
    params: new URLSearchParams(searchText)
  };
}

