import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getCardName, getTooltipTexts } from "../src/lib/bazaar-data/cardRecord";
import { loadRawData, normalizeAll, projectSemanticDocumentToStructuredEffects, structuredEffectHasUnknown } from "../src/lib/bazaar-data";
import type { ActionNode, EnchantmentDef, ItemDef, SkillDef, StructuredEffect } from "../src/lib/bazaar-data";

type CorpusEntity = ItemDef | SkillDef | EnchantmentDef;

type CorpusEntry = {
  schemaVersion: "effect-rawtext-corpus/v1";
  corpusId: string;
  entityType: "item" | "skill" | "enchantment";
  entityId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  hero?: string | null;
  rarity?: string | null;
  size?: number;
  tags?: string[];
  rawTextHash: string;
  rawTextEn: string;
  rawTextZh: string;
  tooltipTextsEn: string[];
  tooltipTextsZh: string[];
  currentParse: {
    structuredEffectCount: number;
    structuredUnknownCount: number;
    semanticClauseCount: number;
    semanticUnknownActionCount: number;
    semanticWarningCodes: string[];
    projectionStatus: "exact" | "partial" | "lossy" | "unsupported";
    projectionUnsupportedCount: number;
  };
  structuredEffects: Pick<StructuredEffect, "id" | "kind" | "activeIn" | "trigger" | "action" | "prerequisites" | "rawText">[];
};

const outputPath = path.resolve(process.cwd(), "docs/effect-rawtext-corpus.jsonl");

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function countUnknownActions(node: ActionNode): number {
  if (node.node === "atomic") return node.action.type === "unknown" ? 1 : 0;
  if (node.node === "parallel" || node.node === "sequence") {
    return node.actions.reduce((sum, child) => sum + countUnknownActions(child), 0);
  }
  return [...node.then, ...(node.else ?? [])].reduce((sum, child) => sum + countUnknownActions(child), 0);
}

function semanticUnknownActionCount(entity: CorpusEntity): number {
  return entity.semanticEffects?.clauses.reduce((sum, clause) => sum + clause.actions.reduce((innerSum, node) => innerSum + countUnknownActions(node), 0), 0) ?? 0;
}

function semanticWarningCodes(entity: CorpusEntity): string[] {
  return [...new Set(entity.semanticEffects?.warnings.map((warning) => warning.code) ?? [])].sort();
}

function toEntry(entityType: CorpusEntry["entityType"], entity: CorpusEntity): CorpusEntry | null {
  const tooltipTextsEn = getTooltipTexts(entity.raw as Record<string, unknown>, "en-US").map(normalizeText).filter(Boolean);
  const tooltipTextsZh = getTooltipTexts(entity.raw as Record<string, unknown>, "zh-CN").map(normalizeText).filter(Boolean);
  const rawTextEn = normalizeText(entity.semanticEffects?.rawText ?? tooltipTextsEn.join(" "));

  if (!rawTextEn) return null;

  const rawTextZh = normalizeText(tooltipTextsZh.join(" "));
  const semanticProjection = entity.semanticEffects ? projectSemanticDocumentToStructuredEffects(entity.semanticEffects) : null;
  const structuredUnknownCount = entity.structuredEffects.filter(structuredEffectHasUnknown).length;
  const projectionUnsupportedCount = semanticProjection?.structuredEffects.filter((effect) => effect.projectionStatus === "unsupported").length ?? 0;
  const rawTextHash = hashText(rawTextEn);

  return {
    schemaVersion: "effect-rawtext-corpus/v1",
    corpusId: `${entityType}:${entity.id}:${rawTextHash}`,
    entityType,
    entityId: entity.id,
    slug: entity.slug,
    nameZh: entity.name,
    nameEn: entityType === "enchantment" ? entity.name : normalizeText(getCardName(entity.raw as Record<string, unknown>, "en-US")),
    ...("hero" in entity ? { hero: entity.hero } : {}),
    ...("rarity" in entity ? { rarity: entity.rarity ?? null } : {}),
    ...("size" in entity ? { size: entity.size } : {}),
    ...("tags" in entity ? { tags: entity.tags } : {}),
    rawTextHash,
    rawTextEn,
    rawTextZh,
    tooltipTextsEn,
    tooltipTextsZh,
    currentParse: {
      structuredEffectCount: entity.structuredEffects.length,
      structuredUnknownCount,
      semanticClauseCount: entity.semanticEffects?.clauses.length ?? 0,
      semanticUnknownActionCount: semanticUnknownActionCount(entity),
      semanticWarningCodes: semanticWarningCodes(entity),
      projectionStatus: semanticProjection?.status ?? "unsupported",
      projectionUnsupportedCount
    },
    structuredEffects: entity.structuredEffects.map(({ id, kind, activeIn, trigger, action, prerequisites, rawText }) => ({
      id,
      kind,
      activeIn,
      ...(trigger ? { trigger } : {}),
      action,
      ...(prerequisites ? { prerequisites } : {}),
      rawText
    }))
  };
}

const raw = loadRawData();
const normalized = normalizeAll(raw);
const entries = [
  ...normalized.items.map((item) => toEntry("item", item)),
  ...normalized.skills.map((skill) => toEntry("skill", skill)),
  ...normalized.enchantments.map((enchantment) => toEntry("enchantment", enchantment))
].filter((entry): entry is CorpusEntry => entry != null);

entries.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.nameZh.localeCompare(b.nameZh) || a.entityId.localeCompare(b.entityId));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);

const uniqueRawTexts = new Set(entries.map((entry) => entry.rawTextHash));
const structuredUnknownEntries = entries.filter((entry) => entry.currentParse.structuredUnknownCount > 0).length;
const semanticUnknownEntries = entries.filter((entry) => entry.currentParse.semanticUnknownActionCount > 0).length;
const unsupportedProjectionEntries = entries.filter((entry) => entry.currentParse.projectionStatus === "unsupported").length;

console.log(`Wrote ${entries.length} full rawText corpus entries to ${outputPath}`);
console.log(`Unique English rawText hashes: ${uniqueRawTexts.size}`);
console.log(`Entries with structured unknowns: ${structuredUnknownEntries}`);
console.log(`Entries with semantic unknown actions: ${semanticUnknownEntries}`);
console.log(`Entries with unsupported semantic projection: ${unsupportedProjectionEntries}`);
