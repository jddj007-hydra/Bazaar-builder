import { asRecord, getAvailableTiers, normalizeCardTier, numberValue } from "./cardRecord";
import type { CardTier, ItemTierAttribute, ItemTierAttributes } from "./types";

export const tierOrder: CardTier[] = ["Bronze", "Silver", "Gold", "Diamond", "Legendary"];

const tierAttributeLabels: Record<string, string> = {
  AmmoMax: "弹药",
  BurnApplyAmount: "灼烧",
  BurnRemoveAmount: "移除灼烧",
  BuyPrice: "价格",
  ChargeAmount: "充能",
  ChargeTargets: "充能目标",
  CooldownDisabled: "禁用冷却",
  CooldownMax: "冷却",
  CritChance: "暴击",
  Custom_0: "数值",
  Custom_1: "数值 2",
  Custom_2: "数值 3",
  Custom_3: "数值 4",
  Custom_4: "数值 5",
  Custom_5: "数值 6",
  Custom_6: "数值 7",
  Custom_7: "数值 8",
  Custom_8: "数值 9",
  DamageAmount: "伤害",
  DestroyTargets: "摧毁目标",
  DisableTargets: "禁用目标",
  EnchantTargets: "附魔目标",
  FlatTempoCostReduction: "节奏消耗降低",
  FlyingTargets: "飞行目标",
  ForceUseTargets: "强制使用目标",
  FreezeAmount: "冻结",
  FreezeTargets: "冻结目标",
  HasteAmount: "加速",
  HasteTargets: "加速目标",
  HealAmount: "治疗",
  Lifesteal: "吸血",
  Multicast: "多重",
  PercentSlowReduction: "减速抗性",
  PercentTempoCostReduction: "节奏消耗降低%",
  PoisonApplyAmount: "剧毒",
  PoisonRemoveAmount: "移除剧毒",
  RageApplyAmount: "怒火",
  RegenApplyAmount: "再生",
  ReloadAmount: "装填",
  ReloadTargets: "装填目标",
  SellPrice: "价值",
  Shield: "护甲",
  ShieldApplyAmount: "护甲",
  SlowAmount: "减速",
  SlowTargets: "减速目标",
  TempoApplyAmount: "节奏",
  TempoCost: "节奏消耗",
  TransformTargets: "转化目标",
  UpgradeTargets: "升级目标"
};

const millisecondAttributes = new Set([
  "ChargeAmount",
  "CooldownMax",
  "FlatCooldownReduction",
  "FreezeAmount",
  "HasteAmount",
  "SlowAmount"
]);

export const tierAttributeKeys = Object.keys(tierAttributeLabels);

const itemTierAttributeKeys = tierAttributeKeys.filter((key) => key !== "BuyPrice");
const skillTierAttributeKeys = tierAttributeKeys.filter((key) => key !== "SellPrice");

export function tierLabel(tier: string): string {
  if (tier === "Bronze") return "青铜";
  if (tier === "Silver") return "白银";
  if (tier === "Gold") return "黄金";
  if (tier === "Diamond") return "钻石";
  if (tier === "Legendary") return "传奇";
  return tier;
}

function numericAttr(record: Record<string, unknown>, key: string): number | null {
  return numberValue(record[key]);
}

function normalizeTierAttributeValue(key: string, value: number): number {
  return millisecondAttributes.has(key) ? value / 1000 : value;
}

export function tierRank(tier: string): number {
  const normalized = normalizeCardTier(tier);
  const index = normalized ? tierOrder.indexOf(normalized) : -1;
  return index < 0 ? 99 : index;
}

function tierAttributesForRecord(record: Record<string, unknown>, keys: string[]): ItemTierAttributes[] {
  const baseAttributes = asRecord(record.BaseAttributes);
  const tiers = asRecord(record.Tiers);

  return getAvailableTiers(record)
    .map((tier) => {
      const tierValue = asRecord(tiers[tier]);
      const overrideAttributes = asRecord(asRecord(tierValue).OverrideAttributes);
      const attrs = keys
        .map((key): ItemTierAttribute | null => {
          const rawValue = numericAttr(overrideAttributes, key) ?? numericAttr(baseAttributes, key);
          return rawValue == null
            ? null
            : {
                key,
                label: tierAttributeLabels[key],
                value: normalizeTierAttributeValue(key, rawValue)
              };
        })
        .filter((entry): entry is ItemTierAttribute => Boolean(entry));

      return attrs.length > 0 ? { tier, attrs } : null;
    })
    .filter((entry): entry is ItemTierAttributes => Boolean(entry))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

export function itemTierAttributesForRecord(record: Record<string, unknown>): ItemTierAttributes[] {
  return tierAttributesForRecord(record, itemTierAttributeKeys);
}

export function skillTierAttributesForRecord(record: Record<string, unknown>): ItemTierAttributes[] {
  return tierAttributesForRecord(record, skillTierAttributeKeys);
}
