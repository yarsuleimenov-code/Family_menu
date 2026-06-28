const RU_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function toIsoDate(date: Date): string {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export function coerceIsoDate(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const isoMatch = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  return text;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function getDateRange(dateFrom: string, dateTo: string): string[] {
  const result: string[] = [];
  let cursor = dateFrom;
  while (cursor <= dateTo) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

export function formatRuDate(isoDate: string): string {
  const normalized = coerceIsoDate(isoDate);
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return normalized || 'дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
}

export function dayLabel(isoDate: string): string {
  const date = new Date(`${coerceIsoDate(isoDate)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return RU_WEEKDAYS[date.getDay()];
}
