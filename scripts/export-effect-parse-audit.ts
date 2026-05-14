import fs from "node:fs";
import path from "node:path";
import {
  asRecord,
  getCollection,
  getTooltipTexts,
  stringValue
} from "../src/lib/bazaar-data/cardRecord";
import { loadRawData } from "../src/lib/bazaar-data/loadRawData";
import { normalizeTags } from "../src/lib/bazaar-data/normalizeTags";
import { parseStructuredEffectsFromTexts } from "../src/lib/bazaar-data/parseEffects";
import { parseSemanticEffectDocumentFromTexts, projectSemanticDocumentToStructuredEffects } from "../src/lib/bazaar-data/semanticEffects";
import { structuredEffectHasUnknown, structuredEffectView } from "../src/lib/bazaar-data/structuredEffects";
import type { StructuredCondition, StructuredEffect, StructuredTarget, StructuredValue } from "../src/lib/bazaar-data/types";

type AuditEntry = {
  enPattern: string;
  zhPattern: string;
  structuredSummary: string;
  actionType: string;
  count: number;
  examples: Set<string>;
  hasUnknown: boolean;
};

const raw = loadRawData();
const tags = normalizeTags(raw.tags);
const outputPath = path.resolve(process.cwd(), "docs/effect-text-parse-audit.md");
const entries = new Map<string, AuditEntry>();
const semanticMetrics = {
  documents: 0,
  clauses: 0,
  unsupportedProjection: 0,
  booleanAmbiguity: 0,
  attributeInferredFromTag: 0,
  slotActions: 0,
  effectModifiers: 0,
  variableActions: 0,
  firstLimiters: 0,
  unknownActions: 0
};

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeNumbers(text: string): string {
  return text
    .replace(/\b\d+(?:st|nd|rd|th)\b/gi, "{n}")
    .replace(/[-+]?\d+(?:\.\d+)?%?/g, (match) => (match.endsWith("%") ? "{n}%" : "{n}"))
    .replace(/\s+/g, " ")
    .trim();
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function localeRecord(record: Record<string, unknown>, locale: "en-US" | "zh-CN"): Record<string, unknown> {
  return asRecord(asRecord(record.i18n)[locale]);
}

function title(record: Record<string, unknown>, locale: "en-US" | "zh-CN"): string {
  const localized = localeRecord(record, locale);
  return (
    normalizeText(stringValue(asRecord(localized.Title).Text)) ??
    normalizeText(stringValue(asRecord(record.Title).Text)) ??
    normalizeText(stringValue(record.Id)) ??
    "Unknown"
  );
}

function entityType(record: Record<string, unknown>): string {
  return normalizeText(stringValue(record.Type)) ?? "Card";
}

function structuredTargetSummary(target: StructuredTarget | undefined): string {
  if (!target) return "target=none";
  const parts = [`${target.$type}`];
  if ("TargetMode" in target && target.TargetMode) parts.push(`mode=${target.TargetMode}`);
  if ("TargetSection" in target && target.TargetSection) parts.push(`section=${target.TargetSection}`);
  const conditions = "Conditions" in target ? target.Conditions : undefined;
  if (conditions?.length) {
    parts.push(
      `conditions=${conditions.map((condition: StructuredCondition) => {
        if (condition.$type === "TCardConditionalTag") return `tag:${condition.Tags.join("+")}`;
        if (condition.$type === "TCardConditionalSize") return `size:{n}`;
        if (condition.$type === "TCardConditionalCount") return `count:${condition.ComparisonOperator}:{n}${condition.Tags?.length ? `:${condition.Tags.join("+")}` : ""}`;
        if (condition.$type === "TCardConditionalAttribute") return `attr:${condition.AttributeType}`;
        if (condition.$type === "TCardConditionalTierComparison") return `tier:${condition.ComparisonOperator}`;
        return condition.$type;
      }).join(",")}`
    );
  }
  return parts.join("/");
}

function structuredValueSummary(value: StructuredValue | undefined): string | null {
  if (!value) return null;
  if (value.$type === "TFixedValue") return "value=TFixedValue:{n}";
  if (value.$type === "TRangeValue") return "value=TRangeValue:{n}-{n}";
  if (
    value.$type === "TReferenceValueCardAttribute" ||
    value.$type === "TReferenceValueCardAttributeAggregate" ||
    value.$type === "TReferenceValuePlayerAttribute"
  ) {
    return `value=${value.$type}:${value.AttributeType}:${structuredTargetSummary(value.Target)}`;
  }
  if (value.$type === "TReferenceValueCardCount" || value.$type === "TReferenceValueCardTagCount") {
    return `value=${value.$type}:${structuredTargetSummary(value.Target)}`;
  }
  if (value.$type === "TReferenceValuePlayerAttributeChange") {
    return `value=${value.$type}${value.AttributeType ? `:${value.AttributeType}` : ""}${value.ChangeDirection ? `:${value.ChangeDirection}` : ""}${value.Scope ? `:${value.Scope}` : ""}`;
  }
  return `value=${value.$type}`;
}

function structuredSummary(structured: StructuredEffect): string {
  const trigger = structured.trigger
    ? [
        `trigger=${structured.trigger.$type}`,
        `source=${structured.trigger.SourceEvent}`,
        structured.trigger.Tag ? `tag=${structured.trigger.Tag}` : null,
        structured.trigger.Subject ? `subject=${structuredTargetSummary(structured.trigger.Subject)}` : null,
        structured.trigger.Target ? `triggerTarget=${structuredTargetSummary(structured.trigger.Target)}` : null
      ]
        .filter(Boolean)
        .join("/")
    : "trigger=aura";
  const action = [
    `action=${structured.action.$type}`,
    `source=${structured.action.SourceAction}`,
    structured.action.AttributeType ? `attr=${structured.action.AttributeType}` : null,
    structured.action.Operation ? `op=${structured.action.Operation}` : null,
    structured.action.Tags?.length ? `tags=${structured.action.Tags.join("+")}` : null,
    structured.action.Target ? structuredTargetSummary(structured.action.Target) : null,
    structuredValueSummary(structured.action.Value)
  ]
    .filter(Boolean)
    .join("/");
  const prerequisites = structured.prerequisites?.length ? `prereq=${structured.prerequisites.map((condition) => condition.$type).join(",")}` : null;
  return [`kind=${structured.kind}`, trigger, action, prerequisites].filter(Boolean).join("; ");
}

function standaloneRawTextMap(enTexts: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();

  enTexts.forEach((text, index) => {
    for (const effect of parseStructuredEffectsFromTexts([text], tags)) {
      const rawText = effect.rawText || text;
      map.set(rawText, [...(map.get(rawText) ?? []), index]);
    }
  });

  return map;
}

function sourceIndexForEffect(
  effect: StructuredEffect,
  rawTextIndexes: Map<string, number[]>,
  fallbackIndex: number
): number {
  const rawText = effect.rawText || "";
  const indexes = rawTextIndexes.get(rawText);
  if (indexes?.length) return indexes[0];
  return fallbackIndex;
}

function addEntry(params: {
  enText: string;
  zhText: string;
  effect: StructuredEffect;
  example: string;
}): void {
  const enPattern = normalizeNumbers(params.effect.rawText || params.enText);
  const zhPattern = normalizeNumbers(params.zhText);
  const structuredParseSummary = structuredSummary(params.effect);
  const key = `${enPattern}\u0000${zhPattern}\u0000${structuredParseSummary}`;
  const existing = entries.get(key);

  if (existing) {
    existing.count += 1;
    if (existing.examples.size < 5) existing.examples.add(params.example);
    return;
  }

  entries.set(key, {
    enPattern,
    zhPattern,
    structuredSummary: structuredParseSummary,
    actionType: structuredEffectView(params.effect).action.type,
    count: 1,
    examples: new Set([params.example]),
    hasUnknown: structuredEffectHasUnknown(params.effect)
  });
}

function addRecord(record: Record<string, unknown>): void {
  const enTexts = getTooltipTexts(record, "en-US");
  const zhTexts = getTooltipTexts(record, "zh-CN");
  if (enTexts.length === 0) return;

  const parsedEffects = parseStructuredEffectsFromTexts(enTexts, tags);
  const semanticDocument = parseSemanticEffectDocumentFromTexts(enTexts, tags, {
    sourceCardId: normalizeText(stringValue(record.Id)) ?? undefined,
    sourceCardName: title(record, "en-US"),
    structuredEffectIds: parsedEffects.map((effect) => effect.id)
  });
  const semanticProjection = projectSemanticDocumentToStructuredEffects(semanticDocument);
  semanticMetrics.documents += 1;
  semanticMetrics.clauses += semanticDocument.clauses.length;
  if (semanticProjection.status === "unsupported" || semanticProjection.status === "partial") {
    semanticMetrics.unsupportedProjection += semanticProjection.structuredEffects.filter((effect) => effect.projectionStatus === "unsupported").length;
  }
  semanticMetrics.booleanAmbiguity += semanticDocument.warnings.filter((warning) => warning.code === "BOOLEAN_AMBIGUITY").length;
  semanticMetrics.attributeInferredFromTag += semanticDocument.warnings.filter((warning) => warning.code === "ATTRIBUTE_INFERRED_FROM_TAG").length;
  semanticMetrics.slotActions += semanticDocument.clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "modify_slot")
  ).length;
  semanticMetrics.effectModifiers += semanticDocument.clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "modify_effect")
  ).length;
  semanticMetrics.variableActions += semanticDocument.clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "modify_variable")
  ).length;
  semanticMetrics.firstLimiters += semanticDocument.clauses.filter((clause) => clause.limiter?.kind === "once" || clause.limiter?.kind === "first_n").length;
  semanticMetrics.unknownActions += semanticDocument.clauses.filter((clause) =>
    clause.actions.some((node) => node.node === "atomic" && node.action.type === "unknown")
  ).length;
  const rawTextIndexes = standaloneRawTextMap(enTexts);
  const id = normalizeText(stringValue(record.Id)) ?? "unknown-id";
  const label = `${entityType(record)}: ${title(record, "en-US")} / ${title(record, "zh-CN")} (${id})`;

  parsedEffects.forEach((effect, parsedIndex) => {
    const sourceIndex = sourceIndexForEffect(effect, rawTextIndexes, Math.min(parsedIndex, enTexts.length - 1));
    const enText = enTexts[sourceIndex] ?? effect.rawText ?? "";
    const zhText = zhTexts[sourceIndex] ?? "";
    if (!normalizeText(enText) || !normalizeText(zhText)) return;

    addEntry({
      enText,
      zhText,
      effect,
      example: `${label}<br>EN: ${enText}<br>ZH: ${zhText}`
    });
  });
}

function renderTable(title: string, rows: AuditEntry[]): string {
  const lines = [
    `## ${title}`,
    "",
    `共 ${rows.length} 条归一化规则。`,
    "",
    "| # | 英文效果模式 | 中文效果模式 | 结构化解析 | 出现次数 | 样例 |",
    "|---:|---|---|---|---:|---|"
  ];

  rows.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${markdownCell(entry.enPattern)} | ${markdownCell(entry.zhPattern)} | ${markdownCell(entry.structuredSummary)} | ${entry.count} | ${markdownCell([...entry.examples].join("<br><br>"))} |`
    );
  });

  return `${lines.join("\n")}\n`;
}

const seenIds = new Set<string>();
for (const collection of [getCollection(raw.cards, "cards"), getCollection(raw.items, "items"), getCollection(raw.skills, "skills")]) {
  for (const record of collection) {
    const id = stringValue(record.Id);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);
    addRecord(record);
  }
}

const allRows = [...entries.values()].sort(
  (a, b) =>
    Number(b.hasUnknown) - Number(a.hasUnknown) ||
    a.actionType.localeCompare(b.actionType) ||
    a.enPattern.localeCompare(b.enPattern)
);
const unknownRows = allRows.filter((entry) => entry.hasUnknown);
const actionCounts = new Map<string, number>();
for (const row of allRows) {
  actionCounts.set(row.actionType, (actionCounts.get(row.actionType) ?? 0) + 1);
}

const header = [
  "# Bazaar 效果文本解析审核",
  "",
  `生成时间：${new Date().toISOString()}`,
  "",
  "用途：人工检查效果文本 parser 是否解析正确。",
  "",
  "数据来源：本地 `data/raw/bazaardb/cards.json`、`items.json`、`skills.json`。",
  "",
  "文本口径：使用项目当前 `getTooltipTexts` 得到的替换变量后的英文/中文效果文本；英文文本再交给当前 `parseStructuredEffectsFromTexts` 解析。",
  "",
  "去重规则：把英文和中文效果文本里的纯数值、百分比、序数统一替换为 `{n}` 后去重。因此 `3 other items start Flying` 和 `2 other items start Flying` 会归为同一条规则。",
  "",
  "结构化解析列说明：按卡牌能力模型展示 `kind`、结构化 `TTrigger*`、`TAction*`、`TTarget*`、`TReferenceValue*`、属性和条件。",
  "",
  `总计 ${allRows.length} 条归一化效果规则；其中 ${unknownRows.length} 条含 unknown。`,
  "",
  "## Semantic IR 覆盖指标",
  "",
  "| 指标 | 数量 |",
  "|---|---:|",
  `| semantic 文档数 | ${semanticMetrics.documents} |`,
  `| semantic clause 数 | ${semanticMetrics.clauses} |`,
  `| unsupported projection 数 | ${semanticMetrics.unsupportedProjection} |`,
  `| unknown semantic action 数 | ${semanticMetrics.unknownActions} |`,
  `| boolean ambiguity 数 | ${semanticMetrics.booleanAmbiguity} |`,
  `| attribute inferred from tag 数 | ${semanticMetrics.attributeInferredFromTag} |`,
  `| slot action 覆盖数 | ${semanticMetrics.slotActions} |`,
  `| effect modifier 覆盖数 | ${semanticMetrics.effectModifiers} |`,
  `| variable action 覆盖数 | ${semanticMetrics.variableActions} |`,
  `| first limiter 覆盖数 | ${semanticMetrics.firstLimiters} |`,
  "",
  "| action 类型 | 规则数 |",
  "|---|---:|",
  ...[...actionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([action, count]) => `| ${action} | ${count} |`),
  ""
];

const body = [
  renderTable("需要优先检查：含 unknown 的解析", unknownRows),
  renderTable("全部效果规则", allRows)
].join("\n");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${header.join("\n")}\n${body}`);

console.log(`Wrote ${allRows.length} normalized effect parse rules to ${outputPath}`);
console.log(`Unknown parse rules: ${unknownRows.length}`);
