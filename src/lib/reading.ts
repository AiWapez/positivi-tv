import type { Story } from '../types';

/**
 * Device-local reading state. Nothing here is sent to a server.
 * - A story counts as "new this week" for 7 days after PositiviTV first collected it.
 * - Opening a story marks it read. Its pin dims right away and leaves the globe once a newer daily
 *   update has arrived, so pins a reader has not opened keep waiting for them.
 */
export const RECENT_DAYS = 7;
const DAY = 86400000;
const KEEP_DAYS = 120, MAX_ENTRIES = 2000;
/** Story id -> ISO time it was first opened on this device. */
export type ReadMap = Record<string, string>;

export function parseReadMap(value: string | null, now = Date.now()): ReadMap {
  let data: unknown;
  try { data = JSON.parse(value || '{}'); } catch { return {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const entries = Object.entries(data as Record<string, unknown>)
    .filter((e): e is [string, string] => typeof e[0] === 'string' && !!e[0] && e[0].length <= 200 && typeof e[1] === 'string')
    .filter(([, at]) => { const t = Date.parse(at); return Number.isFinite(t) && t <= now + DAY && now - t <= KEEP_DAYS * DAY; })
    .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).slice(0, MAX_ENTRIES);
  return Object.fromEntries(entries);
}

export function isRecent(story: Pick<Story, 'fetchedAt'>, now: number, days = RECENT_DAYS): boolean {
  const t = Date.parse(story.fetchedAt);
  return Number.isFinite(t) && now - t <= days * DAY;
}

/** Time of the newest data the reader has: the stored daily snapshot or the reviewed edition. */
export function feedUpdatedAt(feed: { updatedAt: string | null; publisherFeed?: { generatedAt: string | null } }): number | null {
  const times = [feed.publisherFeed?.generatedAt, feed.updatedAt].map(v => (v ? Date.parse(v) : NaN)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

/** A read story leaves the globe only after an update newer than the moment it was read. */
export function retiredFromGlobe(story: Pick<Story, 'id'>, read: ReadMap, updatedAt: number | null): boolean {
  const at = read[story.id];
  return !!at && updatedAt !== null && updatedAt > Date.parse(at);
}

/** Pins to draw. The currently selected story always keeps its pin. */
export function globeStories<T extends Pick<Story, 'id'>>(stories: T[], read: ReadMap, updatedAt: number | null, selectedId: string | null): T[] {
  return stories.filter(s => s.id === selectedId || !retiredFromGlobe(s, read, updatedAt));
}

/** Unread first, each group keeping its original order. */
export function unreadFirst<T extends Pick<Story, 'id'>>(stories: T[], read: ReadMap): T[] {
  return [...stories.filter(s => !read[s.id]), ...stories.filter(s => read[s.id])];
}
