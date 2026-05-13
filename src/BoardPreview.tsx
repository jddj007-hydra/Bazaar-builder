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
  icon: string;
  value: string;
  label: string;
};

const actionStatMeta: Partial<Record<StructuredEffectView["action"]["type"], { kind: string; icon: string; label: string }>> = {
  burn: { kind: "burn", icon: "BRN", label: "燃烧" },
  charge: { kind: "charge", icon: "CHG", label: "充能" },
  damage: { kind: "damage", icon: "DMG", label: "伤害" },
  freeze: { kind: "freeze", icon: "FRZ", label: "冻结" },
  haste: { kind: "haste", icon: "HST", label: "加速" },
  heal: { kind: "heal", icon: "HEL", label: "治疗" },
  multicast: { kind: "multicast", icon: "x", label: "多重施放" },
  poison: { kind: "poison", icon: "PSN", label: "剧毒" },
  reload: { kind: "ammo", icon: "AM", label: "装填" },
  shield: { kind: "shield", icon: "SHD", label: "护盾" },
  slow: { kind: "slow", icon: "SLW", label: "减速" }
};

const statLabelByName: Record<string, { kind: string; icon: string; label: string }> = {
  ammo: { kind: "ammo", icon: "AM", label: "弹药" },
  burn: { kind: "burn", icon: "BRN", label: "燃烧" },
  "crit chance": { kind: "crit", icon: "%", label: "暴击" },
  "crit%": { kind: "crit", icon: "%", label: "暴击" },
  damage: { kind: "damage", icon: "DMG", label: "伤害" },
  heal: { kind: "heal", icon: "HEL", label: "治疗" },
  multicast: { kind: "multicast", icon: "x", label: "多重施放" },
  poison: { kind: "poison", icon: "PSN", label: "剧毒" },
  shield: { kind: "shield", icon: "SHD", label: "护盾" }
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

function statMetaForEffect(effect: StructuredEffectView): { kind: string; icon: string; label: string } | null {
  if (effect.action.type === "gain_stat" || effect.action.type === "modify_stat") {
    const normalized = effect.action.stat?.toLowerCase().trim();
    return normalized ? statLabelByName[normalized] ?? null : null;
  }

  return actionStatMeta[effect.action.type] ?? null;
}

function cardStats(item: ItemIndexEntry): CardStat[] {
  const stats: CardStat[] = [];

  if (item.cooldownMs) {
    stats.push({
      key: "cooldown",
      kind: "cooldown",
      icon: "CD",
      value: formatSeconds(item.cooldownMs),
      label: "冷却"
    });
  }

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
      icon: meta.icon,
      value: String(effect.action.value),
      label: meta.label
    });
  }

  return stats.slice(0, 4);
}

function shortEffectLine(effect: StructuredEffectView): string {
  const value = effect.action.value != null ? ` ${effect.action.value}` : "";
  const stat = effect.action.stat ? ` ${effect.action.stat}` : "";
  const tag = effect.action.tag ? ` ${effect.action.tag}` : "";
  return `${actionLabels[effect.action.type] ?? effect.action.type}${value}${stat}${tag}`;
}

function CardHoverPanel(props: { item: ItemIndexEntry; placement: PlacedItem; stats: CardStat[] }) {
  const { item, placement, stats } = props;

  return (
    <div className="board-card-hover" role="tooltip">
      <strong>{item.name}</strong>
      <div className="board-hover-meta">
        <span>{item.size}格</span>
        <span>{item.rarity ?? "未知稀有度"}</span>
        <span>{formatCooldown(item.cooldownMs)}</span>
        <span>
          位置 {placement.startSlot + 1}-{placement.endSlot + 1}
        </span>
      </div>
      {stats.length > 0 ? (
        <div className="board-hover-stats">
          {stats.map((stat) => (
            <span key={stat.key}>
              <b>{stat.icon}</b>
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
    </div>
  );
}

function BoardCardDetail({ item }: { item: ItemIndexEntry }) {
  const effectViews = structuredEffectViews(item.structuredEffects);

  return (
    <div className="board-card-detail">
      <div className="meta-pills board-card-meta">
        <span>{item.size}格</span>
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

function BoardCard(props: { item: ItemIndexEntry; placement: PlacedItem; variant: "compact" | "detail" }) {
  const { item, placement, variant } = props;
  const stats = cardStats(item);

  return (
    <div
      className={`board-item board-card-${variant}`}
      style={{ gridColumn: `${placement.startSlot + 1} / span ${placement.size}`, gridRow: 1 }}
      tabIndex={0}
      title={`${placement.itemName}，${placement.size} 格，占用 ${placement.startSlot + 1}-${placement.endSlot + 1}`}
    >
      <div className="board-card-art">
        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="board-card-fallback">{item.name.slice(0, 2)}</span>}
        {stats.length > 0 ? (
          <div className="card-stat-strip" aria-label={`${item.name} 核心数值`}>
            {stats.map((stat) => (
              <span className={`card-stat card-stat-${stat.kind}`} key={stat.key} title={`${stat.label} ${stat.value}`}>
                <b aria-hidden="true">{stat.icon}</b>
                {stat.value}
              </span>
            ))}
          </div>
        ) : null}
        <span className="board-card-size">{placement.size}</span>
        <span className="board-card-name">{placement.itemName}</span>
      </div>
      {variant === "detail" ? <BoardCardDetail item={item} /> : null}
      <CardHoverPanel item={item} placement={placement} stats={stats} />
    </div>
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
