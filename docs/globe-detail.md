# Globe zoom detail

What the globe shows as a reader zooms in, and the rules that keep it light on phones. The numbers live in `src/lib/globe-detail.ts`; the drawing lives in `src/lib/globe.js`.

## Camera distances

Distance is measured from the middle of the globe, so the surface is at 1. The start view is 3.45 (3.7 on phones), flying to a story ends at 3.05, and the closest zoom is 1.45 (it was 1.65 before the sharper Earth). Detail starts only after a deliberate zoom, so opening the page or flying to a story never downloads it.

| Layer | Starts to appear | Fully shown | File | Size |
|---|---|---|---|---|
| Lighter Earth | always | always | `public/assets/earth.jpg` (2048 x 1024) | about 340 KB |
| Sharp Earth | fetched at 2.7 or closer | swapped in when loaded | `public/assets/earth-sharp.jpg` (4096 x 2048) | about 1.4 MB |
| Country borders | fetched at 2.95 or closer, fade from 2.9 | 2.3 (never above 60% opacity) | `public/assets/borders.json` | about 105 KB, 33 KB compressed |

Every layer is fetched once. A failure keeps what is already showing and is not retried. The sharp Earth is skipped when the reader's phone has Data Saver on or the graphics card cannot hold a 4096 pixel texture. `data-earth-detail` (`base`, `loading`, `sharp`, `failed`) and `data-borders` (`idle`, `loading`, `ready`, `failed`) on the globe element show the state, which the browser checks use.

## Where the data comes from

- **Earth pictures:** NASA Blue Marble Next Generation (January, with land height and ocean depth). `earth-sharp.jpg` is the file `example/img/earth-blue-marble.jpg` from the npm package `three-globe@2.45.6`, and `earth.jpg` is a downscale of it. NASA's own download site could not be reached from the build workspace, so the copy was not compared byte for byte with NASA's file. Details and the verification step are in `public/ASSETS.md`.
- **Country borders:** Natural Earth 4.1.0 (public domain), 1:50 million scale, through the npm package `world-atlas@2.0.2` (a development tool only). `scripts/build-borders.mjs` keeps only the borders two countries share (coastlines are in the Earth picture already) and writes integers in hundredths of a degree, with each point stored as the step from the one before. Rebuild with `npm run borders:build`. `npm run borders:check` and the test suite fail if the committed file is not exactly what the script produces.

Natural Earth draws boundaries as they are on the ground today and disclaims accuracy, and some borders are disputed. The About panel says boundaries are approximate. A different disclaimer is a copy change in `src/App.tsx` and may need General Counsel.

## Limits worth knowing

- A picture of the whole planet runs out of detail up close. The sharp Earth is about twice as crisp as the light one at the closest zoom and still soft. Street-level detail needs map tiles, which would mean phones contacting a tile service (a Content Security Policy change that goes through General Counsel first) or tiles built from NASA's 21600 x 10800 file.
- Nothing here contacts another origin: every file is served from the app, so `connect-src 'self'` and `img-src 'self'` are unchanged.
- Borders are drawn as 1 pixel lines just above the surface, split into pieces of at most 1.5 degrees so long straight borders follow the curve of the globe.
