import { POLICY_VERSION, TOPICS } from './types.ts';
import type { Assessment, Context, HumanReview, ReviewChecks, SourcePolicy, Story } from './types.ts';
import { assertNow, canonicalUrl, dateBounds, DAY, hasSpan, instant, validLocation } from './util.ts';

const STAGES = ['completed', 'milestone', 'progress', 'plan', 'research', 'none'];
const FRAMES = ['reports_outcome', 'analysis_or_critique', 'announcement_of_intent', 'profile_feature', 'promotional', 'other'];
const RESEARCH = ['none', 'preprint', 'animal', 'lab', 'early_human', 'trial_phase_2plus', 'approved'];
export function validateStory(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['INVALID_RECORD'];
  const s = value as Story; const r: string[] = [];
  for (const k of ['id', 'clusterId', 'sourceId', 'url', 'title', 'publishedAt', 'firstRetrievedAt'] as const)
    if (typeof s[k] !== 'string' || !s[k].trim()) r.push('INVALID_' + k.toUpperCase());
  if (!Number.isInteger(s.version) || s.version < 1) r.push('INVALID_VERSION');
  if (typeof s.body !== 'string' || !(s.summary === null || typeof s.summary === 'string')) r.push('INVALID_CONTENT');
  if (!Array.isArray(s.topics) || !s.topics.length || s.topics.some(t => !TOPICS.includes(t)) || new Set(s.topics).size !== s.topics.length) r.push('INVALID_TOPICS');
  if (!STAGES.includes(s.stage) || !FRAMES.includes(s.frame) || !RESEARCH.includes(s.researchStage)) r.push('INVALID_CLASSIFICATION');
  if (!Array.isArray(s.quantities) || s.quantities.some(q => !q || typeof q.value !== 'string' || typeof q.subject !== 'string' || typeof q.quote !== 'string')) r.push('INVALID_QUANTITIES');
  if (!s.evidence || ![0, 1, 2, 3].includes(s.evidence.level) || !Array.isArray(s.evidence.links) || s.evidence.links.some(x => typeof x !== 'string') || typeof s.evidence.note !== 'string' || !(s.evidence.checkedBy === null || typeof s.evidence.checkedBy === 'string')) r.push('INVALID_EVIDENCE');
  if (!Array.isArray(s.entities) || s.entities.some(x => typeof x !== 'string')) r.push('INVALID_ENTITIES');
  if (typeof s.humanStory !== 'boolean' || !Number.isFinite(s.impact) || s.impact < 0 || s.impact > 1) r.push('INVALID_EDITORIAL_FEATURES');
  if (!['pending', 'approved', 'archived', 'rejected', 'withdrawn'].includes(s.status)) r.push('INVALID_STATUS');
  if (!(s.outcomeQuote === null || typeof s.outcomeQuote === 'string')) r.push('INVALID_OUTCOME_QUOTE');
  return r;
}
function sourceReasons(s: Story, p?: SourcePolicy): { hard: string[]; review: string[] } {
  const hard: string[] = [], review: string[] = [];
  const canonical = canonicalUrl(s.url);
  if (!canonical) hard.push('UNSAFE_URL');
  if (!p || p.id !== s.sourceId) review.push('SOURCE_UNKNOWN');
  else {
    if (!p.enabled) hard.push('SOURCE_BLOCKED');
    if (p.type === 'press_wire') hard.push('PROMO_WIRE');
    if (canonical && !p.domains.some(d => d.toLowerCase() === new URL(canonical).hostname.toLowerCase())) review.push('SOURCE_DOMAIN_MISMATCH');
    if (!p.permissions?.title || !p.permissions?.policyRef?.trim() || !Number.isFinite(p.permissions.retentionDays) || p.permissions.retentionDays <= 0) review.push('RIGHTS_UNCONFIRMED');
    if (s.summary && !p.permissions?.summary) review.push('SUMMARY_NOT_PERMITTED');
  }
  if (canonical) {
    const u = new URL(canonical);
    if (u.pathname === '/' && !u.search) review.push('ARTICLE_LINK_REQUIRED');
  }
  return { hard, review };
}
/** All findings are collected. Quote existence is not a semantic-support or truth verdict. */
export function assessCandidate(s: Story, context: Context): Assessment {
  const now = assertNow(context.now); const invalid = validateStory(s);
  if (invalid.length) return { recommendation: 'needs_attention', reasons: invalid, observations: [], policyVersion: POLICY_VERSION };
  const { hard, review: reasons } = sourceReasons(s, context.sources[s.sourceId]);
  const observations: string[] = [];
  const published = instant(s.publishedAt), retrieved = instant(s.firstRetrievedAt);
  if (published === null || retrieved === null) reasons.push('INVALID_TIMESTAMP');
  if ((published !== null && published > now) || (retrieved !== null && retrieved > now)) reasons.push('FUTURE_TIMESTAMP');
  if (!s.body.trim()) reasons.push('INSUFFICIENT_TEXT');
  if (!s.outcomeQuote || !hasSpan(s.body, s.outcomeQuote)) reasons.push('OUTCOME_SPAN_MISSING');
  for (const q of s.quantities) if (!q.value.trim() || !q.subject.trim() || !hasSpan(s.body, q.quote) || !hasSpan(q.quote, q.value)) reasons.push('QUANTITY_SPAN_MISSING');
  const bounds = dateBounds(s.eventDate);
  if (!bounds) reasons.push('DATE_UNKNOWN');
  else {
    if (!['source', 'reviewer'].includes(s.eventDate!.basis)) reasons.push('DATE_BASIS_UNKNOWN');
    if (s.eventDate!.basis === 'source' && !hasSpan(s.body, s.eventDate!.quote)) reasons.push('DATE_SPAN_MISSING');
    if (bounds.start > now) reasons.push('FUTURE_OUTCOME');
    if (bounds.start <= now && now - bounds.start > (context.recentDays ?? 30) * DAY) observations.push('ARCHIVE_EVENT');
    if (published !== null && bounds.start > published + DAY) reasons.push('DATE_AFTER_PUBLICATION');
  }
  if (s.originDate && (!dateBounds(s.originDate) || (s.originDate.basis === 'source' && !hasSpan(s.body, s.originDate.quote)))) reasons.push('ORIGIN_DATE_UNSUPPORTED');
  if (s.stage === 'plan' || s.frame === 'announcement_of_intent') reasons.push('PLAN_ONLY');
  if (s.stage === 'none') reasons.push('NO_CONSTRUCTIVE_OUTCOME');
  if (['promotional', 'analysis_or_critique', 'other'].includes(s.frame)) reasons.push('FRAME_REVIEW');
  if (!s.evidence.checkedBy?.trim() || s.evidence.level === 0 || !s.evidence.note.trim()) reasons.push('CLAIM_EVIDENCE_REVIEW');
  if (s.evidence.links.some(link => canonicalUrl(link) === null)) reasons.push('UNSAFE_EVIDENCE_LINK');
  if (s.topics.some(t => t === 'health_medicine' || t === 'governance_rights') || s.researchStage !== 'none') observations.push('SENSITIVE_REVIEW');
  if (/\b(cure[sd]?|miracle|breakthrough|revolutionary|game.changer)\b/i.test(s.title)) observations.push('HYPE_REVIEW');
  if (/\b(bust|busted|arrest|arrested|racket|raid|seized)\b/i.test(s.title)) observations.push('FRAME_AMBIGUOUS');
  if (/ignore\s+(?:all\s+|previous\s+)?instructions|system prompt|<\/?(?:system|assistant)>/i.test(s.body)) reasons.push('INJECTION_SUSPECT');
  if (!validLocation(s.location)) observations.push('LOCATION_INVALID');
  else if (s.location.kind === 'unknown') observations.push('LOCATION_UNCERTAIN');
  return { recommendation: hard.length ? 'reject' : reasons.length ? 'needs_attention' : 'ready_for_review',
    reasons: [...new Set([...hard, ...reasons])], observations: [...new Set(observations)], policyVersion: POLICY_VERSION };
}
export function allChecks(checks: ReviewChecks | undefined): boolean {
  return !!checks && ['claim', 'date', 'evidence', 'rights', 'context', 'safety'].every(k => checks[k as keyof ReviewChecks] === true);
}
function validReview(review: HumanReview | undefined, story: Story, context: Context): review is HumanReview {
  return !!review && typeof review.actor === 'string' && !!review.actor.trim() && typeof review.note === 'string' && !!review.note.trim()
    && instant(review.at) !== null && instant(review.at)! <= assertNow(context.now) && review.storyVersion === story.version
    && review.policyVersion === POLICY_VERSION && typeof review.edited === 'boolean';
}
/** Call only after the host authenticates/authorizes an editor. Not a network endpoint. */
export function applyHumanDecision(story: Story, review: HumanReview, context: Context): Story {
  const assessment = assessCandidate(story, context);
  if (!validReview(review, story, context)) throw new Error('Invalid or stale review');
  if (review.action === 'reject') return { ...structuredClone(story), status: 'rejected', review: structuredClone(review) };
  if (!['approve', 'archive'].includes(review.action) || !allChecks(review.checks)) throw new Error('Every review check must be completed');
  if (assessment.recommendation === 'reject' || assessment.reasons.length) throw new Error('Resolve all candidate findings before approval: ' + assessment.reasons.join(', '));
  if (review.action === 'approve' && assessment.observations.includes('ARCHIVE_EVENT')) throw new Error('Old event requires archive approval');
  if (review.action === 'archive' && !dateBounds(story.eventDate)) throw new Error('Archive needs a real event date');
  return { ...structuredClone(story), status: review.action === 'archive' ? 'archived' : 'approved', review: structuredClone(review) };
}
/** Every selection surface uses this common gate, including floor and discovery slots. */
export function displayEligible(s: Story, context: Context, lane: 'recent' | 'archive' = 'recent'): boolean {
  if (validateStory(s).length || context.withdrawnIds?.includes(s.id)) return false;
  if (s.status !== (lane === 'recent' ? 'approved' : 'archived')) return false;
  const r = s.review;
  if (!validReview(r, s, context) || r.action !== (lane === 'recent' ? 'approve' : 'archive') || !allChecks(r.checks)) return false;
  const a = assessCandidate(s, context);
  if (a.reasons.length || a.recommendation === 'reject') return false;
  if (lane === 'recent' && a.observations.includes('ARCHIVE_EVENT')) return false;
  const p = context.sources[s.sourceId];
  const retrieved = instant(s.firstRetrievedAt);
  return !!p && retrieved !== null && assertNow(context.now) - retrieved <= p.permissions.retentionDays * DAY;
}
