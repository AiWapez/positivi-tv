import test from 'node:test';
import assert from 'node:assert/strict';
import { exactLowerBound, wilsonLowerBound, evaluateAutomation, recordPromise, proposePromiseMatches, POLICY_VERSION } from '../../src/goodsignal/index.ts';
import { story, context, NOW } from './fixtures.mjs';
function labels(n, overrides = {}) {
  return Array.from({ length: n }, (_, i) => ({ eventCluster: 'event-' + i, sourceId: 'source-0', topics: ['education'],
    researchStage: 'none', flags: [], policyVersion: POLICY_VERSION, modelVersion: 'fixture-model', action: 'approve', edited: false, at: NOW, ...overrides }));
}
const options = { now: NOW, sourceId: 'source-0', topic: 'education', modelVersion: 'fixture-model' };
test('exact bound does not confuse observed approval with population certainty', () => {
  assert(Math.abs(exactLowerBound(50, 50) - .05 ** (1 / 50)) < 1e-10);
  assert(Math.abs(exactLowerBound(49, 50) - .9086018692803026) < 1e-10);
});
test('Wilson interval matches boundary cases and rejects invalid counts', () => {
  const z2 = 1.959963984540054 ** 2;
  assert.equal(wilsonLowerBound(0, 100), 0);
  assert(Math.abs(wilsonLowerBound(100, 100) - 100 / (100 + z2)) < 1e-12);
  assert(wilsonLowerBound(50, 50) < .95);
  assert(wilsonLowerBound(148, 150) >= .95);
  assert(wilsonLowerBound(147, 150) < .95);
  for (const counts of [[1,0],[-1,10],[11,10],[.5,10],[1,Infinity]]) assert.throws(() => wilsonLowerBound(...counts));
});
test('fifty perfect samples do not meet v3.1 automation evidence requirements', () => {
  assert.equal(evaluateAutomation(labels(50), options).proposal, false);
});
test('a high observed approval rate still needs a sufficient Wilson lower bound', () => {
  const candidates = labels(100); candidates[0].action = 'reject'; candidates[1].action = 'reject';
  const result = evaluateAutomation(candidates, options);
  assert.equal(result.proposal, false); assert(result.lowerBound < .95);
});
test('sufficient clean samples produce a proposal, never permission to publish', () => {
  const result = evaluateAutomation(labels(120), options);
  assert.equal(result.proposal, true); assert.equal(result.reason, 'HUMAN_POLICY_APPROVAL_REQUIRED');
  assert.equal(Object.hasOwn(result, 'autoPublishEnabled'), false);
});
test('approval after edits is an unassisted failure', () => {
  const result = evaluateAutomation(labels(60, { edited: true }), options);
  assert.equal(result.successes, 0); assert.equal(result.proposal, false);
});
test('duplicate-event labels cannot inflate the sample size', () => {
  const result = evaluateAutomation(labels(100, { eventCluster: 'same-event' }), options);
  assert.equal(result.samples, 1); assert.equal(result.proposal, false);
});
test('sensitive secondary topics cannot hide inside an education class', () => {
  const result = evaluateAutomation(labels(120, { topics: ['education', 'health_medicine'] }), options);
  assert.equal(result.reason, 'CLASS_NOT_CLEAN');
});
test('model/policy versions and old or future labels do not mix', () => {
  for (const change of [{ modelVersion: 'old' }, { policyVersion: 'old' }, { at: '2025-01-01T00:00:00Z' }, { at: '2027-01-01T00:00:00Z' }])
    assert.equal(evaluateAutomation(labels(120, change), options).samples, 0);
});
test('plans are stored privately with traceable promised quantity and deadline', () => {
  const plan = story({ status: 'pending', review: undefined, stage: 'plan', frame: 'announcement_of_intent',
    body: 'The Library Project will welcome 40 pupils by 2027-01-01.',
    promise: { quantity: '40', quote: 'The Library Project will welcome 40 pupils by 2027-01-01.', deadline: { value: '2027-01-01', precision: 'day', basis: 'source', quote: '2027-01-01' } } });
  const entry = recordPromise(plan, context(), 'editor');
  const matches = proposePromiseMatches(story(), [entry], context());
  assert.equal(matches.length, 1); assert.equal(matches[0].requiresHumanConfirmation, true);
  assert.equal(Object.hasOwn(matches[0], 'promiseKept'), false);
});
test('invented plan quotation cannot enter the ledger', () => {
  assert.throws(() => recordPromise(story({ stage: 'plan', promise: { quantity: '1', quote: 'invented', deadline: { value: '2027', precision: 'year', basis: 'source', quote: '2027' } } }), context(), 'editor'));
});
