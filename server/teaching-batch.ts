import type { ScreenedRecord } from './publisher-snapshot.ts';
import type { PublisherSources } from '../src/lib/publisher-feed.ts';

/**
 * Private teaching batch (General Counsel draft ruling and addendum of October 19, 2026; see docs/publisher-feed.md).
 *
 * The existing daily run saves what it screened to an Alex-only private GitHub repository as one release file per day,
 * so a labeling session can happen at any hour without the one-hour runtime logs. Rules this code keeps:
 * - Same collection only: it receives the records the run already screened and makes no publisher request.
 * - Records hold source name, link, headline, publication date, decision, reason codes, policy version and, for a source whose terms
 *   record sets teachingDescription, the publisher's own feed description kept unchanged as plain text (General Counsel ruling,
 *   October 21, 2026; see cleanDescription). No summaries, no author names.
 * - Release title, tag, notes and file name use the date only: batch-YYYY-MM-DD and batch-YYYY-MM-DD.json.
 * - It only ever creates or deletes releases, their files and their batch-* tags. It has no path that writes a commit,
 *   a file in the repository, a branch or any other ref (tests check the endpoints it can reach).
 * - Batches older than 14 days are deleted (release, file and tag) on every run.
 * - Logs print counts and HTTP status codes only, never the payload or a URL.
 * - Off unless both TEACHING_BATCH_REPO and TEACHING_BATCH_TOKEN are set. Any failure, including an expired key, is quiet and
 *   never changes what the site lists.
 */
export const RETENTION_DAYS = 14;
export const BATCH_TAG = /^batch-(\d{4}-\d{2}-\d{2})$/;
/** Releases whose tag starts with this are the private training archive (General Counsel, October 22, 2026). The 14-day deletion never touches them. */
export const ARCHIVE_TAG_PREFIX = 'archive-';
const API = 'https://api.github.com';
const UPLOADS = 'https://uploads.github.com';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RECORDS = 2000;

export interface TeachingRecord { source: string; link: string; headline: string; published: string; decision: 'list' | 'exclude'; reasons: string[]; policy: string;
  /** The publisher's own description, unchanged plain text, or null. Never reaches the public feed, the run report, logs or a committed file. */
  description: string | null }
export interface TeachingBatchConfig { repo: string; token: string }
type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

/** Reads the two settings. Returns null (feature off) unless both are present and the repository name is well formed. */
export function teachingBatchConfig(env: Record<string, string | undefined> = process.env): TeachingBatchConfig | null {
  const repo = env.TEACHING_BATCH_REPO?.trim(), token = env.TEACHING_BATCH_TOKEN?.trim();
  if (!repo || !token || !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repo)) return null;
  return { repo, token };
}

export const batchDate = (now: string) => new Date(Date.parse(now)).toISOString().slice(0, 10);
export const batchTag = (now: string) => `batch-${batchDate(now)}`;

/** The longest description kept. A longer one is cut at a whole sentence and marked, so a cut text is never mistaken for the full one. */
export const MAX_DESCRIPTION = 600;
export const SHORTENED = ' (shortened)';
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
// Wording that suggests the text may belong to someone other than the publisher. Such a description is not kept (the headline and link still are).
const RESTRICTIVE = /republished (?:from|with|by|courtesy)|originally (?:published|appeared|posted|reported)|first (?:published|appeared) (?:by|in|on|at)|reprinted (?:from|with|by)|syndicated|courtesy of|all rights reserved|permission required|not for republication/i;
const WIRE = /\b(?:Reuters|Associated Press|AFP|Agence France-Presse|Bloomberg|AP)\b/;

/**
 * The publisher's feed description exactly as published, as plain text (General Counsel ruling, October 21, 2026). The only changes:
 * HTML tags, links and images removed, entities written as the characters they stand for, runs of white space made single spaces, and the
 * feed's own "The post ... appeared first on ..." footer removed. A text over MAX_DESCRIPTION is cut at a whole sentence and ends with
 * "(shortened)". Returns null (so only headline and link are kept) when there is no text, when the wording suggests the text may belong to
 * someone other than the publisher, or when the first sentence alone is longer than the cap.
 */
export function cleanDescription(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let text = raw.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<img\b[^>]*>/gi, ' ').replace(/<\/?(?:p|br|div|li|ul|ol|h[1-6]|blockquote)\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, '');
  text = text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') { const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10); return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' '; }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
  text = text.replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/\s*The post .{1,300}? appeared first on .{1,200}?\.?$/i, '').trim();
  if (!text || RESTRICTIVE.test(text) || WIRE.test(text)) return null;
  if (text.length <= MAX_DESCRIPTION) return text;
  let out = '';
  for (const sentence of text.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? []) { const next = (out + ' ' + sentence.trim()).trim(); if (next.length + SHORTENED.length > MAX_DESCRIPTION) break; out = next; }
  return out ? out + SHORTENED : null;
}

/** Only the approved fields. The screened record's summary, labels and category are dropped here; the description comes only from the separate map. */
export function toTeachingRecords(records: ScreenedRecord[], sources: PublisherSources, policy: string, descriptions: ReadonlyMap<string, string> = new Map()): TeachingRecord[] {
  return records.slice(0, MAX_RECORDS).map(r => ({
    source: sources[r.source]?.displayName ?? r.source, link: r.url, headline: r.title, published: r.published,
    decision: r.decision, reasons: [...r.reasons], policy,
    description: sources[r.source]?.publisherFeed?.teachingDescription === true ? cleanDescription(descriptions.get(r.id) ?? '') : null,
  }));
}

/** True when a batch-YYYY-MM-DD tag is more than RETENTION_DAYS days older than today's date (UTC). */
export function expired(tag: string, now: string): boolean {
  if (tag.startsWith(ARCHIVE_TAG_PREFIX)) return false;
  const m = BATCH_TAG.exec(tag);
  if (!m) return false;
  const age = (Date.parse(batchDate(now) + 'T00:00:00Z') - Date.parse(m[1] + 'T00:00:00Z')) / 86400000;
  return Number.isFinite(age) && age > RETENTION_DAYS;
}

export interface SaveResult { saved: number; deleted: number; status: 'saved' | 'off' | 'failed'; code?: number }

/**
 * Saves today's batch and deletes expired ones. Never throws. The returned object holds counts and a status code only.
 * Deletion runs first, so an upload problem can never stop old batches from being removed.
 */
export async function saveTeachingBatch(records: TeachingRecord[], now: string, config: TeachingBatchConfig | null,
  fetcher: Fetch = fetch as unknown as Fetch, log: (line: string) => void = line => console.log(line)): Promise<SaveResult> {
  if (!config) return { saved: 0, deleted: 0, status: 'off' };
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${config.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'PositiviTV-teaching-batch' };
  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, body?: string, extra: Record<string, string> = {}) =>
    fetcher(url, { method, headers: { ...headers, ...extra }, ...(body !== undefined ? { body } : {}), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const repoUrl = `${API}/repos/${config.repo}`;
  let deleted = 0;
  try {
    // 1. Delete expired batches: release (with its file) and then its tag. Only batch-* tags are ever touched, and a release whose tag starts with archive- is skipped on purpose.
    const list = await call('GET', `${repoUrl}/releases?per_page=100`);
    if (list.status !== 200) { log(`teaching-batch list status=${list.status}`); return { saved: 0, deleted, status: 'failed', code: list.status }; }
    const releases = (await list.json()) as Array<{ id: number; tag_name: string }>;
    for (const r of Array.isArray(releases) ? releases : []) {
      if (!r || typeof r.tag_name !== 'string' || !Number.isInteger(r.id) || r.tag_name.startsWith(ARCHIVE_TAG_PREFIX) || !expired(r.tag_name, now)) continue;
      const a = await call('DELETE', `${repoUrl}/releases/${r.id}`);
      const b = await call('DELETE', `${repoUrl}/git/refs/tags/${encodeURIComponent(r.tag_name)}`);
      if ([204, 404].includes(a.status) && [204, 404, 422].includes(b.status)) deleted++;
      else log(`teaching-batch delete status=${a.status},${b.status}`);
    }
    // 2. Save today's batch. A second run on the same day replaces the day's file.
    const tag = batchTag(now), name = `${tag}.json`;
    let release = await call('POST', `${repoUrl}/releases`, JSON.stringify({ tag_name: tag, name: tag, body: tag, draft: false, prerelease: false }));
    let releaseId: number | null = null;
    if (release.status === 201) releaseId = ((await release.json()) as { id: number }).id;
    else if (release.status === 422) {
      release = await call('GET', `${repoUrl}/releases/tags/${encodeURIComponent(tag)}`);
      if (release.status === 200) {
        const existing = (await release.json()) as { id: number; assets?: Array<{ id: number; name: string }> };
        releaseId = existing.id;
        for (const asset of existing.assets ?? []) if (asset.name === name) await call('DELETE', `${repoUrl}/releases/assets/${asset.id}`);
      }
    }
    if (!Number.isInteger(releaseId)) { log(`teaching-batch release status=${release.status}`); return { saved: 0, deleted, status: 'failed', code: release.status }; }
    const upload = await call('POST', `${UPLOADS}/repos/${config.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
      JSON.stringify({ date: batchDate(now), records }), { 'Content-Type': 'application/json' });
    if (upload.status !== 201) { log(`teaching-batch upload status=${upload.status}`); return { saved: 0, deleted, status: 'failed', code: upload.status }; }
    log(`teaching-batch saved=${records.length} deleted=${deleted}`);
    return { saved: records.length, deleted, status: 'saved' };
  } catch (error) {
    log(`teaching-batch error=${error instanceof Error ? error.name : 'Error'} deleted=${deleted}`);
    return { saved: 0, deleted, status: 'failed' };
  }
}
