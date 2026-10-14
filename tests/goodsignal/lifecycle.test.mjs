import test from 'node:test';
import assert from 'node:assert/strict';
import { exactLowerBound, evaluateAutomation, recordPromise, proposePromiseMatches, POLICY_VERSION } from '../../src/goodsignal/index.ts';
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
test('fifty perfect samples do not meet a 97 percent lower-bound requirement', () => {
  assert.equal(evaluateAutomation(labels(50), options).proposal, false);
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
