import type { Story } from '../types';

/**
 * Moving between stories by swiping the opened-story card.
 * Pure helpers, so the rules can be tested without a browser.
 */

/** How far a finger must travel sideways, in CSS pixels, to count as a swipe. */
export const SWIPE_MIN_DISTANCE_PX = 48;
/** A quick flick may be shorter, as long as it is over fast enough. */
export const SWIPE_FLICK_DISTANCE_PX = 28;
export const SWIPE_FLICK_MAX_MS = 220;
/** The move must be clearly more sideways than up or down, so scrolling the page never changes the story. */
export const SWIPE_HORIZONTAL_BIAS = 1.6;

export type SwipeIntent = 'next' | 'previous' | null;

/** Swiping left brings the next story in from the right; swiping right goes back. */
export function swipeIntent(dx: number, dy: number, elapsedMs: number): SwipeIntent {
  if (![dx, dy, elapsedMs].every(Number.isFinite)) return null;
  const across = Math.abs(dx), down = Math.abs(dy);
  if (across < down * SWIPE_HORIZONTAL_BIAS) return null;
  const longEnough = across >= SWIPE_MIN_DISTANCE_PX;
  const quickFlick = across >= SWIPE_FLICK_DISTANCE_PX && elapsedMs >= 0 && elapsedMs <= SWIPE_FLICK_MAX_MS;
  if (!longEnough && !quickFlick) return null;
  return dx < 0 ? 'next' : 'previous';
}

type Located = Pick<Story, 'id' | 'lat' | 'lng'>;

/**
 * The stories a swipe moves through: the ones with a pin on the globe, in the order of the Stories list.
 * The story that is open always stays in the order, even if it has no pin, so a swipe can always move on from it.
 */
export function swipeStories<T extends Located>(listed: T[], currentId: string | null): T[] {
  return listed.filter(s => (s.lat !== null && s.lng !== null) || s.id === currentId);
}

/** The story one step along, wrapping around at either end. Null when there is nowhere else to go. */
export function neighborStory<T extends Pick<Story, 'id'>>(items: T[], currentId: string | null, direction: 1 | -1): T | null {
  if (!items.length) return null;
  const at = items.findIndex(s => s.id === currentId);
  if (at === -1) return direction === 1 ? items[0] : items[items.length - 1];
  if (items.length === 1) return null;
  return items[(at + direction + items.length) % items.length];
}

/** Where the open story sits in the swipe order, for the dots under the card. Null when there is nothing to swipe to. */
export function swipePosition<T extends Pick<Story, 'id'>>(items: T[], currentId: string | null): { index: number; total: number } | null {
  const index = items.findIndex(s => s.id === currentId);
  return index === -1 || items.length < 2 ? null : { index, total: items.length };
}
