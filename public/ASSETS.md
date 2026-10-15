# Asset sources

Downloaded October 14, 2026. These are illustrative assets, not evidence for any sample headline.

| Local asset | Source |
|---|---|
| earth.jpg | Lighter Earth picture (2048 x 1024, about 340 KB) that every visitor loads first. A LANCZOS downscale of `earth-sharp.jpg`, so both pictures show exactly the same Earth. |
| earth-sharp.jpg | Sharp Earth picture (4096 x 2048, about 1.4 MB), fetched only once someone zooms in close. See "Earth imagery" below. |
| borders.json | Country borders (about 105 KB, about 33 KB compressed), built by `scripts/build-borders.mjs` from Natural Earth 4.1.0 at 1:50m via the npm package `world-atlas@2.0.2`. See "Country borders" below. |
| places.json | Country names, national capitals and cities of 2 million people or more (about 16 KB, about 8 KB compressed), built by `scripts/build-places.mjs` from two Natural Earth 5.1.2 files at 1:50m. See "Country and city names" below. |
| coast.jpg | https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=700&q=85&fit=crop |
| wind.jpg | https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=700&q=85&fit=crop |
| city.jpg | https://images.unsplash.com/photo-1518391846015-55a9cc003b25?w=700&q=85&fit=crop |
| Three.js code | npm package three@0.180.0; https://github.com/mrdoob/three.js/tree/r180 |
| Reference concept | Generated for this PositiviTV conversation; first design only. |

Earth source context (replaced October 15, 2026): the earlier `earth.jpg` came from the three.js examples (`earth_atmos_2048.jpg`).

## Earth imagery (checked 15 October 2026)

`earth-sharp.jpg` is byte for byte the file `example/img/earth-blue-marble.jpg` in the npm package `three-globe@2.45.6` (sha256 starting `228deba2e4b60014`). It matches NASA's Blue Marble: Next Generation with topography and bathymetry (January), https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/ , which NASA publishes at 5400 x 2700 and 21600 x 10800. The three-globe package is MIT licensed, and that license covers its code, not the picture, so the NASA terms are the ones that apply.

- NASA's usage page (https://www.nasa.gov/nasa-brand-center/images-and-media/, read October 15, 2026) says NASA content is generally not subject to copyright in the United States and asks that NASA is acknowledged as the source. The app credits "NASA / Blue Marble" under the globe and in the About panel.
- What was not verified: NASA's own download site is blocked from the build workspace, so this copy could not be compared byte for byte with NASA's original. Its identity rests on its filename, its package, and its look, which is the well-known NASA picture. If a byte-for-byte check or a higher resolution is wanted later, download NASA's 5400 x 2700 file from the page above.
- NASA's marks (insignia, logotype) are not in the public domain and are not used. No NASA endorsement is claimed.

## Country borders (checked 15 October 2026)

`borders.json` holds only the lines that two countries share (coastlines are left out because the Earth picture already shows them). It is generated, not hand edited: `npm run borders:build` rewrites it and `npm run borders:check` (also part of the test suite) fails if the committed file differs from what the script produces. The data comes from Natural Earth, which states that "All versions of Natural Earth raster + vector map data found on this website are in the public domain" and that crediting the authors is unnecessary (https://www.naturalearthdata.com/about/terms-of-use/, read October 15, 2026). The app credits it anyway in the About panel. The packages `world-atlas` (ISC) and `topojson-client` (ISC) are development tools only; nothing from them ships to phones except the finished file.

Natural Earth shows boundaries as they are on the ground today and says it is not responsible for accuracy. Some borders are disputed, and the About panel says boundaries are approximate. If General Counsel wants different wording or a map-disclaimer, that is a copy change in `src/App.tsx`.

## Country and city names (checked 15 October 2026)

`places.json` is generated, not hand edited, from two files in the Natural Earth GitHub mirror at tag v5.1.2 (`ne_50m_admin_0_countries.geojson` and `ne_50m_populated_places.geojson`). `scripts/build-places.mjs` checks each file against the SHA-256 recorded in the script before using it, so a changed upstream file stops the build. `npm run places:build` downloads the two files and rewrites the output; `npm run places:check` fails if the committed file differs. The data is public domain under the same Natural Earth terms quoted above, and the terms add that the names in more than 20 languages come from Wikidata, "which is under a CC0 (public domain) license" (https://www.naturalearthdata.com/about/terms-of-use/, read October 15, 2026). Nothing is fetched from any other service, and the finished file is served from the app like the borders.

The rules that decide what gets a name are fixed in the script and written into the file:

- **Countries:** only places with an ISO 3166-1 country code get a name, at the spot Natural Earth gives for it. Places without one (Kosovo, Somaliland, Northern Cyprus and the Siachen Glacier in this data) are not labelled, and nobody adds or removes a label by hand. Names are Natural Earth's English names, with a short table of exceptions for names too long for a map label (for example "United States of America" is shown as "United States").
- **Cities:** every place Natural Earth marks as a national capital, plus every other place of 2 million people or more, without research stations, historic places or weather stations and without places whose country has no ISO code. Three city names are changed on purpose: "Washington" becomes "Washington, D.C.", Natural Earth's out-of-date "Nur-Sultan" becomes "Astana" (renamed back in September 2022) and "Melekeok" becomes "Ngerulmud" (Palau's government has sat there since 2006).
- **Not claimed:** the globe never says which city is a country's capital. The capital rule only decides which small cities are included.

Natural Earth disclaims accuracy, and country names, capitals and the status of some places are disputed. This policy is rule based on purpose, so it can be explained once and applied evenly, but it means the globe shows what Natural Earth shows, including entries some readers may disagree with (for example the city of Jerusalem is labelled, and Taiwan and Palestine are labelled as places). The About panel says names are approximate. General Counsel should confirm this policy before launch.

Keep appropriate imagery credits in the final product. The Three.js MIT license covers its code; it does not automatically license every third-party image. Review each asset's original usage terms before redistribution or public launch, and replace illustrative images with licensed article-specific imagery. Unsplash usage terms: https://unsplash.com/license. No third-party publisher endorsement is claimed.

The source photos are not the exact generated thumbnails inside the reference image. A pixel-identical reproduction is not implied.

## Integrated preview additions

Inter variable font, version 4.1: https://github.com/rsms/inter/tree/v4.1 — Rasmus Andersson, SIL Open Font License 1.1. Local license: fonts/OFL.txt. Sunshine symbol and vector UI icons are authored SVGs. Sample story dates are now fixed examples around October 14, 2026. No production news or publisher claims are supplied.

Map reference coordinates: Canadian Geographical Names Database (Clayoquot Sound, JADRA) and NOAA/CNRFC (Klamath River reference point, KLMC1). Links and interpretation are documented in `src/lib/map-places.ts`; these factual points are not exact event sites.

## Live story photo catalog (checked 14 October 2026)

These are place or subject illustrations, not evidence photographs of a reported event. Files are Commons thumbnail renditions, resized; CSS may crop the display. Credits and licenses appear on cards.

- `assets/stories/clayoquot.jpg`: Sam Beebe, [Clayoquot Sound – Vargas Island](https://commons.wikimedia.org/wiki/File:Clayoquot_Sound_-_Vargas_Island.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
- `assets/stories/klamath.jpg`: Bob Wick / BLM Oregon & Washington, [Klamath River](https://commons.wikimedia.org/wiki/File:Klamath_River_-_28206035602.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
- `assets/stories/rover.png`: NASA/JPL-Caltech/MSSS, [Perseverance Stuns in New Selfie](https://commons.wikimedia.org/wiki/File:Perseverance_Stuns_in_New_Selfie.png), public domain as specified on its Commons license section.
- `assets/stories/moon.jpg`: NASA Johnson Space Center, [Apollo 17 full Moon](https://commons.wikimedia.org/wiki/File:Full_disc_of_moon_photographed_by_Apollo_17_crewmen_during_transearth_coast_(as17-152-23311).jpg), public domain as specified on its Commons license section.
- `assets/stories/space.jpg`: NASA/Jeff Williams, [ISS-47 Sunrise](https://commons.wikimedia.org/wiki/File:ISS-47_Sunrise_on_our_Planet_Earth.jpg), public domain as specified on its Commons license section.
- `assets/stories/forest.jpg`: ImagePerson, [Costa Rica Rainforest 0017](https://commons.wikimedia.org/wiki/File:Costa_Rica_Rainforest_0017.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This image retains that license independently of MIT code licensing.

Bicuar park reference: [GeoNames 3351643](https://www.geonames.org/3351643/parque-nacional-do-bicuari.html), approximate park reference point; coordinates from GeoNames under its [CC BY license](https://www.geonames.org/export/).

## Additional subject illustrations

These are animal subject photos, with no claim to depict the reported individual animals or events. Commons thumbnail renditions are resized and may be cropped in display. The original files retain their linked licenses independently of the MIT code license.

- `assets/stories/leopard-cat.jpg`: Mike Prince from Bangalore, India, [original file](https://commons.wikimedia.org/wiki/File:Leopard_Cat_(14839635578).jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
- `assets/stories/giraffe.jpg`: Giles Laurent, [original file](https://commons.wikimedia.org/wiki/File:106_Angolan_giraffe_walking_in_the_Kalahari_Desert_of_Namibia_Photo_by_Giles_Laurent.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `assets/stories/cattle.jpg`: arboresce, [original file](https://commons.wikimedia.org/wiki/File:Nguni_Cows.jpg), [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
