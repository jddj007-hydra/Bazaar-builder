import { structuredEffectViews, type StructuredEffectView } from "./lib/bazaar-data/structuredEffects";
import type { BoardLayout, ItemIndexEntry, PlacedItem } from "./lib/bazaar-data/types";

type BoardPreviewProps = {
  layout: BoardLayout;
  itemById: Map<string, ItemIndexEntry>;
  variant?: "compact" | "detail";
  showHeader?: boolean;
};

type CardStat = {
  key: string;
  kind: string;
  value: string;
  label: string;
};

const outputStatMeta: Partial<Record<StructuredEffectView["action"]["type"], { kind: string; label: string }>> = {
  burn: { kind: "burn", label: "灼烧" },
  damage: { kind: "damage", label: "伤害" },
  heal: { kind: "heal", label: "医疗" },
  poison: { kind: "poison", label: "毒" },
  shield: { kind: "shield", label: "护甲" }
};

const outputStatByName: Record<string, { kind: string; label: string }> = {
  burn: { kind: "burn", label: "灼烧" },
  damage: { kind: "damage", label: "伤害" },
  heal: { kind: "heal", label: "医疗" },
  poison: { kind: "poison", label: "毒" },
  shield: { kind: "shield", label: "护甲" }
};

const actionLabels: Partial<Record<StructuredEffectView["action"]["type"], string>> = {
  burn: "燃烧",
  charge: "充能",
  damage: "造成伤害",
  freeze: "冻结",
  gain_stat: "获得属性",
  haste: "加速",
  heal: "治疗",
  multicast: "多重施放",
  poison: "施加剧毒",
  reduce_cooldown: "减少冷却",
  reload: "装填",
  shield: "获得护盾",
  slow: "减速"
};

function formatSeconds(ms: number | null | undefined): string {
  if (!ms) return "";
  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function formatCooldown(ms: number | null | undefined): string {
  const seconds = formatSeconds(ms);
  return seconds ? `${seconds}s` : "无主动冷却";
}

function displayValue(item: ItemIndexEntry): number | null {
  return item.value != null && item.value > 0 ? item.value : null;
}

function statMetaForEffect(effect: StructuredEffectView): { kind: string; label: string } | null {
  if (effect.action.type === "gain_stat" || effect.action.type === "modify_stat") {
    const normalized = effect.action.stat?.toLowerCase().trim();
    return normalized ? outputStatByName[normalized] ?? null : null;
  }

  return outputStatMeta[effect.action.type] ?? null;
}

function cardOutputStats(item: ItemIndexEntry): CardStat[] {
  const stats: CardStat[] = [];

  for (const effect of structuredEffectViews(item.structuredEffects)) {
    if (effect.action.value == null) continue;
    if (effect.trigger.event !== "cooldown_ready" && effect.trigger.event !== "always") continue;

    const meta = statMetaForEffect(effect);
    if (!meta) continue;

    const key = `${effect.action.type}-${effect.action.stat ?? ""}-${effect.action.value}`;
    if (stats.some((stat) => stat.key === key || stat.label === meta.label)) continue;

    stats.push({
      key,
      kind: meta.kind,
      value: String(effect.action.value),
      label: meta.label
    });
  }

  return stats.slice(0, 3);
}

function cardMulticast(item: ItemIndexEntry): CardStat | null {
  const effect = structuredEffectViews(item.structuredEffects).find((candidate) => {
    return candidate.action.type === "multicast" && candidate.action.value != null;
  });

  return effect?.action.value == null
    ? null
    : {
        key: "multicast",
        kind: "multicast",
        value: String(effect.action.value),
        label: "多重施放"
      };
}

function shortEffectLine(effect: StructuredEffectView): string {
  const value = effect.action.value != null ? ` ${effect.action.value}` : "";
  const stat = effect.action.stat ? ` ${effect.action.stat}` : "";
  const tag = effect.action.tag ? ` ${effect.action.tag}` : "";
  return `${actionLabels[effect.action.type] ?? effect.action.type}${value}${stat}${tag}`;
}

function CardHoverPanel(props: {
  item: ItemIndexEntry;
  placement?: PlacedItem;
  outputStats: CardStat[];
  multicast: CardStat | null;
  showEffectDetails?: boolean;
}) {
  const { item, placement, outputStats, multicast, showEffectDetails = false } = props;
  const stats = multicast ? [...outputStats, multicast] : outputStats;
  const value = displayValue(item);
  const effectViews = showEffectDetails ? structuredEffectViews(item.structuredEffects) : [];

  return (
    <div className="board-card-hover" role="tooltip">
      <strong>{item.name}</strong>
      <div className="board-hover-meta">
        <span>{item.size}格</span>
        {value != null ? <span>价值 {value}</span> : null}
        {item.ammoMax ? <span>弹药 {item.ammoMax}</span> : null}
        <span>{item.rarity ?? "未知稀有度"}</span>
        <span>{formatCooldown(item.cooldownMs)}</span>
        {placement ? (
          <span>
            位置 {placement.startSlot + 1}-{placement.endSlot + 1}
          </span>
        ) : null}
      </div>
      {stats.length > 0 ? (
        <div className="board-hover-stats">
          {stats.map((stat) => (
            <span key={stat.key}>
              {stat.label} {stat.value}
            </span>
          ))}
        </div>
      ) : null}
      <p>{item.text || "没有可展示的效果文本。"}</p>
      {item.tags.length > 0 ? (
        <div className="board-hover-tags">
          {item.tags.slice(0, 8).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {effectViews.length > 0 ? (
        <div className="board-hover-effects">
          {effectViews.slice(0, 6).map((effect, index) => (
            <span key={`${item.id}-hover-effect-${index}`} title={effect.rawText}>
              {shortEffectLine(effect)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BoardCardDetail({ item }: { item: ItemIndexEntry }) {
  const effectViews = structuredEffectViews(item.structuredEffects);
  const value = displayValue(item);

  return (
    <div className="board-card-detail">
      <div className="meta-pills board-card-meta">
        <span>{item.size}格</span>
        {value != null ? <span>价值 {value}</span> : null}
        {item.ammoMax ? <span>弹药 {item.ammoMax}</span> : null}
        <span>{item.rarity ?? "未知稀有度"}</span>
        <span>{formatCooldown(item.cooldownMs)}</span>
      </div>
      <p className="effect-text">{item.text || "没有可展示的效果文本。"}</p>
      {item.tags.length > 0 ? (
        <div className="tag-row board-card-tags">
          {item.tags.slice(0, 6).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {effectViews.length > 0 ? (
        <div className="structured-effects board-card-effects">
          {effectViews.slice(0, 4).map((effect, index) => (
            <span key={`${item.id}-${index}`} title={effect.rawText}>
              {shortEffectLine(effect)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ItemCardFace(props: { item: ItemIndexEntry; name?: string; showName?: boolean; actionLabel?: string }) {
  const { item, name = item.name, showName = true, actionLabel } = props;
  const outputStats = cardOutputStats(item);
  const multicast = cardMulticast(item);
  const value = displayValue(item);

  return (
    <div className="board-card-art">
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="board-card-fallback">{item.name.slice(0, 2)}</span>}
      {outputStats.length > 0 ? (
        <div className="card-output-strip" aria-label={`${item.name} 核心输出`}>
          {outputStats.map((stat) => (
            <span className={`card-output-stat card-output-${stat.kind}`} key={stat.key} title={`${stat.label} ${stat.value}`}>
              {stat.value}
            </span>
          ))}
        </div>
      ) : null}
      {multicast ? (
        <span className="card-multicast-stat" title={`${multicast.label} ${multicast.value}`}>
          x{multicast.value}
        </span>
      ) : null}
      {value != null ? <span className="board-card-value">{value}</span> : null}
      {item.ammoMax ? <span className="board-card-ammo" title={`最大弹药 ${item.ammoMax}`}>{item.ammoMax}</span> : null}
      {item.cooldownMs ? <span className="board-card-cooldown">{formatSeconds(item.cooldownMs)}</span> : null}
      {showName ? <span className="board-card-name">{name}</span> : null}
      {actionLabel ? <span className="catalog-item-card-action">{actionLabel}</span> : null}
    </div>
  );
}

export function ItemCardHoverPanel(props: { item: ItemIndexEntry; placement?: PlacedItem; showEffectDetails?: boolean }) {
  const { item, placement, showEffectDetails = false } = props;
  const outputStats = cardOutputStats(item);
  const multicast = cardMulticast(item);

  return <CardHoverPanel item={item} placement={placement} outputStats={outputStats} multicast={multicast} showEffectDetails={showEffectDetails} />;
}

function BoardCard(props: { item: ItemIndexEntry; placement: PlacedItem; variant: "compact" | "detail" }) {
  const { item, placement, variant } = props;

  return (
    <div
      className={`board-item board-item-${variant} board-card-size-${placement.size}`}
      style={{ gridColumn: `${placement.startSlot + 1} / span ${placement.size}`, gridRow: 1 }}
      tabIndex={0}
      title={`${placement.itemName}，${placement.size} 格，占用 ${placement.startSlot + 1}-${placement.endSlot + 1}`}
    >
      <ItemCardFace item={item} name={placement.itemName} />
      {variant === "detail" ? <BoardCardDetail item={item} /> : null}
      <ItemCardHoverPanel item={item} placement={placement} />
    </div>
  );
}

export function ItemCardPreview(props: { item: ItemIndexEntry; actionLabel?: string; onSelect: (item: ItemIndexEntry) => void }) {
  const { item, actionLabel = "加入", onSelect } = props;

  return (
    <article className={`catalog-item-card catalog-item-card-size-${item.size} board-item board-item-compact`} tabIndex={0}>
      <button type="button" className="catalog-item-card-button" onClick={() => onSelect(item)} aria-label={`${actionLabel}${item.name}`}>
        <ItemCardFace item={item} showName={false} actionLabel={actionLabel} />
      </button>
      <span className="catalog-item-card-name">{item.name}</span>
      <ItemCardHoverPanel item={item} showEffectDetails />
    </article>
  );
}

export function BoardPreview({ layout, itemById, variant = "compact", showHeader = true }: BoardPreviewProps) {
  const occupiedSlots = new Set(layout.placements.flatMap((placement) => {
    return Array.from({ length: placement.size }, (_, index) => placement.startSlot + index);
  }));

  return (
    <section className={`board-preview board-preview-${variant}`} aria-label="优化棋盘布局">
      {showHeader ? (
        <div className="board-preview-heading">
          <h3>棋盘布局</h3>
          <strong>{layout.layoutScore}</strong>
        </div>
      ) : null}
      <div className="board-grid" style={{ gridTemplateColumns: `repeat(${layout.slotLimit}, minmax(72px, 1fr))` }}>
        {Array.from({ length: layout.slotLimit }, (_, slot) => (
          <div
            aria-hidden="true"
            className={`board-slot${occupiedSlots.has(slot) ? " occupied" : ""}`}
            key={`slot-${slot}`}
            style={{ gridColumn: `${slot + 1} / span 1`, gridRow: 1 }}
          >
            {slot + 1}
          </div>
        ))}
        {layout.placements.map((placement) => {
          const item = itemById.get(placement.itemId);
          return item ? <BoardCard item={item} key={`${placement.itemId}-${placement.startSlot}`} placement={placement} variant={variant} /> : null;
        })}
      </div>
      {variant === "compact" ? null : layout.reasons.length > 0 ? (
        <ul className="layout-notes">
          {layout.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {variant === "compact" ? null : layout.warnings.length > 0 ? (
        <div className="layout-warnings">
          {layout.warnings.slice(0, 2).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
