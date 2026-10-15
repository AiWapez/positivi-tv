# Globe zoom detail

What the globe shows as a reader zooms in, and the rules that keep it light on phones. The numbers live in `src/lib/globe-detail.ts`; the drawing lives in `src/lib/globe.js`.

## Camera distances

Distance is measured from the middle of the globe, so the surface is at 1. The start view is 3.45 (3.7 on phones), flying to a story ends at 3.05, and the closest zoom is 1.45 (it was 1.65 before the sharper Earth). Detail starts only after a deliberate zoom, so opening the page or flying to a story never downloads it.

| Layer | Starts to appear | Fully shown | File | Size |
|---|---|---|---|---|
| Lighter Earth | always | always | `public/assets/earth.jpg` (2048 x 1024) | about 340 KB |
| Sharp Earth | fetched at 2.7 or closer | swapped in when loaded | `public/assets/earth-sharp.jpg` (4096 x 2048) | about 1.4 MB |
| Country borders | fetched at 2.95 or closer, fade from 2.9 | 2.3 (never above 60% opacity) | `public/assets/borders.json` | about 105 KB, 33 KB compressed |
| Country and city names | fetched at 2.95 or closer, first names at 2.85 | each name fades in over 0.12 of zoom | `public/assets/places.json` | about 16 KB, 8 KB compressed |

Every layer is fetched once. A failure keeps what is already showing and is not retried. The sharp Earth is skipped when the reader's phone has Data Saver on or the graphics card cannot hold a 4096 pixel texture. `data-earth-detail` (`base`, `loading`, `sharp`, `failed`), `data-borders` and `data-places` (both `idle`, `loading`, `ready`, `failed`) on the globe element show the state, which the browser checks use.

## Where the data comes from

- **Earth pictures:** NASA Blue Marble Next Generation (January, with land height and ocean depth). `earth-sharp.jpg` is the file `example/img/earth-blue-marble.jpg` from the npm package `three-globe@2.45.6`, and `earth.jpg` is a downscale of it. NASA's own download site could not be reached from the build workspace, so the copy was not compared byte for byte with NASA's file. Details and the verification step are in `public/ASSETS.md`.
- **Country borders:** Natural Earth 4.1.0 (public domain), 1:50 million scale, through the npm package `world-atlas@2.0.2` (a development tool only). `scripts/build-borders.mjs` keeps only the borders two countries share (coastlines are in the Earth picture already) and writes integers in hundredths of a degree, with each point stored as the step from the one before. Rebuild with `npm run borders:build`. `npm run borders:check` and the test suite fail if the committed file is not exactly what the script produces.

Natural Earth draws boundaries as they are on the ground today and disclaims accuracy, and some borders are disputed. The About panel says boundaries are approximate. A different disclaimer is a copy change in `src/App.tsx` and may need General Counsel.

## Country and city names

Names are small pieces of text (not part of the picture), so they stay sharp at any zoom. The numbers live in `src/lib/places.ts` and the drawing in `src/lib/globe.js`.

- **When a name may show:** every name has a tier from 1 to 4 and appears only once the camera is at or below the tier's distance. Countries: 2.85, 2.5, 2.15, 1.85. Cities: 2.45, 2.05, 1.8, 1.62 (so every tier is fully shown by the closest zoom, 1.45). The start view (3.45, or 3.7 on phones) and the flight to a story (3.05) show no names. A name fades in over 0.12 of zoom, and fades out as it nears the edge of the globe.
- **Where it shows:** on every drawn frame the globe works out which names fit. Names are tried in priority order (tier 1 first, bigger places first), and a name is kept only if it lies fully inside the globe area and does not overlap an earlier name, a story pin (including the label beside the selected pin), or any button, the view switch or the story card drawn on top of the globe. So a crowded spot always keeps the more important name, and nothing is half hidden.
- **How it is drawn:** plain text elements in a layer under the pins. The layer ignores touches and mouse clicks, so rotating, tapping a pin and swiping a story all behave as before, and screen readers skip it (the stories are in the list and on the pins). Country names are small spaced capitals, city names are plain text beside a small dot.
- **Data:** `scripts/build-places.mjs` builds `public/assets/places.json` from two Natural Earth 5.1.2 files (public domain), each checked against a SHA-256 recorded in the script. Rebuild with `npm run places:build` (it downloads the files); `npm run places:check` fails if the committed file differs. The rules for what gets a name (only places with an ISO 3166-1 country code; national capitals plus cities of 2 million or more; a short table of shortened or corrected names) are in the header of the script and in `public/ASSETS.md`, and General Counsel should confirm them.
- **Failure:** a failed or damaged names file simply shows no names and is not retried.

## The night sky

The stars behind the globe are decorative: a made-up scatter, not a map of the real sky. `src/lib/stars.ts` builds three layers from a fixed seed (so everyone sees the same sky): 8,000 faint stars, 2,000 medium ones and 360 bright ones, all on a sphere of radius 18 behind the camera (the camera never goes past 5). About 40% of the faint stars are pulled into a soft band tilted 62 degrees, like a galaxy seen edge on, and each star has a pale blue, white or warm tint. Only a small slice of the sky is in view at once (the camera sees about 40 degrees), which is why there are thousands. A fourth layer of 24 brilliant stars stands out like the brightest stars in a real sky. Orion is drawn from the published positions of its seven main stars: the belt (Alnitak, Alnilam, Mintaka) and the hourglass corners (Betelgeuse in orange and Bellatrix on top, Rigel and Saiph below), as small blue-white dots in the upper left of the view, just outside the globe. The shape and proportions are real and it stands upright with east on the left, as seen from the northern hemisphere. It is drawn at 45% of life size, because the real figure is about 18 degrees tall and does not fit beside the globe, and the rest of the sky is invented, so its place in it is arbitrary. A browser check and unit tests keep all seven stars clear of the globe at the phone start (3.7), the desktop start (3.45) and after the flight to a story (3.05). Nothing moves, so the sky costs nothing while the globe is still and needs no reduced-motion handling. No data is fetched.

## Limits worth knowing

- A picture of the whole planet runs out of detail up close. The sharp Earth is about twice as crisp as the light one at the closest zoom and still soft. Street-level detail needs map tiles, which would mean phones contacting a tile service (a Content Security Policy change that goes through General Counsel first) or tiles built from NASA's 21600 x 10800 file.
- Names cover countries and the biggest cities only. Small towns, regions, rivers and oceans are not named, and a city under a story pin or a button is skipped on purpose.
- Nothing here contacts another origin: every file is served from the app, so `connect-src 'self'` and `img-src 'self'` are unchanged.
- Borders are drawn as 1 pixel lines just above the surface, split into pieces of at most 1.5 degrees so long straight borders follow the curve of the globe.
