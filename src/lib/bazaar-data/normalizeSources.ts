import { asArray, asRecord, getCollection, numberValue, stringValue } from "./cardRecord";
import type { SourceIndexEntry } from "./types";

function sourceTitle(source: Record<string, unknown>, locale: "zh-CN" | "en-US"): string | null {
  const localized = asRecord(asRecord(source.i18n)[locale]);
  return stringValue(localized.title) ?? stringValue(localized.page_title);
}

export function buildSourceIdMap(rawSources: unknown): Map<string, string[]> {
  const sourceIdsByCard = new Map<string, string[]>();

  for (const source of getCollection(rawSources, "sources")) {
    const sourceId = stringValue(source.source_id) ?? stringValue(source.id) ?? stringValue(source.title);
    if (!sourceId) {
      continue;
    }

    for (const cardId of asArray(source.card_ids).map(stringValue)) {
      if (!cardId) continue;
      const current = sourceIdsByCard.get(cardId) ?? [];
      current.push(sourceId);
      sourceIdsByCard.set(cardId, current);
    }
  }

  return sourceIdsByCard;
}

export function getSourceWarning(sourceIds: string[] | undefined): string | null {
  if (!sourceIds || sourceIds.length <= 3) {
    return null;
  }

  return "Some generated items may not be available from the same source pool.";
}

export function normalizeSourceIndex(rawSources: unknown): SourceIndexEntry[] {
  return getCollection(rawSources, "sources")
    .map((source) => {
      const id = stringValue(source.source_id) ?? stringValue(source.id) ?? stringValue(source.title);
      if (!id) return null;

      const explicitDay = numberValue(source.day);
      const days = [
        ...asArray(source.days).map(numberValue),
        ...(explicitDay == null ? [] : [explicitDay])
      ].filter((day): day is number => day != null && Number.isInteger(day) && day > 0);

      return {
        id,
        name: sourceTitle(source, "zh-CN") ?? stringValue(source.title) ?? id,
        nameEn: sourceTitle(source, "en-US") ?? stringValue(source.title) ?? id,
        category: stringValue(source.category),
        categoryType: stringValue(source.category_type),
        days: [...new Set(days)].sort((a, b) => a - b),
        availabilityLabels: [
          ...asArray(source.availability_labels).map(stringValue),
          ...asArray(source.availabilities).map(stringValue)
        ].filter((value): value is string => Boolean(value)),
        cardCount: numberValue(source.card_count) ?? asArray(source.card_ids).length
      } satisfies SourceIndexEntry;
    })
    .filter((source): source is SourceIndexEntry => Boolean(source))
    .sort((a, b) => a.name.localeCompare(b.name));
}
