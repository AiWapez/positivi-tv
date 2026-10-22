import type { TeachingRecord } from './teaching-batch.ts';
import type { PublisherSources } from '../src/lib/publisher-feed.ts';

/**
 * Private training archive (General Counsel ruling of October 22, 2026, which replaces the 14-day limit for stories Alex has labelled;
 * draft pending licensed attorney review; see docs/publisher-feed.md).
 *
 * This module only turns a day's teaching batch plus Alex's labels into archive lines. It is deliberately small and closed:
 * - It has no network access and no file access. It receives data and returns data. Nothing in it can reach a publisher, GitHub or a log.
 * - A story is archived only when every source that uses its display name has archiveAllowed set to true in its terms record
 *   (condition 2). A source with no setting, or a setting that is not exactly true, is left out entirely.
 * - A record that carries a third-party credit keeps the link and the label only, with no headline and no description (condition 3).
 *   Items with a blocked credit or a restrictive rights notice are already dropped before the teaching batch is made.
 * - Only the fields in ARCHIVE_FIELDS are copied (condition 1). Nothing else from the batch can slip through. No images, no summaries.
 * - The archive is never public. The caller (scripts/build-archive.mjs) refuses to write inside this repository. Counts are the only
 *   thing anyone may print about it (condition 4).
 */
export const ARCHIVE_FIELDS = ['source', 'link', 'headline', 'description', 'published', 'label', 'reasons', 'policy', 'labelDate'] as const;
export const ARCHIVE_LABELS = ['keep', 'reject', 'unsure'] as const;
export type ArchiveLabel = typeof ARCHIVE_LABELS[number];
/** Reason codes whose story must keep only its link and label. */
export const LINK_ONLY_REASONS: readonly string[] = ['THIRD_PARTY_CREDIT'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LABELS = 5000;

export interface ArchiveRecord {
  source: string; link: string;
  /** Null only for a link-and-label-only record. */
  headline: string | null;
  /** The publisher's own description, unchanged apart from the plain-text and "(shortened)" rules, or null. */
  description: string | null;
  published: string; label: ArchiveLabel; reasons: string[]; policy: string; labelDate: string;
}
export interface ArchiveLabelInput { link: string; label: string; at?: string }
export interface ArchiveCounts { archived: number; linkOnly: number; skippedNotAllowed: number; skippedNoBatchMatch: number; skippedBadLabel: number; skippedDuplicate: number }

const httpsLink = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

/**
 * True only when at least one source uses this display name and every such source is switched on and has archiveAllowed exactly true.
 * Several sources can share one display name (for example the Global Voices feeds), so one source without permission blocks the name.
 */
export function archiveAllowedFor(displayName: string, sources: PublisherSources): boolean {
  const matches = Object.values(sources).filter(s => s.displayName === displayName);
  return matches.length > 0 && matches.every(s => s.enabled === true && s.publisherFeed?.enabled === true && s.publisherFeed?.archiveAllowed === true);
}

/** The date a label was made: the calendar date of its timestamp, else the fallback. */
function labelDay(at: unknown, fallback: string): string {
  if (typeof at === 'string' && DATE_ONLY.test(at.slice(0, 10)) && Number.isFinite(Date.parse(at))) return at.slice(0, 10);
  return fallback;
}

/**
 * Joins a day's batch records to Alex's labels by link and returns the archive lines plus counts only.
 * The batch is the source of every story field; a label contributes only the label itself and its date.
 */
export function buildArchive(batch: readonly TeachingRecord[], labels: readonly ArchiveLabelInput[], sources: PublisherSources, fallbackLabelDate: string): { records: ArchiveRecord[]; counts: ArchiveCounts } {
  if (!DATE_ONLY.test(fallbackLabelDate)) throw new Error('fallbackLabelDate must be YYYY-MM-DD');
  const counts: ArchiveCounts = { archived: 0, linkOnly: 0, skippedNotAllowed: 0, skippedNoBatchMatch: 0, skippedBadLabel: 0, skippedDuplicate: 0 };
  const byLink = new Map<string, TeachingRecord>();
  for (const record of batch) if (httpsLink(record.link) && !byLink.has(record.link)) byLink.set(record.link, record);
  const seen = new Set<string>();
  const records: ArchiveRecord[] = [];
  for (const input of labels.slice(0, MAX_LABELS)) {
    const label = typeof input?.label === 'string' ? input.label.trim().toLowerCase() : '';
    if (!(ARCHIVE_LABELS as readonly string[]).includes(label)) { counts.skippedBadLabel++; continue; }
    const record = typeof input.link === 'string' ? byLink.get(input.link) : undefined;
    if (!record) { counts.skippedNoBatchMatch++; continue; }
    if (seen.has(record.link)) { counts.skippedDuplicate++; continue; }
    seen.add(record.link);
    if (!archiveAllowedFor(record.source, sources)) { counts.skippedNotAllowed++; continue; }
    const linkOnly = record.reasons.some(reason => LINK_ONLY_REASONS.includes(reason));
    records.push({
      source: record.source, link: record.link,
      headline: linkOnly ? null : record.headline,
      description: linkOnly ? null : record.description,
      published: record.published, label: label as ArchiveLabel, reasons: [...record.reasons], policy: record.policy,
      labelDate: labelDay(input.at, fallbackLabelDate),
    });
    counts.archived++;
    if (linkOnly) counts.linkOnly++;
  }
  return { records, counts };
}

/** One JSON object per line, with exactly the ARCHIVE_FIELDS in a fixed order. */
export function serializeArchive(records: readonly ArchiveRecord[]): string {
  return records.map(record => JSON.stringify(Object.fromEntries(ARCHIVE_FIELDS.map(field => [field, record[field]])))).join('\n') + (records.length ? '\n' : '');
}

/** The file path inside the private archive repository for one batch day. */
export function archiveFilePath(batchDay: string): string {
  if (!DATE_ONLY.test(batchDay)) throw new Error('batchDay must be YYYY-MM-DD');
  return `archive/${batchDay}.jsonl`;
}
