import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getCardName, getTooltipTexts } from "../src/lib/bazaar-data/cardRecord";
import {
  EFFECT_CORPUS_SCHEMA_VERSION,
  EFFECT_PARSER_VERSION,
  SEMANTIC_IR_SCHEMA_VERSION,
  loadRawData,
  normalizeAll,
  projectionAudit,
  projectSemanticDocumentToStructuredEffects,
  semanticUnknownActionCount,
  semanticUnsupportedReasons,
  semanticWarningCodes,
  semanticWarningMessages,
  structuredEffectHasUnknown,
  structuredUnknownTokenCount,
  structuredUnsupportedReasons,
  warningDetails
} from "../src/lib/bazaar-data";
import type { EffectCorpusEntry, EnchantmentDef, ItemDef, SkillDef } from "../src/lib/bazaar-data";
import type { StructuredEffect } from "../src/lib/bazaar-data";

type CorpusEntity = ItemDef | SkillDef | EnchantmentDef;

const outputPath = path.resolve(process.cwd(), "docs/effect-rawtext-corpus.jsonl");

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function corpusStructuredEffect(
  effect: StructuredEffect
): EffectCorpusEntry["structuredEffects"][number] {
  const { id, kind, activeIn, trigger, action, prerequisites, semanticSourceIds, projectionStatus, projectionWarnings, groupId, variableDeclarations, rawText } = effect;
  return {
    id,
    kind,
    activeIn,
    ...(trigger ? { trigger } : {}),
    action,
    ...(prerequisites ? { prerequisites } : {}),
    ...(semanticSourceIds ? { semanticSourceIds } : {}),
    ...(projectionStatus ? { projectionStatus } : {}),
    ...(projectionWarnings ? { projectionWarnings } : {}),
    ...(groupId ? { groupId } : {}),
    ...(variableDeclarations ? { variableDeclarations } : {}),
    rawText
  };
}

function toEntry(entityType: EffectCorpusEntry["entityType"], entity: CorpusEntity): EffectCorpusEntry | null {
  const tooltipTextsEn = getTooltipTexts(entity.raw as Record<string, unknown>, "en-US").map(normalizeText).filter(Boolean);
  const tooltipTextsZh = getTooltipTexts(entity.raw as Record<string, unknown>, "zh-CN").map(normalizeText).filter(Boolean);
  const originalFullTextEn = entity.semanticEffects?.rawText ?? tooltipTextsEn.join(" ");
  const rawTextEn = normalizeText(originalFullTextEn);

  if (!rawTextEn) return null;

  const rawTextZh = normalizeText(tooltipTextsZh.join(" "));
  const semanticProjection = entity.semanticEffects ? projectSemanticDocumentToStructuredEffects(entity.semanticEffects) : null;
  const projection = projectionAudit(semanticProjection?.structuredEffects ?? entity.structuredEffects, entity.semanticEffects);
  const structuredUnknownCount = entity.structuredEffects.filter(structuredEffectHasUnknown).length;
  const rawTextHash = hashText(rawTextEn);
  const nameEn = entityType === "enchantment" ? entity.name : normalizeText(getCardName(entity.raw as Record<string, unknown>, "en-US"));
  const legacyStructuredReasons = [...new Set(entity.structuredEffects.flatMap(structuredUnsupportedReasons))].sort();
  const semanticReasons = semanticUnsupportedReasons(entity.semanticEffects);
  const structuredEffects = entity.structuredEffects.map(corpusStructuredEffect);
  const semanticProjectedStructuredEffects = semanticProjection?.structuredEffects.map(corpusStructuredEffect) ?? [];
  const clauses =
    entity.semanticEffects?.clauses.map((clause) => ({
      id: clause.id,
      kind: clause.kind,
      ...(clause.sourceText ? { sourceText: clause.sourceText } : {}),
      ...(clause.normalizedText ? { normalizedText: clause.normalizedText } : {}),
      warningCodes: [...new Set((clause.warnings ?? []).map((warning) => warning.code))].sort(),
      warnings: warningDetails(clause.warnings),
      unsupportedReasons: [
        ...new Set([
          ...clause.actions.flatMap((node) => (node.node === "atomic" && node.action.type === "unknown" ? [`unknown semantic action: ${node.action.rawText}`] : [])),
          ...(clause.warnings ?? [])
            .filter((warning) => warning.code === "UNSUPPORTED_PROJECTION" || warning.code === "UNSUPPORTED_SEMANTIC_PARSE")
            .map((warning) => warning.message)
        ])
      ].sort()
    })) ?? [];

  return {
    schemaVersion: EFFECT_CORPUS_SCHEMA_VERSION,
    parserVersion: EFFECT_PARSER_VERSION,
    semanticSchemaVersion: SEMANTIC_IR_SCHEMA_VERSION,
    corpusId: `${entityType}:${entity.id}:${rawTextHash}`,
    entityType,
    entityId: entity.id,
    slug: entity.slug,
    sourceCardIds: [entity.semanticEffects?.sourceCardId ?? entity.id],
    sourceCardNames: [entity.semanticEffects?.sourceCardName ?? nameEn],
    nameZh: entity.name,
    nameEn,
    ...("hero" in entity ? { hero: entity.hero } : {}),
    ...("rarity" in entity ? { rarity: entity.rarity ?? null } : {}),
    ...("size" in entity ? { size: entity.size } : {}),
    ...("tags" in entity ? { tags: entity.tags } : {}),
    rawTextHash,
    originalFullTextEn,
    normalizedFullTextEn: rawTextEn,
    rawTextEn,
    rawTextZh,
    tooltipTextsEn,
    tooltipTextsZh,
    currentParse: {
      structuredEffectCount: entity.structuredEffects.length,
      structuredUnknownCount,
      structuredUnknownTokenCount: structuredUnknownTokenCount(entity.structuredEffects),
      semanticClauseCount: entity.semanticEffects?.clauses.length ?? 0,
      semanticUnknownActionCount: semanticUnknownActionCount(entity.semanticEffects),
      semanticWarningCodes: semanticWarningCodes(entity.semanticEffects),
      semanticWarningMessages: semanticWarningMessages(entity.semanticEffects),
      projectionStatus: projection.status,
      projectionUnsupportedCount: projection.unsupportedCount,
      projectionWarnings: projection.warnings,
      projectionReasons: projection.reasons,
      unsupportedReasons: [...new Set([...legacyStructuredReasons, ...semanticReasons])].sort(),
      legacyStructuredUnknownReasons: legacyStructuredReasons,
      semanticProjectionReasons: projection.reasons
    },
    clauses,
    structuredEffects,
    semanticProjectedStructuredEffects
  };
}

const raw = loadRawData();
const normalized = normalizeAll(raw);
const entries = [
  ...normalized.items.map((item) => toEntry("item", item)),
  ...normalized.skills.map((skill) => toEntry("skill", skill)),
  ...normalized.enchantments.map((enchantment) => toEntry("enchantment", enchantment))
].filter((entry): entry is EffectCorpusEntry => entry != null);

entries.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.entityId.localeCompare(b.entityId) || a.rawTextHash.localeCompare(b.rawTextHash));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);

const uniqueRawTexts = new Set(entries.map((entry) => entry.rawTextHash));
const structuredUnknownEntries = entries.filter((entry) => entry.currentParse.structuredUnknownCount > 0).length;
const structuredUnknownTokenEntries = entries.filter((entry) => entry.currentParse.structuredUnknownTokenCount > 0).length;
const semanticUnknownEntries = entries.filter((entry) => entry.currentParse.semanticUnknownActionCount > 0).length;
const unsupportedProjectionEntries = entries.filter((entry) => entry.currentParse.projectionStatus === "unsupported").length;

console.log(`Wrote ${entries.length} full rawText corpus entries to ${outputPath}`);
console.log(`Unique English rawText hashes: ${uniqueRawTexts.size}`);
console.log(`Entries with structured unknowns: ${structuredUnknownEntries}`);
console.log(`Entries with structured unknown tokens: ${structuredUnknownTokenEntries}`);
console.log(`Entries with semantic unknown actions: ${semanticUnknownEntries}`);
console.log(`Entries with unsupported semantic projection: ${unsupportedProjectionEntries}`);
