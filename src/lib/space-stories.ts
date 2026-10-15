/**
 * Stories about space that have no place on Earth (a rover on Mars, a telescope, a comet) used to have no pin at all and only showed in
 * the list. They now also appear as small stars floating above the globe. Pure helpers, so the rules can be tested without a browser.
 *
 * The rule is deliberately narrow: a story is a space story only when it comes from NASA, has no place on Earth, and its headline names
 * something that is not on Earth. A NASA story about the ocean that merely lacks a pin is not a space story and gets no star. Words
 * like "satellite", "orbit", "astronaut" and "space station" are left out on purpose, because NASA uses them for stories about Earth.
 */
import type { Story } from '../types';

/** What a space story is about, shown where a place would go. Never a place: these stories have none. */
export type SpaceTopic = 'Sun and space weather' | 'Deep space' | 'Space exploration';
const SUN_WORDS = /\b(?:solar (?:flares?|storms?)|sunspots?)\b/i;
const DEEP_SPACE_WORDS = /\b(?:galax(?:y|ies)|telescopes?|Webb|Hubble|exoplanets?|nebula\w*|black holes?|supernovae?)\b/i;
/** How far from the middle of the globe the stars float (the surface is at 1). Low enough to stay in the picture, high enough to clear the pins. */
export const SKY_STAR_RADIUS = 1.6;

const SPACE_WORDS = /\b(?:Mars|Martian|Moon|lunar|Artemis|rovers?|galax(?:y|ies)|telescopes?|asteroids?|exoplanets?|comets?|nebula\w*|Jupiter|Saturn|Venus|Webb|Hubble|solar system|black holes?|supernovae?|solar (?:flares?|storms?)|sunspots?)\b/i;

type SpaceStoryFields = Pick<Story, 'title' | 'lat' | 'lng' | 'sourceName' | 'isDemo'> & Partial<Pick<Story, 'id'>>;

/** True for a NASA story with no place on Earth whose headline names something in space. Demo samples never count. */
export function isSpaceStory(story: SpaceStoryFields): boolean {
  if (story.isDemo || story.lat !== null || story.lng !== null) return false;
  const fromNasa = story.sourceName === 'NASA' || (typeof story.id === 'string' && story.id.startsWith('nasa-'));
  return fromNasa && SPACE_WORDS.test(story.title);
}

/** The topic of a space story, read only from its headline: the Sun, deep space (telescopes, galaxies, black holes), or otherwise exploring our own solar system. */
export function spaceTopic(title: string): SpaceTopic {
  if (SUN_WORDS.test(title)) return 'Sun and space weather';
  return DEEP_SPACE_WORDS.test(title) ? 'Deep space' : 'Space exploration';
}

/** What to show where the story's place goes: the topic for a space story (it has no place), otherwise the story's own place. */
export function storyPlace(story: SpaceStoryFields & { location: string }): string {
  return isSpaceStory(story) ? spaceTopic(story.title) : story.location;
}

/**
 * Where a space story's star floats, as a latitude and longitude of the point on the globe it sits above. It depends only on the story id,
 * so the star stays put when other stories come and go, and flying the camera to this point puts the star in front of the globe.
 * Latitudes stay within 50 degrees of the equator so a star is never pinned to a pole where the camera cannot sit straight above it.
 */
export function skyPosition(id: string): { lat: number; lng: number } {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) { hash ^= id.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  const a = (hash & 0xffff) / 0xffff, b = (hash >>> 16) / 0xffff;
  return { lat: -50 + a * 100, lng: -180 + b * 360 };
}

/** The camera distance and apparent angle used to show a space star: far enough back, and turned far enough round, that the star sits in the dark beside the globe instead of in front of it. */
export const SKY_VIEW_DISTANCE = 3.9;
/** How many degrees from the centre of the picture the star appears. The globe's edge is at about 15 degrees at this distance, and a phone shows about 20 each way. */
export const SKY_APPARENT_DEGREES = 18.3;

type Vec = readonly [number, number, number];
const toVector = (lat: number, lng: number, radius: number): Vec => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return [-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)];
};
const normalize = (v: Vec): Vec => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Where the star appears on screen for a camera at this latitude and longitude: its angle from the centre (degrees), and whether it is to the left of the centre. */
export function starAppearance(star: { lat: number; lng: number }, camera: { lat: number; lng: number; distance: number }): { degrees: number; left: boolean } {
  const s = toVector(star.lat, star.lng, SKY_STAR_RADIUS), c = toVector(camera.lat, camera.lng, camera.distance);
  const forward = normalize([-c[0], -c[1], -c[2]]), toStar = normalize(sub(s, c));
  const right = normalize(cross(forward, [0, 1, 0]));
  return { degrees: Math.acos(Math.max(-1, Math.min(1, dot(forward, toStar)))) * 180 / Math.PI, left: dot(sub(s, c), right) < 0 };
}

/**
 * The camera that shows a space star in the sky beside the globe, on its left (the zoom buttons are on the right). The camera keeps the
 * star's latitude and moves round the globe until the star appears SKY_APPARENT_DEGREES from the centre, clear of the globe's disc.
 */
export function skyView(id: string): { lat: number; lng: number; distance: number } {
  const star = skyPosition(id);
  let best = { lat: star.lat, lng: star.lng, distance: SKY_VIEW_DISTANCE };
  for (const sign of [1, -1]) {
    let low = 0, high = 60;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2, shown = starAppearance(star, { lat: star.lat, lng: star.lng + sign * mid, distance: SKY_VIEW_DISTANCE });
      if (shown.degrees < SKY_APPARENT_DEGREES) low = mid; else high = mid;
    }
    let lng = star.lng + sign * high; lng = ((lng + 540) % 360) - 180;
    const candidate = { lat: star.lat, lng, distance: SKY_VIEW_DISTANCE };
    if (starAppearance(star, candidate).left) { best = candidate; break; }
  }
  return best;
}

/** True when the straight line from the camera to the point passes through the Earth (a sphere of the given radius), so the point is behind it. */
export function hiddenByEarth(camera: Vec, point: Vec, radius = 1): boolean {
  const d: Vec = [point[0] - camera[0], point[1] - camera[1], point[2] - camera[2]];
  const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  if (a === 0) return false;
  const b = 2 * (camera[0] * d[0] + camera[1] * d[1] + camera[2] * d[2]);
  const c = camera[0] * camera[0] + camera[1] * camera[1] + camera[2] * camera[2] - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return false;
  const near = (-b - Math.sqrt(discriminant)) / (2 * a);
  return near > 0 && near < 1;
}

