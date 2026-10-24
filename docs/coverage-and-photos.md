# Coverage and story photos

The initial release served eight stories and just two supported Earth locations. Most were NASA space stories; those must not be pinned to NASA's headquarters. The original public contract also required `image: null`, so the client intentionally showed category artwork. This was incomplete for the intended globe experience.

## Coverage changes

The automatic lane now considers reporting published within 30 days, with the original dates intact. Mongabay RSS is supplemented by at most 100 posts from its public, keyless WordPress metadata endpoint and one bounded byline lookup. The article byline taxonomy is authoritative for the displayed writer; SEO authors and WordPress user accounts can name editors instead. Missing bylines cause licensed cards to be omitted. RSS wins duplicate URL ties. The publisher's advertised 10-second crawl delay is applied between supplement requests. Metadata failures preserve usable RSS and are recorded as `SUPPLEMENT_UNAVAILABLE` in private source findings. No visitor request initiates this work.

Location matching supports additional animal outcomes, an explicit rescued-animal country possessive, and Bicuar National Park's sourced GeoNames reference point. Multiple-country, origin, off-Earth and unsupported cases remain unpinned. These are approximate areas, not exact event coordinates. The map reports total mapped stories worldwide and links to stories available only in the list; points on the back of Earth remain hidden until the globe rotates.

Two deterioration headlines exposed by the wider intake are regression cases. These rules are still fallible; a larger feed is not evidence of fact-checking accuracy or guaranteed geographic balance. No fictional reporting fills gaps.

## Photos

Thirteen checked Wikimedia Commons photos are bundled locally (nine at first, four habitat photos added October 24, 2026). Known supported locations receive location photos; other cards receive explicit subject illustrations. Neither is represented as an image of the reported event. Cards show that distinction, source credit and linked license. Broken images fall back to category artwork. No live browser request goes to an image vendor, and no paid generation or image API is used.

Only catalogued local asset paths with matching alt text, credit and catalog ID satisfy the public card validator. Untrusted feed image URLs remain blocked. Extending the catalog requires checking the file's license and caption. Source reporting and photo licenses are separate. Commons thumbnail renditions are resized; CSS may crop their display. The forest image remains available under CC BY-SA 4.0; the MIT code license does not replace asset licenses.

See `/ASSETS.md` for sources. Snapshot and lock paths are now scoped to the screening-policy version so a preview collection does not replace the previous production policy's data. Old policy objects remain private and are no longer used by the new build.

## Habitat photos (subjects-v2)

The current frontend now requests `?photos=subjects-v2`. That profile includes everything in subjects-v1 and adds four more checked photos, chosen by a word in the headline: mangrove (mangrove), seabird (seabird, albatross, shearwater, petrel, puffin), elephant (elephant) and reef-fish (coral, reef, seagrass, marine, ocean, deep sea). The word lists are checked in this order after the animal subjects of v1 and before the rover, Moon and generic photos. A page that asks for subjects-v1 or nothing never receives these ids. The profile changes only the picture: eligibility, story ids, versions, the manifest and collection behavior are the same. Species guard (General Counsel, October 24, 2026): the elephant photo shows African savanna elephants, so a headline that names another kind (Asian, Asiatic, Indian, Sri Lankan, Sumatran, Bornean, pygmy or forest elephants) gets the default art instead. Sources and licenses are in `/ASSETS.md`.

## Subject-photo compatibility

The current frontend requests `?photos=subjects-v1` to select the expanded, checked animal-photo catalog. The default API response retains the original six-photo catalog so an already-open older app does not reject stories when it encounters an unfamiliar photo ID. The presentation profile does not change eligibility, story IDs, versions, the manifest or collection behavior. Local development uses the same profile.

A wider archive sample added no qualifying mapped outcomes. An unresolved trafficked-animal story from that sample is now a permanent rejection regression. No extra archive request is added to the daily job. Screening policy `publisher-feed-0.5.0` (0.5.0 adds the person-approved list; the screening rules are unchanged) uses a separate private snapshot path.
