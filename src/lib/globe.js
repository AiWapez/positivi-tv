import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CATEGORY_COLORS as categories } from '../types/index.ts';
import { GLOBE_FOV_DEGREES, START_DISTANCE, touchWindowDiameter } from './globe-touch.ts';
import { BASE_EARTH_URL, MAX_ZOOM_DISTANCE, MIN_ZOOM_DISTANCE, SHARP_EARTH_URL, bordersOpacity, shouldLoadBorders, shouldLoadSharpEarth } from './globe-detail.ts';
import { BORDERS_URL, borderSegments, decodeBorders } from './borders.ts';

const point = (lat, lng, r = 1) => {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};
export async function createGlobe({ host, stage, markerHost, touchHost, getMode, onError, onSelect }) {
  let renderer, controls, observer, frameId = 0, disposed = false, dirty = true, last = 0, flight = null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(GLOBE_FOV_DEGREES, 1, .1, 100);
  const markers = new Map(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const markDirty = () => { dirty = true; };
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
    for (const marker of markers.values()) marker.el.remove(); markers.clear();
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
    scene.add(new THREE.AmbientLight(0xffffff, 2.1)); const sunlight = new THREE.DirectionalLight(0xdcefff, 2); scene.add(sunlight);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { glowColor: { value: new THREE.Color('#339FFF') } },
      vertexShader: 'varying vec3 n; varying vec3 eye; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader: 'uniform vec3 glowColor; varying vec3 n; varying vec3 eye; void main(){float rim=pow(1.0-max(dot(normalize(n),normalize(eye)),0.0),3.5);gl_FragColor=vec4(glowColor,rim*0.65);}' })));
    const stars = []; let seed = 31; const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 550; i++) { const v = new THREE.Vector3(random() - .5, random() - .5, random() - .5).normalize().multiplyScalar(18); stars.push(v.x, v.y, v.z); }
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xa8c8ec, size: .021, transparent: true, opacity: .48, depthWrite: false })));
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
      controls.update(); upgradeEarth(); loadBorders(); if (!dirty) return; dirty = false;
      if (borderLayer) {
        const arrival = reduced.matches ? 1 : Math.min(1, (now - borderShownAt) / 450), opacity = bordersOpacity(camera.position.length()) * arrival;
        borderLayer.material.opacity = opacity; borderLayer.visible = opacity > 0.005; if (arrival < 1) dirty = true;
      }
      sunlight.position.copy(camera.position).add(new THREE.Vector3(-2, 2, 1)); camera.updateMatrixWorld(); renderer.render(scene, camera); fitTouch();
      for (const marker of markers.values()) {
        const normal = marker.p.clone().normalize(), view = camera.position.clone().sub(marker.p).normalize(), screen = marker.p.clone().project(camera);
        const visible = normal.dot(view) > .025 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && screen.z < 1;
        marker.el.hidden = !visible;
        if (visible) { marker.el.style.left = `${(screen.x * .5 + .5) * stage.clientWidth}px`; marker.el.style.top = `${(-screen.y * .5 + .5) * stage.clientHeight}px`; }
      }
    }
    frameId = requestAnimationFrame(frame);
    return {
      update(items, selected, read = {}) {
        const located = items.filter(s => Number.isFinite(s.lat) && s.lat >= -90 && s.lat <= 90 && Number.isFinite(s.lng) && s.lng >= -180 && s.lng <= 180);
        const ids = new Set(located.map(s => s.id));
        for (const [id, marker] of markers) if (!ids.has(id)) { marker.el.remove(); markers.delete(id); }
        for (const s of located) {
          let marker = markers.get(s.id);
          if (!marker) {
            const el = document.createElement('button'); el.className = 'pin'; el.dataset.story = s.id; el.hidden = true;
            const dot = document.createElement('span'); dot.className = 'pin-dot'; const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = s.location;
            el.append(dot, label); el.onclick = () => onSelect(s.id); markerHost.appendChild(el); marker = { el, p: point(s.lat, s.lng, 1.015) }; markers.set(s.id, marker);
          }
          // A new story version can move or rename its pin; keep the marker in step with the current data.
          marker.p = point(s.lat, s.lng, 1.015); marker.el.querySelector('.pin-label').textContent = s.location;
          marker.el.style.setProperty('--pin-color', categories[s.category]); marker.el.setAttribute('aria-label', `${s.location}: ${s.title}${s.isDemo ? '. Design sample.' : s.provenance === 'publisher_feed' ? '. Approximate area, not an exact event site.' : ''}${read[s.id] ? ' Read.' : ''}`); marker.el.setAttribute('aria-pressed', String(selected === s.id));
          // Opened stories dim until the next daily update removes them.
          marker.el.classList.toggle('read', !!read[s.id]);
        }
        resize(); dirty = true;
      },
      flyTo(lat, lng) { if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; flight = { start: performance.now(), from: camera.position.clone(), to: point(lat, lng, 3.05), duration: reduced.matches ? 0 : 1050 }; dirty = true; },
      zoom(factor) { flight = null; camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance)); controls.update(); dirty = true; },
      reset() { flight = null; controls.reset(); dirty = true; }, redraw: markDirty, dispose,
    };
  } catch (error) { dispose(); throw error; }
}
