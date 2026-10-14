export const POLICY_VERSION = 'goodsignal-0.1.0';
export const TOPICS = ['climate_energy', 'health_medicine', 'science_space', 'education',
  'economy_jobs', 'community_kindness', 'animals_nature', 'infrastructure',
  'arts_culture', 'sports_achievement', 'governance_rights', 'technology'] as const;
export type Topic = typeof TOPICS[number];
export const REGIONS = ['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania'] as const;
export type Region = typeof REGIONS[number];
export type Stage = 'completed' | 'milestone' | 'progress' | 'plan' | 'research' | 'none';
export type Frame = 'reports_outcome' | 'analysis_or_critique' | 'announcement_of_intent' | 'profile_feature' | 'promotional' | 'other';
export type ResearchStage = 'none' | 'preprint' | 'animal' | 'lab' | 'early_human' | 'trial_phase_2plus' | 'approved';
export interface EventDate {
  value: string; precision: 'day' | 'month' | 'year';
  basis: 'source' | 'reviewer'; quote?: string;
}
export interface Location {
  kind: 'point' | 'city' | 'country' | 'region' | 'multi' | 'global' | 'unknown';
  region?: Region; country?: string;
  points: { name: string; lat: number; lng: number; precisionKm: number }[];
}
export interface SourcePolicy {
  id: string; domains: string[]; enabled: boolean; tier: 1 | 2 | 3;
  type: 'outlet' | 'primary' | 'press_wire';
  permissions: { title: boolean; summary: boolean; policyRef: string; retentionDays: number };
}
export interface ReviewChecks {
  claim: boolean; date: boolean; evidence: boolean; rights: boolean; context: boolean; safety: boolean;
}
export interface HumanReview {
  actor: string; at: string; storyVersion: number; policyVersion: string;
  action: 'approve' | 'archive' | 'reject'; edited: boolean; checks: ReviewChecks; note: string;
}
/** Records and review metadata are server-owned. These types are not authentication. */
export interface Story {
  id: string; version: number; clusterId: string; sourceId: string; url: string;
  title: string; summary: string | null; body: string; publishedAt: string; firstRetrievedAt: string;
  topics: Topic[]; stage: Stage; frame: Frame; researchStage: ResearchStage;
  eventDate: EventDate | null; originDate?: EventDate | null; outcomeQuote: string | null;
  quantities: { value: string; subject: string; quote: string }[];
  evidence: { level: 0 | 1 | 2 | 3; checkedBy: string | null; links: string[]; note: string };
  location: Location; entities: string[]; humanStory: boolean;
  impact: number; status: 'pending' | 'approved' | 'archived' | 'rejected' | 'withdrawn';
  review?: HumanReview; promise?: { quantity: string; deadline: EventDate; quote: string };
}
export interface Assessment {
  recommendation: 'reject' | 'needs_attention' | 'ready_for_review';
  reasons: string[]; observations: string[]; policyVersion: string;
}
export interface Profile {
  affinity?: Partial<Record<Topic, number>>; onlyTopics?: Topic[]; hiddenTopics?: Topic[];
  blockedSources?: string[]; hiddenIds?: string[]; seenClusters?: Record<string, string>;
  discovery?: boolean;
}
export interface Context {
  now: string; sources: Record<string, SourcePolicy>; recentDays?: number;
  /** Omitted = no withdrawals known to this offline snapshot, not a live status guarantee. */
  withdrawnIds?: string[];
}
export interface Selection {
  stories: Story[]; reasons: Record<string, string[]>; relaxations: string[];
  coverageGaps: string[];
}
/** 'listed' marks an automatically selected publisher-feed card. It is never an editorial approval. */
export type ManifestStatus = Story['status'] | 'listed';
export interface StatusManifest {
  version: string; generatedAt: string;
  stories: Record<string, { version: number; status: ManifestStatus }>;
}
