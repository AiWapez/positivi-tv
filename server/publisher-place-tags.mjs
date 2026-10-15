/**
 * Reads the two place facts a WordPress publisher API can attach to a post, without trusting either:
 * - location tags, from the core `class_list` field ("location-south-africa" means the post carries a Location tag whose slug is south-africa);
 * - map coordinates, from a `coordinates` string such as "-23.03, 30.29".
 * Both are untrusted text. Only well-formed values are kept, and nothing is fetched here. Whether a card ever uses them is decided later
 * by server/publisher-place.ts and by the per-source switch, which is off.
 */
const SLUG = /^location-([a-z0-9]+(?:-[a-z0-9]+){0,5})$/;
const COORDINATES = /^\s*(-?\d{1,3}(?:\.\d{1,15})?)\s*,\s*(-?\d{1,3}(?:\.\d{1,15})?)\s*$/;
const MAX_CLASSES = 200;

export function placeTagsFromPost(post) {
  const slugs = [];
  if (Array.isArray(post?.class_list)) {
    for (const entry of post.class_list.slice(0, MAX_CLASSES)) {
      const m = typeof entry === 'string' ? SLUG.exec(entry) : null;
      if (m && !slugs.includes(m[1])) slugs.push(m[1]);
    }
  }
  let coordinates = null;
  const c = typeof post?.coordinates === 'string' && post.coordinates.length <= 80 ? COORDINATES.exec(post.coordinates) : null;
  if (c) {
    const lat = Number(c[1]), lng = Number(c[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) coordinates = { lat, lng };
  }
  return slugs.length || coordinates ? { slugs: slugs.slice(0, 40), coordinates } : undefined;
}
