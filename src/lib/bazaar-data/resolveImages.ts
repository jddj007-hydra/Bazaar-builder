import { asArray, asRecord, stringValue } from "./cardRecord";
import type { RawDataBundle } from "./types";

export type ImageResolver = {
  byCardId: Map<string, string>;
  byTitle: Map<string, string>;
};

const publicCardImageRoot = "/images/cards/";

function localImageUrlFromPath(pathValue: unknown): string | null {
  const localPath = stringValue(pathValue);
  if (!localPath) {
    return null;
  }

  if (localPath.startsWith(publicCardImageRoot)) {
    return localPath;
  }

  const fileName = localPath.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  return fileName ? `${publicCardImageRoot}${fileName}` : null;
}

function localImageUrlFromRecord(record: Record<string, unknown>): string | null {
  return localImageUrlFromPath(record.local_image_path) ?? localImageUrlFromPath(record.localImagePath);
}

function addImageEntry(resolver: ImageResolver, entry: unknown): void {
  const record = asRecord(entry);
  const imageUrl =
    localImageUrlFromRecord(record) ??
    stringValue(record.image_url) ??
    stringValue(record.imageUrl) ??
    stringValue(record.url) ??
    stringValue(record.ArtLarge);

  if (!imageUrl) {
    return;
  }

  const cardId = stringValue(record.card_id) ?? stringValue(record.Id) ?? stringValue(record.id);
  const title = stringValue(record.title) ?? stringValue(record.name);

  if (cardId) {
    resolver.byCardId.set(cardId, imageUrl);
  }
  if (title) {
    resolver.byTitle.set(title.toLowerCase(), imageUrl);
  }
}

export function createImageResolver(rawData: Pick<RawDataBundle, "imageManifest" | "manifests">): ImageResolver {
  const resolver: ImageResolver = {
    byCardId: new Map(),
    byTitle: new Map()
  };

  for (const entry of asArray(asRecord(rawData.imageManifest).images)) {
    addImageEntry(resolver, entry);
  }

  for (const manifest of Object.values(rawData.manifests)) {
    for (const entry of asArray(asRecord(manifest).images)) {
      addImageEntry(resolver, entry);
    }
  }

  return resolver;
}

export function resolveCardImage(record: unknown, resolver: ImageResolver): string | null {
  const card = asRecord(record);
  const id = stringValue(card.Id) ?? stringValue(card.id);
  const name = stringValue(asRecord(card.Title).Text) ?? stringValue(card.title) ?? stringValue(card.name);

  return (
    (id ? resolver.byCardId.get(id) : undefined) ??
    localImageUrlFromRecord(card) ??
    stringValue(card.image_url) ??
    stringValue(card.ArtLarge) ??
    stringValue(card.Art) ??
    (name ? resolver.byTitle.get(name.toLowerCase()) : undefined) ??
    null
  );
}
