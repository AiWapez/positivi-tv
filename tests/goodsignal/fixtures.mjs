import { POLICY_VERSION } from '../../src/goodsignal/index.ts';
export const NOW = '2026-10-14T07:30:00Z';
export const CHECKS = { claim: true, date: true, evidence: true, rights: true, context: true, safety: true };
export function source(id = 'source-0') {
  return { id, domains: [id + '.example.org'], enabled: true, tier: 2, type: 'outlet',
    permissions: { title: true, summary: true, policyRef: 'SYNTHETIC-TEST-PERMISSIONS', retentionDays: 90 } };
}
export function context(overrides = {}) {
  return { now: NOW, sources: Object.fromEntries(Array.from({ length: 60 }, (_, n) => { const p = source('source-' + n); return [p.id, p]; })), ...overrides };
}
/** Invented fixtures for tests only. They are not reporting or editorial approvals. */
export function story(overrides = {}) {
  const id = overrides.id ?? 'story-0', sourceId = overrides.sourceId ?? 'source-0';
  return {
    id, version: 1, clusterId: overrides.clusterId ?? id + '-event', sourceId,
    url: 'https://' + sourceId + '.example.org/articles/' + id,
    title: 'Synthetic library opening', summary: 'A fictional library opened for this test.',
    body: 'On 2026-10-13, the library opened in Accra. The library welcomed 40 pupils. The project began in 2019.',
    publishedAt: '2026-10-13T12:00:00Z', firstRetrievedAt: '2026-10-13T13:00:00Z',
    topics: ['education'], stage: 'completed', frame: 'reports_outcome', researchStage: 'none',
    eventDate: { value: '2026-10-13', precision: 'day', basis: 'source', quote: 'On 2026-10-13' },
    outcomeQuote: 'On 2026-10-13, the library opened in Accra.',
    quantities: [{ value: '40', subject: 'pupils', quote: 'The library welcomed 40 pupils.' }],
    evidence: { level: 1, checkedBy: 'synthetic-editor', links: [], note: 'Invented fixture, not evidence.' },
    location: { kind: 'city', region: 'africa', country: 'GH', points: [{ name: 'Accra', lat: 5.56, lng: -.2, precisionKm: 20 }] },
    entities: ['Library Project', 'Accra'], humanStory: false, impact: .4, status: 'approved',
    review: { actor: 'synthetic-editor', at: NOW, storyVersion: 1, policyVersion: POLICY_VERSION, action: 'approve', edited: false, checks: { ...CHECKS }, note: 'Synthetic test approval only.' },
    ...overrides,
  };
}
export function pool(n = 40) {
  const regions = ['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania'];
  const topics = ['education', 'science_space', 'animals_nature', 'community_kindness', 'arts_culture', 'technology'];
  return Array.from({ length: n }, (_, i) => story({ id: 'story-' + i, sourceId: 'source-' + i % 20,
    topics: [topics[i % topics.length]], impact: .2 + i % 7 / 10, humanStory: i % 4 === 0,
    location: { kind: 'country', region: regions[i % regions.length], country: 'C' + i % 15,
      points: [{ name: 'Synthetic location ' + i, lat: i % 120 - 60, lng: i * 43 % 360 - 180, precisionKm: 500 }] } }));
}
