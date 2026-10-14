import type { Context, StatusManifest, Story } from './types.ts';
import { displayEligible } from './qualification.ts';
import { angularDistance, assertNow, cameraPoint, clamp, instant } from './util.ts';

export interface Segment {
  storyId: string; storyVersion: number; clusterId: string;
  startsAt: string; endsAt: string; cycle: number; view: 'located' | 'pulled_back';
  durationSeconds: number;
}
const uplift = (s: Story) => s.humanStory || s.topics.some(t => ['community_kindness', 'animals_nature', 'sports_achievement', 'arts_culture'].includes(t));
export function cardDuration(s: Story): number {
  const words = (s.summary || s.title).trim().split(/\s+/).filter(Boolean).length;
  return Math.round(clamp(8 + words / 3, 20, 45) * (s.location?.kind === 'multi' ? 1.25 : 1));
}
/** One bounded tour. Location never removes a story or gives it an invented pin. */
export function buildTour(slate: Story[], context: Context): Story[] {
  const used = new Set<string>(), ids = new Set<string>();
  const pool = slate.filter(s => {
    if (!displayEligible(s, context) || used.has(s.clusterId) || ids.has(s.id)) return false;
    used.add(s.clusterId); ids.add(s.id); return true;
  });
  const result: Story[] = [], waits = new Map<string, number>();
  const remaining = [...pool];
  const startTime = new Date(assertNow(context.now));
  const hour = startTime.getUTCHours() + startTime.getUTCMinutes() / 60;
  const morningLng = ((7 - hour) * 15 + 540) % 360 - 180;
  while (remaining.length) {
    const window = remaining.slice(0, 3);
    const forced = window.find(s => (waits.get(s.id) ?? 0) >= 2);
    let next: Story;
    if (forced) next = forced;
    else {
      const prev = result[result.length - 1], a = prev ? cameraPoint(prev) : null;
      const score = (s: Story) => {
        const b = cameraPoint(s), rank = pool.indexOf(s), R = 1 - rank / Math.max(1, pool.length);
        if (!prev) {
          const distance = b ? Math.abs(((b.lng - morningLng + 540) % 360) - 180) : 90;
          return .8 * R + .2 * (1 - distance / 180);
        }
        const C = a && b ? 1 - angularDistance(a, b) / 180 : .5;
        const west = a && b ? Number(((a.lng - b.lng + 360) % 360) <= 180) : .5;
        return .8 * R + .12 * C + .08 * west;
      };
      const pacing = result.length >= 2 && result.slice(-2).every(s => !uplift(s));
      const candidates = pacing && window.some(uplift) ? window.filter(uplift) : window;
      next = [...candidates].sort((a, b) => score(b) - score(a) || pool.indexOf(a) - pool.indexOf(b))[0];
    }
    for (const s of window) if (s.id !== next.id) waits.set(s.id, (waits.get(s.id) ?? 0) + 1);
    result.push(next); remaining.splice(remaining.indexOf(next), 1);
  }
  return result;
}
/** Offline schedule snapshot; host must recheck status before each actual display. */
export function scheduleChannel(slate: Story[], context: Context, options: { hours?: number; continuous?: boolean } = {}): Segment[] {
  const hours = options.hours ?? 24;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 48) throw new TypeError('Invalid channel horizon');
  const start = assertNow(context.now), until = start + hours * 3_600_000;
  const result: Segment[] = []; let cursor = start, cycle = 0;
  do {
    const tour = buildTour(slate, { ...context, now: new Date(cursor).toISOString() });
    if (!tour.length) break;
    for (const story of tour) {
      if (cursor >= until) break;
      // Travel is included in the total slot; text gets the full dwell period.
      const durationSeconds = cardDuration(story) + (cameraPoint(story) ? 2 : 0);
      result.push({ storyId: story.id, storyVersion: story.version, clusterId: story.clusterId,
        startsAt: new Date(cursor).toISOString(), endsAt: new Date(cursor + durationSeconds * 1000).toISOString(),
        cycle, view: cameraPoint(story) ? 'located' : 'pulled_back', durationSeconds });
      cursor += durationSeconds * 1000;
    }
    cycle++;
  } while (options.continuous === true && cursor < until);
  return result;
}
export function currentSegment(schedule: Segment[], now: string): Segment | null {
  const n = assertNow(now);
  return schedule.find(s => instant(s.startsAt)! <= n && n < instant(s.endsAt)!) ?? null;
}
export function makeManifest(stories: Story[], context: Context, version: string): StatusManifest {
  assertNow(context.now);
  if (!version.trim()) throw new TypeError('Manifest version required');
  const entries: StatusManifest['stories'] = Object.create(null);
  for (const s of stories) {
    if (Object.prototype.hasOwnProperty.call(entries, s.id)) throw new Error('Duplicate manifest id');
    entries[s.id] = { version: s.version, status: context.withdrawnIds?.includes(s.id) ? 'withdrawn' : s.status };
  }
  return { version, generatedAt: context.now, stories: entries };
}
export function checkBeforeDisplay(segment: Pick<Segment, 'storyId' | 'storyVersion'>, manifest: StatusManifest | null, now: string, maxAgeMs = 30_000): { allowed: boolean; reason: string } {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError('Invalid status budget');
  const t = assertNow(now), generated = instant(manifest?.generatedAt);
  if (!manifest || generated === null || generated > t || t - generated > maxAgeMs) return { allowed: false, reason: 'STATUS_UNAVAILABLE_OR_STALE' };
  const status = manifest.stories?.[segment.storyId];
  if (!status || !['approved', 'archived'].includes(status.status)) return { allowed: false, reason: 'NOT_CURRENTLY_APPROVED' };
  if (status.version !== segment.storyVersion) return { allowed: false, reason: 'VERSION_CHANGED' };
  return { allowed: true, reason: 'CURRENT_AT_MANIFEST_TIME' };
}
export function tickerStories(slate: Story[], schedule: Segment[], context: Context): Story[] {
  const current = currentSegment(schedule, context.now), index = current ? schedule.indexOf(current) : -1;
  const excluded = new Set([current?.clusterId, index >= 0 ? schedule[index + 1]?.clusterId : undefined]);
  const seen = new Set<string>();
  return slate.filter(s => {
    if (!displayEligible(s, context) || excluded.has(s.clusterId) || seen.has(s.clusterId)) return false;
    seen.add(s.clusterId); return true;
  });
}
