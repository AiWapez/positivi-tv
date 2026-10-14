# Coverage and story photos

The initial release served eight stories and just two supported Earth locations. Most were NASA space stories; those must not be pinned to NASA's headquarters. The original public contract also required `image: null`, so the client intentionally showed category artwork. This was incomplete for the intended globe experience.

## Coverage changes

The automatic lane now considers reporting published within 30 days, with the original dates intact. Mongabay RSS is supplemented by at most 100 posts from its public, keyless WordPress metadata endpoint and one bounded byline lookup. The article byline taxonomy is authoritative for the displayed writer; SEO authors and WordPress user accounts can name editors instead. Missing bylines cause licensed cards to be omitted. RSS wins duplicate URL ties. The publisher's advertised 10-second crawl delay is applied between supplement requests. Metadata failures preserve usable RSS and are recorded as `SUPPLEMENT_UNAVAILABLE` in private source findings. No visitor request initiates this work.

Location matching supports additional animal outcomes, an explicit rescued-animal country possessive, and Bicuar National Park's sourced GeoNames reference point. Multiple-country, origin, off-Earth and unsupported cases remain unpinned. These are approximate areas, not exact event coordinates. The map reports total mapped stories worldwide and links to stories available only in the list; points on the back of Earth remain hidden until the globe rotates.

Two deterioration headlines exposed by the wider intake are regression cases. These rules are still fallible; a larger feed is not evidence of fact-checking accuracy or guaranteed geographic balance. No fictional reporting fills gaps.

## Photos

Six checked Wikimedia Commons photos are bundled locally. Known supported locations receive location photos; other cards receive explicit subject illustrations. Neither is represented as an image of the reported event. Cards show that distinction, source credit and linked license. Broken images fall back to category artwork. No live browser request goes to an image vendor, and no paid generation or image API is used.

Only catalogued local asset paths with matching alt text, credit and catalog ID satisfy the public card validator. Untrusted feed image URLs remain blocked. Extending the catalog requires checking the file's license and caption. Source reporting and photo licenses are separate. Commons thumbnail renditions are resized; CSS may crop their display. The forest image remains available under CC BY-SA 4.0; the MIT code license does not replace asset licenses.

See `/ASSETS.md` for sources. Snapshot and lock paths are now scoped to the screening-policy version so a preview collection does not replace the previous production policy's data. Old policy objects remain private and are no longer used by the new build.
