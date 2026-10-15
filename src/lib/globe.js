import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CATEGORY_COLORS as categories } from '../types/index.ts';
import { GLOBE_FOV_DEGREES, START_DISTANCE, touchWindowDiameter } from './globe-touch.ts';
import { BASE_EARTH_URL, MAX_ZOOM_DISTANCE, MIN_ZOOM_DISTANCE, SHARP_EARTH_URL, bordersOpacity, shouldLoadBorders, shouldLoadSharpEarth } from './globe-detail.ts';
import { BORDERS_URL, borderSegments, decodeBorders } from './borders.ts';
import { buildStarLayers } from './stars.ts';
import { decorativeOrbits, satellitePosition } from './satellites.ts';
import { SKY_STAR_RADIUS, hiddenByEarth, isSpaceStory, skyPosition, storyPlace } from './space-stories.ts';
import { CITY_FONT_PX, COUNTRY_FONT_PX, PLACES_URL, chooseLabels, decodePlaces, facingOpacity, labelBox, labelWidth, nameOpacity, shouldLoadPlaces } from './places.ts';

const point = (lat, lng, r = 1) => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};
export async function createGlobe({ host, stage, markerHost, touchHost, getMode, onError, onSelect }) {
  let renderer, controls, observer, frameId = 0, disposed = false, dirty = true, last = 0, flight = null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(GLOBE_FOV_DEGREES, 1, .1, 100);
  const markers = new Map(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const markDirty = () => { dirty = true; };
  // Country and city names live in their own layer under the story pins. They are decoration only: the layer never takes touches and screen readers skip it.
  const labelHost = document.createElement('div'); labelHost.className = 'place-labels'; labelHost.setAttribute('aria-hidden', 'true'); markerHost.before(labelHost);
  const cancelTravel = () => { flight = null; };
  // On touch screens only a round area the size of the globe on screen listens for fingers, so the page can scroll anywhere outside it.
  let touchSize = 0;
  const fitTouch = () => { if (!touchHost) return; const size = touchWindowDiameter(camera.position.length(), host.clientHeight, host.clientWidth); if (size && size !== touchSize) { touchSize = size; touchHost.style.setProperty('--touch-d', `${size}px`); } };
  const contextLost = event => { event.preventDefault(); onError(new Error('WebGL context was lost. Use the list or reload to restore Earth.')); };
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(frameId); observer?.disconnect();
    document.removeEventListener('visibilitychange', markDirty); reduced.removeEventListener('change', markDirty);
    controls?.removeEventListener('start', cancelTravel); controls?.removeEventListener('change', markDirty); controls?.dispose();
    renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
    const textures = new Set(); scene.traverse(node => { node.geometry?.dispose(); const materials = Array.isArray(node.material) ? node.material : [node.material]; for (const material of materials) if (material) { if (material.map) textures.add(material.map); material.dispose(); } });
    for (const texture of textures) texture.dispose();
    for (const marker of markers.values()) marker.el.remove(); markers.clear(); labelHost.remove();
    renderer?.dispose(); renderer?.domElement.remove();
  }
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement); camera.position.copy(point(20, 5, matchMedia('(max-width: 767px)').matches ? START_DISTANCE.phone : START_DISTANCE.default));
    controls = new OrbitControls(camera, touchHost ?? renderer.domElement);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = .07; controls.rotateSpeed = .55; controls.zoomSpeed = .65;
    controls.minDistance = MIN_ZOOM_DISTANCE; controls.maxDistance = MAX_ZOOM_DISTANCE; controls.minPolarAngle = .05; controls.maxPolarAngle = Math.PI - .05; controls.update(); controls.saveState();
    const prepare = picture => { picture.colorSpace = THREE.SRGBColorSpace; picture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return picture; };
    const earth = new THREE.MeshPhongMaterial({ map: prepare(await new THREE.TextureLoader().loadAsync(BASE_EARTH_URL)), shininess: 5, specular: 0x223344 });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earth));
    // The sharp picture is fetched once, the first time the reader zooms in close. Any failure keeps the lighter picture and is not retried.
    let sharp = 'base'; host.dataset.earthDetail = sharp;
    const setSharp = state => { sharp = state; host.dataset.earthDetail = state; };
    const upgradeEarth = () => {
      if (!shouldLoadSharpEarth({ distance: camera.position.length(), saveData: !!navigator.connection?.saveData, maxTextureSize: renderer.capabilities.maxTextureSize, requested: sharp !== 'base' })) return;
      setSharp('loading');
      new THREE.TextureLoader().loadAsync(SHARP_EARTH_URL).then(picture => {
        if (disposed) { picture.dispose(); return; }
        const lighter = earth.map; earth.map = prepare(picture); lighter?.dispose(); setSharp('sharp'); dirty = true;
      }).catch(() => { if (!disposed) setSharp('failed'); });
    };
    // Country borders (Natural Earth, bundled with the app) are fetched once, the first time the reader zooms in, and fade in as the camera comes closer.
    // A failed fetch simply draws no borders and is not retried.
    let borderState = 'idle', borderLayer = null, borderShownAt = 0; host.dataset.borders = borderState;
    const setBorders = state => { borderState = state; host.dataset.borders = state; };
    const loadBorders = () => {
      if (!shouldLoadBorders({ distance: camera.position.length(), requested: borderState !== 'idle' })) return;
      setBorders('loading');
      fetch(BORDERS_URL).then(response => { if (!response.ok) throw new Error(`borders ${response.status}`); return response.json(); }).then(file => {
        if (disposed) return;
        const positions = borderSegments(decodeBorders(file)); if (!positions.length) throw new Error('no borders');
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        borderLayer = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf4f7ff, transparent: true, opacity: 0, depthWrite: false }));
        borderLayer.visible = false; scene.add(borderLayer); borderShownAt = performance.now(); setBorders('ready'); dirty = true;
      }).catch(() => { if (!disposed) setBorders('failed'); });
    };
    // Country and city names (Natural Earth, bundled with the app) are fetched once, the first time the reader zooms in. Which names show, and where,
    // is worked out on every drawn frame so that no name covers another name or a story pin. A failed fetch simply shows no names and is not retried.
    let placeState = 'idle', places = [], drawn = []; host.dataset.places = placeState;
    const setPlaces = state => { placeState = state; host.dataset.places = state; };
    const loadPlaces = () => {
      if (!shouldLoadPlaces({ distance: camera.position.length(), requested: placeState !== 'idle' })) return;
      setPlaces('loading');
      fetch(PLACES_URL).then(response => { if (!response.ok) throw new Error(`places ${response.status}`); return response.json(); }).then(file => {
        if (disposed) return;
        const decoded = decodePlaces(file); if (!decoded.length) throw new Error('no places');
        places = decoded.map(place => ({ ...place, unit: point(place.lat, place.lng, 1), width: 0, el: null })); setPlaces('ready'); dirty = true;
      }).catch(() => { if (!disposed) setPlaces('failed'); });
    };
    const ruler = document.createElement('canvas').getContext('2d'); let family = '';
    const measure = (text, weight, size) => { if (!ruler) return text.length * size * .62; family ||= getComputedStyle(labelHost).fontFamily; ruler.font = `${weight} ${size}px ${family}`; return ruler.measureText(text).width; };
    const widthOf = place => place.kind === 'country' ? labelWidth('country', measure(place.name.toUpperCase(), 600, COUNTRY_FONT_PX), place.name.length) : labelWidth('city', measure(place.name, 500, CITY_FONT_PX), place.name.length);
    const toward = new THREE.Vector3(), onScreen = new THREE.Vector3();
    // Buttons, the view switch and the story card sit on top of the globe on some screens. Names keep out from under them, so none is half hidden.
    const overlayBoxes = () => {
      const base = stage.getBoundingClientRect(), boxes = [];
      for (const el of stage.parentElement?.querySelectorAll('.view-switch, .map-summary, .map-controls, .globe-status, .globe-footer, .credit, #selected') ?? []) {
        const r = el.getBoundingClientRect(); if (r.width && r.height) boxes.push({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top });
      }
      return boxes;
    };
    const drawPlaces = obstacles => {
      const distance = camera.position.length(), bounds = { left: 0, top: 0, right: stage.clientWidth, bottom: stage.clientHeight }, candidates = [];
      if (placeState === 'ready') for (const place of places) {
        const strength = nameOpacity(place.kind, place.tier, distance); if (strength <= 0) continue;
        toward.copy(camera.position).sub(place.unit);
        const alpha = strength * facingOpacity(place.unit.dot(toward) / toward.length()); if (alpha < .03) continue;
        onScreen.copy(place.unit).project(camera); if (onScreen.z >= 1) continue;
        const x = Math.round((onScreen.x * .5 + .5) * bounds.right), y = Math.round((-onScreen.y * .5 + .5) * bounds.bottom);
        place.width ||= widthOf(place);
        candidates.push({ place, alpha, x, y, box: labelBox(place.kind, x, y, place.width) });
      }
      const kept = chooseLabels(candidates, obstacles, bounds), shown = new Set();
      for (const { place, alpha, x, y } of kept) {
        if (!place.el) { place.el = document.createElement('span'); place.el.className = `place place-${place.kind}`; place.el.textContent = place.name; place.el.hidden = true; labelHost.appendChild(place.el); drawn.push(place); }
        place.el.style.transform = `translate(${x}px,${y}px)`; place.el.style.opacity = alpha.toFixed(2); place.el.hidden = false; shown.add(place);
      }
      for (const place of drawn) if (!shown.has(place) && !place.el.hidden) place.el.hidden = true;
    };
    scene.add(new THREE.AmbientLight(0xffffff, 2.1)); const sunlight = new THREE.DirectionalLight(0xdcefff, 2); scene.add(sunlight);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { glowColor: { value: new THREE.Color('#339FFF') } },
      vertexShader: 'varying vec3 n; varying vec3 eye; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader: 'uniform vec3 glowColor; varying vec3 n; varying vec3 eye; void main(){float rim=pow(1.0-max(dot(normalize(n),normalize(eye)),0.0),3.5);gl_FragColor=vec4(glowColor,rim*0.65);}' })));
    // The opening view looks at the middle of the globe from above Africa (see the camera set-up above); Orion's belt is placed to be seen from there.
    const openingView = point(20, 5).negate().normalize();
    // Made-up satellites (not real objects, no names): small dots drifting round the Earth. The Earth hides them when they pass behind it.
    const orbits = decorativeOrbits(), satelliteGeometry = new THREE.BufferGeometry(); satelliteGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbits.length * 3), 3));
    const satellites = new THREE.Points(satelliteGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: .045, transparent: true, opacity: 1, depthWrite: false })); satellites.frustumCulled = false; satellites.visible = false; scene.add(satellites);
    let satelliteTick = 0;
    const moveSatellites = seconds => { const attribute = satelliteGeometry.attributes.position; orbits.forEach((orbit, n) => attribute.setXYZ(n, ...satellitePosition(orbit, seconds))); attribute.needsUpdate = true; };
    moveSatellites(0);
    for (const sky of buildStarLayers(31, { direction: [openingView.x, openingView.y, openingView.z], up: [0, 1, 0] })) {
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(sky.positions, 3)); starGeometry.setAttribute('color', new THREE.BufferAttribute(sky.colors, 3));
      scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ vertexColors: true, size: sky.size, transparent: true, opacity: sky.opacity, depthWrite: false })));
    }
    controls.addEventListener('start', cancelTravel); controls.addEventListener('change', markDirty);
    const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h || disposed) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fitTouch(); dirty = true; };
    observer = new ResizeObserver(resize); observer.observe(host); resize();
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', markDirty); reduced.addEventListener('change', markDirty);
    function frame(now) {
      if (disposed) return; frameId = requestAnimationFrame(frame);
      if (document.hidden || getMode() === 'list' || now - last < 32) return; last = now;
      if (flight) {
        const t = reduced.matches || !flight.duration ? 1 : Math.min(1, (now - flight.start) / flight.duration), ease = t * t * (3 - 2 * t);
        const from = flight.from.clone().normalize(), to = flight.to.clone().normalize(), q = new THREE.Quaternion().setFromUnitVectors(from, to);
        camera.position.copy(from.applyQuaternion(new THREE.Quaternion().slerp(q, ease)).multiplyScalar(THREE.MathUtils.lerp(flight.from.length(), flight.to.length(), ease)));
        if (t === 1) flight = null; dirty = true;
      }
      controls.update(); upgradeEarth(); loadBorders(); loadPlaces();
      // The dots drift about ten times a second; with reduced motion they stay where they are.
      if (satellites.visible && !reduced.matches && now - satelliteTick > 100) { satelliteTick = now; moveSatellites(now / 1000); dirty = true; }
      if (!dirty) return; dirty = false;
      const covered = placeState === 'ready' ? overlayBoxes() : [];
      if (borderLayer) {
        const arrival = reduced.matches ? 1 : Math.min(1, (now - borderShownAt) / 450), opacity = bordersOpacity(camera.position.length()) * arrival;
        borderLayer.material.opacity = opacity; borderLayer.visible = opacity > 0.005; if (arrival < 1) dirty = true;
      }
      sunlight.position.copy(camera.position).add(new THREE.Vector3(-2, 2, 1)); camera.updateMatrixWorld(); renderer.render(scene, camera); fitTouch();
      const obstacles = [...covered];
      for (const marker of markers.values()) {
        const normal = marker.p.clone().normalize(), view = camera.position.clone().sub(marker.p).normalize(), screen = marker.p.clone().project(camera);
        // A space star floats above the globe, so it is hidden only when the Earth is in the way; a pin sits on the surface and is hidden past the horizon.
        const facing = marker.sky ? !hiddenByEarth(camera.position.toArray(), marker.p.toArray()) : normal.dot(view) > .025;
        const visible = facing && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && screen.z < 1;
        marker.el.hidden = !visible;
        if (visible) {
          const x = (screen.x * .5 + .5) * stage.clientWidth, y = (-screen.y * .5 + .5) * stage.clientHeight;
          marker.el.style.left = `${x}px`; marker.el.style.top = `${y}px`;
          // Names keep clear of every pin, and of the label that opens beside the selected pin (it sits left of the pin: see .pin-label in the styles).
          obstacles.push({ left: x - 17, right: x + 17, top: y - 17, bottom: y + 17 });
          if (marker.el.getAttribute('aria-pressed') === 'true') { const w = measure(String(marker.location ?? ''), 400, 12) + 26; obstacles.push({ left: x - 21 - w, right: x - 21, top: y - 13, bottom: y + 17 }); }
        }
      }
      drawPlaces(obstacles);
    }
    frameId = requestAnimationFrame(frame);
    return {
      update(items, selected, read = {}) {
        // Stories with a place on Earth get a pin; NASA stories about space, which have no place, get a star floating above the globe.
        const located = [...items.filter(s => Number.isFinite(s.lat) && s.lat >= -90 && s.lat <= 90 && Number.isFinite(s.lng) && s.lng >= -180 && s.lng <= 180), ...items.filter(isSpaceStory)];
        const ids = new Set(located.map(s => s.id));
        for (const [id, marker] of markers) if (!ids.has(id)) { marker.el.remove(); markers.delete(id); }
        for (const s of located) {
          let marker = markers.get(s.id);
          const star = isSpaceStory(s), place = storyPlace(s), spot = star ? skyPosition(s.id) : s, radius = star ? SKY_STAR_RADIUS : 1.015;
          if (!marker) {
            const el = document.createElement('button'); el.className = star ? 'pin pin-star' : 'pin'; el.dataset.story = s.id; el.hidden = true;
            const dot = document.createElement('span'); dot.className = 'pin-dot'; const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = place;
            el.append(dot, label); el.onclick = () => onSelect(s.id); markerHost.appendChild(el); marker = { el, p: point(spot.lat, spot.lng, radius), location: place, sky: star }; markers.set(s.id, marker);
          }
          // A new story version can move or rename its pin; keep the marker in step with the current data.
          marker.p = point(spot.lat, spot.lng, radius); marker.location = place; marker.sky = star; marker.el.classList.toggle('pin-star', star); marker.el.querySelector('.pin-label').textContent = place;
          marker.el.style.setProperty('--pin-color', categories[s.category]); marker.el.setAttribute('aria-label', `${place}: ${s.title}${s.isDemo ? '. Design sample.' : star ? '. A space story, shown as a star above the globe.' : s.provenance === 'publisher_feed' ? '. Approximate area, not an exact event site.' : ''}${read[s.id] ? ' Read.' : ''}`); marker.el.setAttribute('aria-pressed', String(selected === s.id));
          // Opened stories dim until the next daily update removes them.
          marker.el.classList.toggle('read', !!read[s.id]);
        }
        resize(); dirty = true;
      },
      // The made-up satellites start hidden; the reader switches them on with a button in the globe controls.
      setSatellites(on) { satellites.visible = !!on; if (on) moveSatellites(performance.now() / 1000); dirty = true; },
      flyTo(lat, lng, distance = 3.05) { if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(distance)) return; flight = { start: performance.now(), from: camera.position.clone(), to: point(lat, lng, distance), duration: reduced.matches ? 0 : 1050 }; dirty = true; },
      zoom(factor) { flight = null; camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance)); controls.update(); dirty = true; },
      reset() { flight = null; controls.reset(); dirty = true; }, redraw: markDirty, dispose,
    };
  } catch (error) { dispose(); throw error; }
}
