import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './components/Icon';
import GlobeScene from './components/GlobeScene';
import type { GlobeControls } from './components/GlobeScene';
import SelectedStoryCard, { StoryButton, StoryArt } from './components/StoryCard';
import StoryDialog from './components/StoryDialog';
import ReaderInfo from './components/ReaderInfo';
import { useSavedStories } from './hooks/useSavedStories';
import { useStoryFeed } from './hooks/useStoryFeed';
import { useReadStories } from './hooks/useReadStories';
import { useCountryFacts } from './hooks/useCountryFacts';
import { CountryPage } from './components/CountryFacts';
import { useAnimalFacts } from './hooks/useAnimalFacts';
import { isRecent, unreadFirst } from './lib/reading';
import { isSpaceStory, skyView, storyPlace } from './lib/space-stories';
import { CATEGORY_COLORS } from './types';
import type { Story, Filters, CategoryFilter } from './types';
import { filterStories, nextStory, dateLabel } from './lib/story-utils';
import { swipeStories, neighborStory, swipePosition } from './lib/story-swipe';
import { stories as demoStories, DEMO_DATE } from './data/demo.mjs';
const periods = { '30': 'Past 30 days', '7': 'Past 7 days', all: 'All dates' };
const repo = 'https://github.com/AiWapez/positivi-tv';
export default function App() {
  const [demo, setDemo] = useState(() => new URLSearchParams(location.search).get('demo') === '1');
  const { feed, loading, error, refresh, confirm } = useStoryFeed();
  const { saved, toggle, clear, storageWarning } = useSavedStories();
  const { read, markRead, clearRead } = useReadStories();
  const [showPrevious, setShowPrevious] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  // Category chips: tucked under search until it is tapped, and always in the scrolling dock at the bottom.
  const [searchOpen, setSearchOpen] = useState(false);
  // Stories opened during this visit keep their list position; they move below unread ones next visit.
  const [visitStart] = useState(() => Date.now());
  const [filters, setFilters] = useState<Filters>({ category: 'All', query: '', period: '30', savedOnly: false });
  const [mode, setMode] = useState<'globe' | 'list'>('globe'), [selectedId, setSelected] = useState<string | null>(demo ? 'portugal' : null);
  const [dialog, setDialog] = useState<'about' | 'filters' | 'sample' | 'privacy' | 'terms' | 'country' | null>(null), [message, setMessage] = useState('');
  const [satellitesOn, setSatellitesOn] = useState(false);
  const [globeReady, setGlobeReady] = useState(false), [globeFailed, setGlobeFailed] = useState(false), [expanded, setExpanded] = useState(false);
  const [enterFrom, setEnterFrom] = useState<'next' | 'previous' | null>(null), stepping = useRef(false);
  const globe = useRef<GlobeControls>(null), explorer = useRef<HTMLElement>(null), discovery = useRef<HTMLButtonElement>(null);
  const items: Story[] = demo ? demoStories as Story[] : feed.stories;
  const visible = useMemo(() => filterStories(items, filters, saved, demo ? Date.parse(DEMO_DATE) : Date.now()), [items, filters, saved, demo]);
  // New this week = first collected in the last 7 days. Older stories wait behind "Previous positive stories".
  const clock = demo ? Date.parse(DEMO_DATE) : Date.now();
  const recent = visible.filter(s => isRecent(s, clock));
  const view = filters.savedOnly || showPrevious ? visible : recent;
  const olderCount = filters.savedOnly ? 0 : visible.length - recent.length;
  const listed = demo ? view : unreadFirst(view, Object.fromEntries(Object.entries(read).filter(([, at]) => Date.parse(at) < visitStart)));
  // Every story in view keeps its pin. Opened ones are only dimmed (see the read class in globe.js).
  const pins = view;
  const unreadCount = view.filter(s => !read[s.id]).length;
  const selected = view.find(s => s.id === selectedId) ?? null;
  const countryInfo = useCountryFacts(selected), animalInfo = useAnimalFacts(selected);
  // Swiping the card moves through the stories that have a pin, in the same order as the Stories list.
  const swipeList = swipeStories(listed, selectedId), position = swipePosition(swipeList, selectedId);
  // The globe summary appears once per daily update on this device, then fades away.
  const updateId = demo ? '' : feed.revision;
  useEffect(() => {
    if (!updateId || !feed.stories.length) return;
    let seen: string | null = null;
    try { seen = localStorage.getItem('positivitv.update-seen.v1'); } catch { /* show it this visit only */ }
    if (seen === updateId) return;
    try { localStorage.setItem('positivitv.update-seen.v1', updateId); } catch { /* nothing stored */ }
    setSummaryVisible(true);
  }, [updateId, feed.stories.length]);
  useEffect(() => { if (!summaryVisible) return; const t = setTimeout(() => setSummaryVisible(false), 7000); return () => clearTimeout(t); }, [summaryVisible]);
  const openedLiveEdition = useRef(false);
  useEffect(() => {
    if (demo || openedLiveEdition.current || !feed.stories.length) return;
    openedLiveEdition.current = true;
    const fresh = feed.stories.filter(s => isRecent(s, Date.now()));
    const pick = fresh.find(s => s.lat !== null && s.lng !== null && !read[s.id]) ?? fresh.find(s => s.lat !== null && s.lng !== null) ?? fresh[0];
    if (pick) setSelected(pick.id);
  }, [demo, feed.stories]);
  useEffect(() => {
    if (!globeReady || !selected) return;
    if (selected.lat !== null && selected.lng !== null) globe.current?.flyTo(selected.lat, selected.lng);
    else if (isSpaceStory(selected)) { const view = skyView(selected.id); globe.current?.flyTo(view.lat, view.lng, view.distance); }
    else globe.current?.reset();
  }, [globeReady, selected?.id, selected?.version]);
  function reset() { setFilters({ category: 'All', query: '', period: '30', savedOnly: false }); setShowPrevious(false); setMessage('Filters reset.'); }
  function changeMode(next: 'globe' | 'list') { setMode(next); setFilters(f => ({ ...f, savedOnly: false })); }
  async function select(id: string, options: { scroll?: boolean; from?: 'next' | 'previous' } = {}) {
    const s = view.find(s => s.id === id); if (!s) return;
    if (!s.isDemo && !await confirm(s)) { setMessage('That story is no longer available in the current edition.'); return; }
    setSelected(id); setMode('globe'); setEnterFrom(options.from ?? null); if (!s.isDemo) markRead(id);
    setMessage(`Selected ${s.title}, ${storyPlace(s)}.${s.isDemo ? ' Design sample.' : ''}`);
    if (options.scroll !== false && matchMedia('(max-width: 767px)').matches) explorer.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function discover(random = false) {
    // Prefer stories this reader has not opened yet.
    const fresh = view.filter(s => !read[s.id] || s.id === selectedId), base = fresh.some(s => s.id !== selectedId) ? fresh : view;
    const mapped = base.filter(s => s.lat !== null && s.lng !== null);
    const pool = mode === 'globe' && mapped.some(s => s.id !== selectedId) ? mapped : base;
    const s = nextStory(pool, selectedId, random); if (s) void select(s.id);
  }
  async function step(direction: 1 | -1) {
    if (stepping.current) return;
    const target = neighborStory(swipeList, selectedId, direction);
    if (!target || target.id === selectedId) return;
    stepping.current = true;
    try { await select(target.id, { scroll: false, from: direction === 1 ? 'next' : 'previous' }); } finally { stepping.current = false; }
  }
  function toggleSave(s: Story) { toggle(s.id); setMessage(saved.has(s.id) ? 'Story removed from saved.' : 'Story saved.'); }
  function switchDemo(value: boolean) { setDemo(value); setSelected(value ? 'portugal' : null); setDialog(null); reset(); const url = new URL(location.href); value ? url.searchParams.set('demo','1') : url.searchParams.delete('demo'); history.replaceState(null, '', url); }
  async function expand() {
    const node = explorer.current!;
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (expanded) { setExpanded(false); return; }
    try { if (node.requestFullscreen) await node.requestFullscreen(); else setExpanded(true); } catch { setExpanded(true); }
  }
  useEffect(() => { const sync = () => { setExpanded(!!document.fullscreenElement); globe.current?.redraw(); }; document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync); }, []);
  useEffect(() => {
    if (!expanded) return;
    const nodes = document.querySelectorAll<HTMLElement>('.topbar,.sidebar,.mobile-nav,.reader-footer,.category-dock'); nodes.forEach(el => { el.inert = true; }); document.body.classList.add('globe-expanded');
    const key = (e: KeyboardEvent) => {
      if (dialog) return;
      if (e.key === 'Escape' && !document.fullscreenElement) setExpanded(false);
      if (e.key === 'Tab') { const all = [...explorer.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length); const first = all[0], last = all[all.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    document.addEventListener('keydown', key);
    return () => { nodes.forEach(el => { el.inert = false; }); document.body.classList.remove('globe-expanded'); document.removeEventListener('keydown', key); };
  }, [expanded, dialog]);
  const hasFilters = filters.query || filters.category !== 'All' || filters.period !== '30' || filters.savedOnly;
  const categoryChips = (keepSearchFocus = false) => Object.entries(CATEGORY_COLORS).map(([name, color]) => <button key={name} className={`chip ${filters.category === name ? 'active' : ''}`} aria-pressed={filters.category === name}
    onPointerDown={keepSearchFocus ? e => e.preventDefault() : undefined} onClick={() => setFilters(f => ({ ...f, category: name as CategoryFilter }))}>{name !== 'All' && <i className="dot" style={{ background: color }} />}{name}</button>);
  const previousToggle = !demo && !filters.savedOnly && (showPrevious || olderCount > 0)
    ? <button className="previous-toggle" aria-pressed={showPrevious} onClick={() => { setShowPrevious(!showPrevious); setMessage(showPrevious ? 'Showing new stories from this week.' : 'Showing previous positive stories too.'); }}>{showPrevious ? 'Back to this week' : `Previous positive stories · ${olderCount}`}<Icon name="arrow" /></button> : null;
  const heading = filters.savedOnly ? 'Saved stories' : demo ? 'Illustrative stories' : showPrevious ? 'All recent stories' : 'New this week';
  const unreadNote = !demo && unreadCount < view.length ? ` · ${unreadCount} unread` : '';
  const quietWeek = !demo && !filters.savedOnly && !showPrevious && !view.length && olderCount > 0 && !hasFilters;
  const empty = quietWeek ? <div className="empty"><span className="empty-icon"><Icon name="globe" /></span><h3>No new stories this week yet.</h3><p>Earlier good news is still waiting for you.</p>{previousToggle}</div> : <div className="empty"><span className="empty-icon"><Icon name={filters.savedOnly ? 'bookmark' : 'globe'} /></span><h3>{filters.savedOnly ? 'Keep a little good.' : hasFilters ? 'No stories match just yet.' : 'Good things are on their way.'}</h3><p>{filters.savedOnly ? 'Save a story to find it here. Your filters still apply.' : hasFilters ? 'Try a different search or a wider date range.' : 'New stories will appear here. You can explore the design with clearly labelled samples.'}</p>{hasFilters ? <button className="secondary" onClick={reset}>Reset filters</button> : <button className="secondary" onClick={() => switchDemo(true)}>Explore sample edition</button>}</div>;
  return <>
    <a href="#search" className="skip">Skip to stories</a><div className="app">
      <header className="topbar"><a className="brand" href="/" aria-label="PositiviTV home"><img className="sun" src="/assets/sun.svg" alt="" width="42" height="42" /><span>Positivi<span className="brand-end">TV</span><sup className="tm" aria-hidden="true">™</sup></span></a>
        <nav className="desktop-nav" aria-label="Main navigation"><button className={`nav ${mode === 'globe' && !filters.savedOnly ? 'active' : ''}`} onClick={() => changeMode('globe')}>Explore</button><button className={`nav ${mode === 'list' && !filters.savedOnly ? 'active' : ''}`} onClick={() => changeMode('list')}>Stories</button><button className="nav" onClick={() => setDialog('about')}>About</button></nav>
        <div className="header-end"><button className="quiet refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh stories"><Icon name="compass" /><span>Refresh</span></button><button id="saved-desktop" className={`quiet ${filters.savedOnly ? 'active' : ''}`} aria-label="Saved stories" aria-pressed={filters.savedOnly} onClick={() => { setFilters(f => ({ ...f, savedOnly: true })); setMode('list'); }}><Icon name="bookmark" /><span className="saved-label">Saved</span><span id="save-count">{saved.size}</span></button><a className="github" href={repo} target="_blank" rel="noopener noreferrer" aria-label="PositiviTV on GitHub, opens in a new tab"><Icon name="github" /><span>GitHub</span></a><button className="mobile-about" aria-label="About PositiviTV" onClick={() => setDialog('about')}><Icon name="menu" /></button></div>
      </header>
      {demo && <div className="edition-banner"><span>Sample edition · Fictional stories · Fixed example dates</span><button onClick={() => switchDemo(false)}>Return to live news <Icon name="arrow" /></button></div>}
      {!demo && feed.publisherFeed?.status === 'stale' && <div className="edition-banner"><span>Feed updates are delayed. Showing earlier reporting with its original dates.</span></div>}
      {!demo && feed.publisherFeed?.status === 'unavailable' && !error && !loading && <div className="edition-banner"><span>Publisher feeds are temporarily unavailable. Any reviewed stories remain available.</span></div>}
      {!demo && error && <div className="edition-banner feed-error" role="alert">{error}<button onClick={() => void refresh()}>Retry</button></div>}
      <main className="workspace"><aside className="sidebar" aria-label="Find stories"><div className="intro"><h1>A world of good.</h1><p>Discover the brighter side of our planet.</p></div><div className="search-area" onFocus={() => setSearchOpen(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchOpen(false); }}><label className="search"><Icon name="search" /><input id="search" type="search" placeholder="Search a place or topic" aria-label="Search a place or topic" value={filters.query} onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} /></label>
        {searchOpen && <div className="categories categories-top" role="group" aria-label="Filter by category">{categoryChips(true)}</div>}</div>
        <label className="period"><Icon name="calendar" /><select aria-label="Story date range" value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value as Filters['period'] }))}>{Object.entries(periods).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="mobile-tools"><span className="mobile-disclosure">{demo ? 'Design samples' : loading ? 'Checking edition…' : `${heading} · ${view.length}${unreadNote}`}</span><button className="filter-button" aria-haspopup="dialog" onClick={() => setDialog('filters')}><Icon name="sliders" />{periods[filters.period]}</button></div>
        <div className="list-heading"><span>{heading} · {view.length}{unreadNote}</span><button className="text-button" onClick={reset}>Reset</button></div>{!quietWeek && previousToggle}<div className="story-list">{view.length ? listed.map(s => <StoryButton key={s.id} story={s} read={!!read[s.id]} selected={selected?.id === s.id} onSelect={select} />) : !demo && loading ? <div className="empty" role="status">Checking the latest stories…</div> : empty}</div>
        <p className="sample-note">{demo ? 'These stories and dates are illustrative, not reported news.' : 'Original publishers and dates. Each story says whether PositiviTV™ reviewed it or it came automatically from publisher feeds. Unlocated stories have no map pin.'}{storageWarning && <span role="status"> Saves are available for this session; browser storage is unavailable.</span>}</p>
      </aside>
      <section className={`explorer ${mode === 'list' ? 'list-mode' : ''} ${!selected ? 'no-selection' : ''} ${expanded && !document.fullscreenElement ? 'expanded' : ''}`} ref={explorer} aria-label="Interactive news globe">
        <div className="view-switch" role="group" aria-label="Choose view">{(['globe','list'] as const).map(view => <button key={view} className={mode === view ? 'active' : ''} aria-pressed={mode === view} onClick={() => setMode(view)}><Icon name={view} />{view === 'globe' ? 'Globe' : 'List'}</button>)}</div>
        {mode === 'globe' && summaryVisible && !!view.length && <div className="map-summary" role="status"><button className="summary-text" onClick={() => setSummaryVisible(false)} aria-label={`New update, ${pins.filter(s => s.lat !== null).length} on the globe. Tap to dismiss.`}>New update · {pins.filter(s => s.lat !== null).length} on the globe</button>{view.some(s => s.lat === null) && <button onClick={() => { setSummaryVisible(false); setMode('list'); }}>{view.filter(s => s.lat === null).length} more in list <Icon name="arrow" /></button>}</div>}
        <GlobeScene ref={globe} stories={pins} read={demo ? {} : read} selected={selected?.id ?? null} satellites={satellitesOn} mode={mode} onSelect={select} onReady={setGlobeReady} onError={() => setGlobeFailed(true)} />
        {mode === 'globe' && (!globeReady || !view.length) && <div className="globe-status" role="status">{globeFailed ? <>The globe couldn’t load. Every story is still available in the list.<button className="primary" onClick={() => setMode('list')}>Browse stories <Icon name="arrow" /></button></> : !globeReady ? 'Loading our world…' : loading && !demo ? 'Checking the latest stories…' : empty}</div>}
        <div className="map-controls" role="group" aria-label="Globe controls" hidden={mode === 'list'}><button aria-label="Zoom in" disabled={!globeReady} onClick={() => globe.current?.zoom(.85)}><Icon name="plus" /></button><button aria-label="Zoom out" disabled={!globeReady} onClick={() => globe.current?.zoom(1/.85)}><Icon name="minus" /></button><button aria-label="Reset globe orientation" disabled={!globeReady} onClick={() => globe.current?.reset()}><Icon name="compass" /></button><button aria-label={expanded ? 'Exit expanded globe' : 'Expand globe'} onClick={() => void expand()}><Icon name="expand" /></button><button className="satellite-button" aria-pressed={satellitesOn} aria-label={satellitesOn ? 'Hide made-up satellites' : 'Show made-up satellites'} title={satellitesOn ? 'Hide made-up satellites' : 'Show made-up satellites'} disabled={!globeReady} onClick={() => setSatellitesOn(on => !on)}><Icon name="satellite" /></button></div>
        <div className="list-view" hidden={mode !== 'list'}><div className="list-view-heading"><div><p className="eyebrow">A little perspective</p><h2>Good news, wherever you look.</h2></div><span className="meta">{heading} · {view.length}{unreadNote}{demo ? ' · Design samples' : ''}</span></div>{!quietWeek && previousToggle}<div id="list-grid">{view.length ? listed.map(s => <StoryButton key={s.id} story={s} read={!!read[s.id]} selected={selected?.id === s.id} onSelect={select} />) : empty}</div></div>
        {selected && mode === 'globe' && <SelectedStoryCard key={selected.id} story={selected} saved={saved.has(selected.id)} position={position} enterFrom={enterFrom} onSave={() => toggleSave(selected)} onClose={() => { setSelected(null); discovery.current?.focus(); }} onStep={direction => void step(direction)} onReadSample={() => setDialog('sample')} country={countryInfo} onOpenCountry={() => setDialog('country')} animal={animalInfo} />}
        <div className="globe-footer"><span className="hint"><Icon name="mouse" />Drag to rotate · Scroll to zoom · Select a pin</span><button className="surprise" ref={discovery} disabled={!view.length} onClick={() => discover(true)}><Icon name="shuffle" />Take me somewhere good</button></div><a className="credit" href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noopener noreferrer">Earth imagery: NASA / Blue Marble</a>
      </section></main>
      <nav className="category-dock" aria-label="Story categories">{categoryChips()}</nav>
      <footer className="reader-footer" aria-label="Reader information"><div><button onClick={() => setDialog('about')}>About</button><button onClick={() => setDialog('privacy')}>Privacy</button><button onClick={() => setDialog('terms')}>Terms &amp; sources</button></div><p className="builder-credit">Built by Ian Alexander Ventures LLC · © 2026</p></footer>
      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={mode === 'globe' && !filters.savedOnly ? 'active' : ''} aria-pressed={mode === 'globe' && !filters.savedOnly} onClick={() => changeMode('globe')}><Icon name="globe" />Explore</button><button className={mode === 'list' && !filters.savedOnly ? 'active' : ''} aria-pressed={mode === 'list' && !filters.savedOnly} onClick={() => changeMode('list')}><Icon name="stories" />Stories</button><button className={filters.savedOnly ? 'active' : ''} aria-pressed={filters.savedOnly} onClick={() => { setFilters(f => ({ ...f, savedOnly: true })); setMode('list'); }}><Icon name="bookmark" />Saved<span className="sr-only">{saved.size} saved</span></button></nav>
    </div>
    <StoryDialog open={dialog !== null} onClose={() => setDialog(null)}>
      {(dialog === 'privacy' || dialog === 'terms') && <ReaderInfo page={dialog} savedCount={saved.size} onClear={() => { clear(); setMessage('Saved stories cleared from this device.'); }} readCount={Object.keys(read).length} onClearRead={() => { clearRead(); setMessage('Reading history cleared from this device.'); }} />}
      {dialog === 'country' && countryInfo && <CountryPage info={countryInfo} />}
      {dialog === 'about' && <><p className="eyebrow">PositiviTV™</p><h2 id="dialog-title">A world of good.</h2><p className="about-tagline">Good news. Open to everyone.</p><p>Constructive stories, with their sources intact. A free window onto the brighter side of our planet, built to explore and share.</p><div className="sample-callout"><strong>Two clearly labelled kinds of story</strong><p><b>Reviewed by PositiviTV™</b> stories were checked for constructive outcomes, evidence and event dates before an editor approved them. <b>From publisher feeds</b> stories were picked automatically from permitted publisher feeds by simple, conservative rules. They are not individually reviewed, the rules can make mistakes, and their event dates are not confirmed. Refresh reads the latest saved stories; it never starts a new search or fabricates stories. Map pins are approximate. They come from a place named in the headline or from the location the publisher gives for the story, and each card says which.</p></div><p>Earth: NASA Blue Marble. Country borders and place names: Natural Earth, public domain. Borders and names are approximate and don't express any view by PositiviTV™ about disputed places. Country facts: CIA World Factbook, frozen public archive, public domain. Animal facts: Wikidata, public domain (CC0), each one matched automatically against Wikipedia. Sample photos: Unsplash. Inter: Rasmus Andersson, SIL Open Font License. Globe: Three.js, MIT. NASA, NOAA, the CIA, the IUCN and the publishers we link to don't endorse PositiviTV™.</p><div className="about-actions"><a className="primary" href={repo} target="_blank" rel="noopener noreferrer">View on GitHub <Icon name="external" /></a><button className="secondary" onClick={() => switchDemo(!demo)}>{demo ? 'Live news' : 'Try sample edition'}</button></div></>}
      {dialog === 'filters' && <><p className="eyebrow">Your view of the world</p><h2 id="dialog-title">Choose a date range.</h2><div className="date-options">{Object.entries(periods).map(([value,label]) => <button key={value} className={`date-option ${filters.period === value ? 'active' : ''}`} aria-pressed={filters.period === value} onClick={() => { setFilters(f => ({ ...f, period: value as Filters['period'] })); setDialog(null); }}><Icon name="calendar" />{label}</button>)}</div><p className="filter-note">{demo ? 'Fixed sample dates around October 14, 2026.' : 'Filters use original publication dates. Event dates and archive labels remain visible on each story.'}</p></>}
      {dialog === 'sample' && selected?.isDemo && <><StoryArt story={selected} /><p className="eyebrow">{selected.location} · {selected.category}</p><h2 id="dialog-title">{selected.title}</h2><p>{selected.summary}</p><div className="sample-callout"><strong>Design sample</strong><p>This fictional story has no publisher or original article. {dateLabel(selected)} is a fixed example date.</p></div><p className="image-credit">{selected.imageCredit}</p><button className="primary" onClick={() => toggleSave(selected)} aria-pressed={saved.has(selected.id)}><Icon name="bookmark" />{saved.has(selected.id) ? 'Remove from saved' : 'Save story'}</button></>}
    </StoryDialog><div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div>
  </>;
}
