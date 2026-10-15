const paths = {
  satellite: '<rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)"/><path d="M5.5 8.5 8.5 5.5M15.5 18.5l3-3M3 11l6-6M15 21l6-6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h.1M3 12h.1M3 18h.1"/>',
  stories: '<rect x="5" y="3" width="14" height="17" rx="2"/><path d="M9 7h6M9 11h6M9 15h4M2 7v14h13"/>',
  bookmark: '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  compass: '<path d="m21 3-6 18-4-8-8-4zM11 13 21 3"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M3 3l5 5M21 3l-5 5M21 21l-5-5M3 21l5-5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', external: '<path d="M8 5h11v11M19 5 5 19"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3M17 14l4 4-4 4M3 18h3c2 0 4-2 5-5M14 8c1-1 2-2 4-2h3M17 2l4 4-4 4"/>',
  sliders: '<path d="M3 7h8M15 7h6M3 17h3M10 17h11M11 4v6M7 14v6"/>', mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6M6 9h12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .1-2-.5-2.5 3-.3 6-1.5 6-6a5 5 0 0 0-1.3-3.5c.1-.5.5-2-.2-3.5 0 0-1.1-.4-3.6 1.3a13 13 0 0 0-6.8 0C6.1 2.1 5 2.5 5 2.5c-.7 1.5-.3 3-.2 3.5a5 5 0 0 0-1.3 3.5c0 4.5 3 5.7 6 6-.6.5-.6 1.5-.5 2.5v4"/>',
};
export function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.globe}</svg>`; }
