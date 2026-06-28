export function normalizeText(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/ё/g, 'е');
}

export function splitTags(value: unknown): string[] {
  return normalizeText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
