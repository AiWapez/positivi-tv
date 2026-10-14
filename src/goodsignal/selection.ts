import { REGIONS } from './types.ts';
import type { Context, Profile, Selection, Story } from './types.ts';
import { displayEligible } from './qualification.ts';
import { assertNow, byDateId, canonicalUrl, clamp, dateBounds, DAY, instant } from './util.ts';

export function freshness(s: Story, now: string, halfLifeDays = 10): number {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) throw new TypeError('Invalid half life');
  const t = assertNow(now), bounds = dateBounds(s.eventDate);
  if (!bounds || bounds.start > t) return 0;
  return 2 ** (-(t - bounds.start) / DAY / halfLifeDays);
}
export function editorialScore(s: Story, now: string): number {
  return .4 * Math.max(s.impact, s.humanStory ? .5 : 0) + .4 * freshness(s, now) + .2 * s.evidence.level / 3;
}
export function similarity(a: Story, b: Story): number {
  return .5 * Number(a.topics[0] === b.topics[0])
    + .3 * Number(!!a.location?.country && a.location.country === b.location?.country)
    + .2 * Number(a.sourceId === b.sourceId);
}
export function regionKey(s: Story): string | null {
  if (!s.location) return null;
  return s.location.kind === 'global' ? 'global' : s.location.kind === 'unknown' ? null : REGIONS.includes(s.location.region!) ? s.location.region! : null;
}
function diversity(s: Story, chosen: Story[]): number {
  const region = regionKey(s);
  return .45 / (1 + chosen.filter(x => x.topics[0] === s.topics[0]).length)
    + .30 / (1 + chosen.filter(x => x.sourceId === s.sourceId).length)
    + (region ? .25 / (1 + chosen.filter(x => regionKey(x) === region).length) : .125);
}
function withinCaps(s: Story, chosen: Story[], caps: {source: number; topic: number; region: number}, relaxation: number): boolean {
  if (chosen.some(x => x.id === s.id || x.clusterId === s.clusterId || canonicalUrl(x.url) === canonicalUrl(s.url))) return false;
  if (relaxation < 3 && chosen.filter(x => x.sourceId === s.sourceId).length >= caps.source) return false;
  if (relaxation < 2 && chosen.filter(x => x.topics[0] === s.topics[0]).length >= caps.topic) return false;
  const region = regionKey(s);
  if (relaxation < 1 && region && region !== 'global' && chosen.filter(x => regionKey(x) === region).length >= caps.region) return false;
  return true;
}
function boundedSize(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 500) throw new TypeError('size must be an integer from 0 to 500'); return n;
}
function poolFor(stories: Story[], context: Context): Story[] {
  // Stable duplicate-ID handling: never let caller order choose among conflicting versions.
  const counts = new Map<string, number>();
  for (const s of stories) if (s && typeof s.id === 'string') counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
  return stories.filter(s => s && counts.get(s.id) === 1 && displayEligible(s, context));
}
function sortedBy(stories: Story[], score: (s: Story) => number): Story[] {
  return [...stories].sort((a, b) => score(b) - score(a) || byDateId(a, b));
}
export interface EditionOptions { size?: number; continentFloor?: number; humanShare?: number }
export function composeEdition(stories: Story[], context: Context, options: EditionOptions = {}): Selection {
  const size = boundedSize(options.size ?? 40), floor = options.continentFloor ?? 2, share = options.humanShare ?? .15;
  if (!Number.isInteger(floor) || floor < 0 || floor > 5 || !Number.isFinite(share) || share < 0 || share > 1) throw new TypeError('Invalid allocation');
  const pool = poolFor(stories, context), chosen: Story[] = [], reasons: Record<string, string[]> = Object.create(null), relaxations: string[] = [];
  const caps = { source: Math.max(1, Math.ceil(size * .15)), topic: Math.max(1, Math.ceil(size * .25)), region: size };
  const E = (s: Story) => editorialScore(s, context.now);
  const insert = (candidates: Story[], why: string, relaxation = 0): boolean => {
    if (chosen.length >= size) return false;
    const s = candidates.find(x => withinCaps(x, chosen, caps, relaxation));
    if (!s) return false;
    chosen.push(s); reasons[s.id] = [why]; return true;
  };
  // Every insertion passes the same ID/cluster/URL/cap checks.
  for (let round = 0; round < floor && chosen.length < size; round++)
    for (const region of REGIONS) insert(sortedBy(pool.filter(s => regionKey(s) === region), E), 'Regional coverage: ' + region);
  const humanGoal = Math.ceil(size * share);
  while (chosen.length < size && chosen.filter(s => s.humanStory).length < humanGoal)
    if (!insert(sortedBy(pool.filter(s => s.humanStory), E), 'Human-story allocation')) break;
  for (let relaxation = 0; relaxation <= 3 && chosen.length < size; relaxation++) {
    while (chosen.length < size) {
      const ordered = sortedBy(pool, s => .7 * E(s) - .3 * Math.max(0, ...chosen.map(x => similarity(s, x))));
      if (!insert(ordered, 'Editorial selection with variety', relaxation)) break;
    }
    if (chosen.length < size && relaxation < 3 && pool.some(s => withinCaps(s, chosen, caps, 3))) relaxations.push(['region', 'topic', 'source'][relaxation]);
  }
  const coverageGaps: string[] = REGIONS.filter(region => chosen.filter(s => regionKey(s) === region).length < floor);
  if (chosen.filter(s => s.humanStory).length < humanGoal) coverageGaps.push('human_story');
  // Allocation selects membership. Editorial rank determines the actual broadcast slate.
  return { stories: sortedBy(chosen, E), reasons, relaxations, coverageGaps };
}
function allowed(s: Story, p: Profile): boolean {
  return !p.hiddenIds?.includes(s.id) && !p.blockedSources?.includes(s.sourceId)
    && !s.topics.some(t => p.hiddenTopics?.includes(t))
    && (!p.onlyTopics?.length || s.topics.some(t => p.onlyTopics!.includes(t)));
}
export interface PersonalOptions { size?: number; replay?: boolean; chronological?: boolean }
export function selectPersonalFeed(stories: Story[], context: Context, profile: Profile = {}, options: PersonalOptions = {}): Selection {
  const size = boundedSize(options.size ?? 30), now = assertNow(context.now);
  const pool = poolFor(stories, context).filter(s => allowed(s, profile));
  const seen = (s: Story) => Object.prototype.hasOwnProperty.call(profile.seenClusters ?? {}, s.clusterId);
  const chosen: Story[] = [], reasons: Record<string, string[]> = Object.create(null), relaxations: string[] = [];
  const caps = { source: 2, topic: 3, region: 3 };
  const hasPreferences = Object.values(profile.affinity ?? {}).some(a => a !== .5 && a !== undefined);
  const affinity = (s: Story) => s.topics.reduce((sum, t) => sum + clamp(Number.isFinite(profile.affinity?.[t]) ? profile.affinity![t]! : .5), 0) / s.topics.length;
  for (let relaxation = 0; relaxation <= 3 && chosen.length < size; relaxation++) {
    while (chosen.length < size) {
      const available = pool.filter(s => withinCaps(s, chosen.slice(-9), caps, relaxation)
        && !chosen.some(x => x.id === s.id || x.clusterId === s.clusterId || canonicalUrl(x.url) === canonicalUrl(s.url)));
      const unseen = available.filter(s => !seen(s));
      // Unseen-first is a candidate partition, not a score bonus. Finish all relaxations before replay.
      const candidates = unseen.length ? unseen : options.replay && relaxation === 3 ? available : [];
      if (!candidates.length) break;
      const discovery = profile.discovery === true && (chosen.length + 1) % 5 === 0;
      const discover = candidates.filter(s => !seen(s) && !s.topics.some(t => profile.affinity?.[t] === 1));
      let ordered: Story[], why: string;
      if (discovery && discover.length) { ordered = sortedBy(discover, s => editorialScore(s, context.now)); why = 'Discovery within your selected topics'; }
      else if (options.chronological) { ordered = [...candidates].sort(byDateId); why = 'Chronological view'; }
      else if (!hasPreferences && !options.replay) { ordered = candidates; why = 'Shared edition order'; }
      else {
        ordered = sortedBy(candidates, s => {
          const prior = instant(profile.seenClusters?.[s.clusterId]);
          const replayFactor = !seen(s) ? 1 : prior === null ? 0 : clamp((now - prior) / DAY / 7) * .6;
          return .8 * (.45 * affinity(s) + .55 * editorialScore(s, context.now)) * replayFactor + .2 * diversity(s, chosen);
        });
        why = 'Your explicit preferences and variety';
      }
      const next = ordered[0]; if (!next) break;
      chosen.push(next); reasons[next.id] = [why, seen(next) ? 'Replay' : 'Unseen event'];
    }
    if (chosen.length < size && relaxation < 3 && pool.some(s => !chosen.some(x => x.clusterId === s.clusterId))) relaxations.push(['region', 'topic', 'source'][relaxation]);
  }
  return { stories: chosen, reasons, relaxations, coverageGaps: [] };
}
