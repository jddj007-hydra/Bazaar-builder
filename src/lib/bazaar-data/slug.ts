export function slugify(value: string | null | undefined, fallback = "entry"): string {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || fallback;
}

export function uniqueSlug(base: string, seen: Set<string>, fallback = "entry"): string {
  const cleanBase = slugify(base, fallback);
  let candidate = cleanBase;
  let suffix = 2;

  while (seen.has(candidate)) {
    candidate = `${cleanBase}-${suffix}`;
    suffix += 1;
  }

  seen.add(candidate);
  return candidate;
}
