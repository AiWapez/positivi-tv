import type { EventDate, Location, Story } from './types.ts';

export const DAY = 86_400_000;
export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export function instant(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const n = Date.parse(value);
  const date = value.slice(0, 10);
  if (!Number.isFinite(n) || !validDay(date)) return null;
  return n;
}
function validDay(value: string): boolean {
  const n = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
}
/** Preserve uncertain dates as closed UTC intervals; never resolve 'today' by guesswork. */
export function dateBounds(date: EventDate | null | undefined): { start: number; end: number } | null {
  if (!date || typeof date.value !== 'string') return null;
  let start: string, next: number;
  if (date.precision === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(date.value) && validDay(date.value)) {
    start = date.value; next = Date.parse(start + 'T00:00:00Z') + DAY;
  } else if (date.precision === 'month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(date.value)) {
    start = date.value + '-01';
    next = Date.parse(start + 'T00:00:00Z');
    const d = new Date(next); d.setUTCMonth(d.getUTCMonth() + 1); next = d.getTime();
  } else if (date.precision === 'year' && /^\d{4}$/.test(date.value)) {
    start = date.value + '-01-01'; next = Date.parse(String(Number(date.value) + 1).padStart(4, '0') + '-01-01T00:00:00Z');
  } else return null;
  const n = Date.parse(start + 'T00:00:00Z');
  return Number.isFinite(n) && Number.isFinite(next) ? { start: n, end: next - 1 } : null;
}
export function normalizeText(s: string): string {
  return s.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}
export function hasSpan(body: string, quote: unknown): boolean {
  return typeof quote === 'string' && quote.trim().length > 0 && normalizeText(body).includes(normalizeText(quote));
}
export { canonicalUrl } from './url.mjs';
export function validLocation(l: Location): boolean {
  if (!l || !['point', 'city', 'country', 'region', 'multi', 'global', 'unknown'].includes(l.kind) || !Array.isArray(l.points)) return false;
  if (l.kind === 'global' || l.kind === 'unknown') return l.points.length === 0;
  return l.points.length > 0 && l.points.every(p => typeof p.name === 'string' && p.name.trim().length > 0
    && Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90 && Number.isFinite(p.lng) && p.lng >= -180 && p.lng <= 180
    && Number.isFinite(p.precisionKm) && p.precisionKm >= 0);
}
export function cameraPoint(s: Story): { lat: number; lng: number } | null {
  if (!validLocation(s.location) || ['global', 'unknown'].includes(s.location.kind)) return null;
  return s.location.points[0];
}
export function angularDistance(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  const rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(clamp(x))) / rad;
}
export function byDateId(a: Story, b: Story): number {
  return (dateBounds(b.eventDate)?.start ?? -Infinity) - (dateBounds(a.eventDate)?.start ?? -Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function assertNow(now: string): number {
  const n = instant(now); if (n === null) throw new TypeError('now must be a valid ISO timestamp with timezone'); return n;
}
