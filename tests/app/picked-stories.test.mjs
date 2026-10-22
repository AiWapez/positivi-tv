import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSnapshot } from '../../server/publisher-snapshot.ts';
import { screenHeadline } from '../../server/publisher-screen.ts';
import { projectPublisherFeed, PICK_OVERRIDABLE_REASONS, PUBLISHER_FEED_POLICY, validPick, pickFor } from '../../src/lib/publisher-feed.ts';
import { provenanceLabel, qualifierLabels, PICKED_EXPLANATION } from '../../src/lib/story-utils.ts';
import { REMOTE_KEYS } from '../../server/remote-control.ts';
import { NOW, sources, control, candidate, permission } from './publisher-fixtures.mjs';

const HEX = n => (n.toString(16) + '0123456789abcdef01234567').slice(0, 24).padStart(24, '0');
const id = n => 'alpha-' + HEX(n);
const pick = (n, extra = {}) => ({ id: id(n), approvedAt: '2026-10-23', approvedBy: 'Alex', ...extra });
const SOFT_NO_OUTCOME = 'Rangers watch nesting turtles on the coast';
const SOFT_PLAN = 'Wetland group plans new reserve in Kenya';
const LISTED = 'Volunteers restore wetland in Kenya';
const run = (cands, ctl = {}, srcs = sources()) => {
  const records = [];
  const snapshot = buildSnapshot(null, [{ sourceId: 'alpha', ok: true, candidates: cands }, { sourceId: 'beta', ok: true, candidates: [] }], srcs, control(ctl), NOW, undefined, r => records.push(r));
  return { snapshot, records };
};
const cand = (n, title, overrides = {}) => candidate('alpha', 'story' + n, title, { id: id(n), ...overrides });

test('the policy version moved to 0.5.0 and the pick list starts empty', async () => {
  assert.equal(PUBLISHER_FEED_POLICY, 'publisher-feed-0.5.0');
  const live = JSON.parse(await readFile(new URL('../../config/publisher-feed.json', import.meta.url), 'utf8'));
  assert.deepEqual(live.pickedStories, [], 'no story is picked until Alex re-confirms it with its description');
});

test('a pick lists a story the rules held back only for a mild reason, with its approval kept on the list', () => {
  for (const [n, title] of [[1, SOFT_NO_OUTCOME], [2, SOFT_PLAN]]) {
    const reasons = screenHeadline({ title, description: 'A short synthetic description of the story.', defaultCategory: 'Planet', now: NOW }).reasons;
    assert(reasons.length > 0 && reasons.every(r => PICK_OVERRIDABLE_REASONS.includes(r)), `${title} is held back only for a mild reason`);
    assert.equal(run([cand(n, title)]).snapshot.items.length, 0, 'without a pick it stays out');
    const { snapshot, records } = run([cand(n, title)], { pickedStories: [pick(n)] });
    assert.equal(snapshot.items.length, 1); assert.equal(snapshot.items[0].picked, true);
    assert(snapshot.items[0].labels.includes('event_date_unconfirmed'));
    assert.equal(records[0].decision, 'exclude', 'the rules\' own decision is still recorded for the teaching batch');
  }
  assert.equal(PICK_OVERRIDABLE_REASONS.length, 2);
});

test('a hard-ban reason can never be overridden by a pick', () => {
  const hard = ['Three killed in bus crash', 'Mayor says council backs new park', 'Conservation group celebrates reef recovery after trawl ban',
    'Rangers meet to discuss turtle nesting and a lawsuit', 'Oil company pledges new wetland funds'];
  hard.forEach((title, i) => {
    const n = 10 + i;
    const reasons = screenHeadline({ title, description: 'A short synthetic description of the story.', defaultCategory: 'Planet', now: NOW }).reasons;
    assert(reasons.some(r => !PICK_OVERRIDABLE_REASONS.includes(r)), `${title} has a hard reason`);
    const { snapshot } = run([cand(n, title)], { pickedStories: [pick(n)] });
    assert.equal(snapshot.items.length, 0, `${title} stays out even when picked`);
  });
});

test('every reason code the rules can produce, other than the two mild ones, is a hard ban', async () => {
  const source = await readFile(new URL('../../server/publisher-screen.ts', import.meta.url), 'utf8');
  const codes = [...new Set([...source.matchAll(/reasons\.push\('([A-Z_]+)'\)/g)].map(m => m[1]))];
  assert(codes.length >= 20, 'found the reason codes');
  assert.deepEqual(PICK_OVERRIDABLE_REASONS, ['NO_COMPLETED_OUTCOME', 'PLAN_OR_UNCERTAIN']);
  for (const code of codes) if (!PICK_OVERRIDABLE_REASONS.includes(code)) assert(!PICK_OVERRIDABLE_REASONS.includes(code), code);
  for (const hardCode of ['HARM_EVENT', 'ENFORCEMENT_OR_LEGAL', 'CONFLICT_OR_CRISIS', 'OPINION_OR_DISPUTE', 'GOVERNANCE_NEVER_AUTOMATED', 'EXTRACTIVE_INDUSTRY',
    'HEALTH_NEVER_AUTOMATED', 'HYPE', 'PROMOTIONAL', 'RETROSPECTIVE', 'ALARM_FRAMING', 'DISTRESS_OR_TREND_RECORD', 'QUESTION_ADVICE_OR_EXPLAINER',
    'OLD_YEAR_IN_HEADLINE', 'OLD_EVENT_YEAR_IN_DESCRIPTION', 'DETERIORATING_OUTCOME', 'NEGATIVE_WITHOUT_RECOVERY', 'UNRESOLVED_OUTCOME', 'IN_PROGRESS_NOT_OUTCOME', 'EMPTY_TITLE'])
    assert(codes.includes(hardCode) && !PICK_OVERRIDABLE_REASONS.includes(hardCode), hardCode);
});

test('a pick never overrides the earlier checks: blocked credit, restrictive rights, missing author, window and link', () => {
  const srcs = sources({ alpha: { ...sources().alpha, publisherFeed: permission({ blockedCredits: ['Wire Co'], requiresAuthor: true, license: { name: 'CC BY 4.0', url: 'https://alpha.example.org/license' } }) } });
  const ctl = { pickedStories: [pick(21), pick(22), pick(23), pick(24)] };
  const items = run([
    cand(21, SOFT_NO_OUTCOME, { author: 'Wire Co' }), cand(22, SOFT_NO_OUTCOME, { author: 'A. Writer', rights: 'All rights reserved' }),
    cand(23, SOFT_NO_OUTCOME, { author: null }), cand(24, SOFT_NO_OUTCOME, { author: 'A. Writer', publishedAt: new Date(Date.parse(NOW) - 40 * 86400000).toISOString() }),
  ], ctl, srcs).snapshot.items;
  assert.equal(items.length, 0);
});

test('a bad or incomplete pick entry lists nothing', () => {
  const bad = [{ id: id(30) }, { id: id(30), approvedAt: '2026-10-23' }, { id: id(30), approvedAt: 'soon', approvedBy: 'Alex' }, { id: id(30), approvedAt: '2026-10-23', approvedBy: '  ' },
    { id: 'alpha-short', approvedAt: '2026-10-23', approvedBy: 'Alex' }, 'alpha', null, 7];
  for (const entry of bad) assert.equal(validPick(entry), false, JSON.stringify(entry));
  assert.equal(run([cand(30, SOFT_PLAN)], { pickedStories: bad }).snapshot.items.length, 0);
  assert.equal(pickFor({ pickedStories: 'x' }, id(30)), undefined);
  assert.equal(validPick(pick(30)), true);
});

test('projection: removing a pick, a withdrawal or turning the lane off takes the story off at once', () => {
  const { snapshot } = run([cand(40, SOFT_PLAN), cand(41, LISTED)], { pickedStories: [pick(40)] });
  const project = ctl => projectPublisherFeed(snapshot, control(ctl), sources(), NOW);
  assert.equal(project({ pickedStories: [pick(40)] }).stories.length, 2);
  assert.equal(project({}).stories.length, 1, 'pick removed: only the automatic story stays');
  assert.equal(project({ pickedStories: [pick(40, { approvedBy: '' })] }).stories.length, 1, 'a bad entry does not keep it');
  const withdrawn = project({ pickedStories: [pick(40)], withdrawn: [{ id: id(40), reason: 'removal request', at: NOW }] });
  assert.equal(withdrawn.stories.length, 1); assert.equal(withdrawn.statuses[id(40)].status, 'withdrawn');
  assert.equal(project({ pickedStories: [pick(40)], enabled: false }).stories.length, 0);
  assert.equal(projectPublisherFeed(snapshot, control({ pickedStories: [pick(40)] }), sources({ alpha: { ...sources().alpha, enabled: false } }), NOW).stories.length, 0);
});

test('a picked card is labelled "Picked by PositiviTV · From publisher feeds", never "Reviewed", and explains itself', () => {
  const { snapshot } = run([cand(50, SOFT_PLAN), cand(51, LISTED)], { pickedStories: [pick(50)] });
  const cards = projectPublisherFeed(snapshot, control({ pickedStories: [pick(50)] }), sources(), NOW).stories;
  const picked = cards.find(c => c.id === id(50)), automatic = cards.find(c => c.id === id(51));
  assert.equal(picked.picked, true); assert.equal(provenanceLabel(picked), 'Picked by PositiviTV · From publisher feeds');
  assert(!provenanceLabel(picked).includes('Reviewed'));
  assert.equal(PICKED_EXPLANATION, "A person at PositiviTV chose this story from a publisher feed. It isn't fact-checked, and its event date isn't confirmed.");
  assert(qualifierLabels(picked).includes(PICKED_EXPLANATION));
  assert.equal(automatic.picked, undefined); assert.equal(provenanceLabel(automatic), 'From publisher feeds');
  assert(!qualifierLabels(automatic).includes(PICKED_EXPLANATION));
  assert.equal(provenanceLabel({ ...picked, provenance: 'reviewed' }), 'Reviewed by PositiviTV™');
  assert.equal(picked.provenance, 'publisher_feed');
});

test('the remote switch can only pause or withdraw: it cannot add a pick', () => {
  assert.deepEqual([...REMOTE_KEYS], ['publisherLaneOff', 'withdrawnStories']);
});

test('the About and Terms wording matches the General Counsel text', async () => {
  const app = await readFile(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  const terms = await readFile(new URL('../../src/components/ReaderInfo.tsx', import.meta.url), 'utf8');
  const sentence = "Picked by PositiviTV stories also come from publisher feeds, but a person at PositiviTV chose each one individually. They aren't fact-checked, and their event dates aren't confirmed.";
  assert(app.includes('Three clearly labelled kinds of story') && !app.includes('Two clearly labelled kinds of story'));
  assert(app.includes(sentence.replace('Picked by PositiviTV stories', '<b>Picked by PositiviTV</b> stories')));
  assert(terms.includes('the selection rules can make mistakes. ' + sentence));
});
