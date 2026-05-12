import fs from "node:fs";
import path from "node:path";
import type { RawDataBundle } from "./types";

export const DEFAULT_RAW_DATA_DIR = path.resolve(process.cwd(), "data/raw/bazaardb");

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readOptionalJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return readJsonFile(filePath);
}

export function loadRawData(dataRoot = DEFAULT_RAW_DATA_DIR): RawDataBundle {
  const manifestsDir = path.join(dataRoot, "manifests");
  const manifests: Record<string, unknown> = {};

  if (fs.existsSync(manifestsDir)) {
    for (const fileName of fs.readdirSync(manifestsDir).filter((file) => file.endsWith(".json"))) {
      manifests[fileName] = readJsonFile(path.join(manifestsDir, fileName));
    }
  }

  return {
    dataRoot,
    cards: readOptionalJsonFile(path.join(dataRoot, "cards.json")),
    items: readOptionalJsonFile(path.join(dataRoot, "items.json")),
    skills: readOptionalJsonFile(path.join(dataRoot, "skills.json")),
    heroes: readOptionalJsonFile(path.join(dataRoot, "heroes.json")),
    enchantments: readOptionalJsonFile(path.join(dataRoot, "enchantments.json")),
    sources: readOptionalJsonFile(path.join(dataRoot, "sources.json")),
    tags: readOptionalJsonFile(path.join(dataRoot, "tags.json")),
    imageManifest: readOptionalJsonFile(path.join(dataRoot, "image_manifest.json")),
    manifests
  };
}
