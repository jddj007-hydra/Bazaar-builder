import { asArray, asRecord, getCollection, stringValue } from "./cardRecord";

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
