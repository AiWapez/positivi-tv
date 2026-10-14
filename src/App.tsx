import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './components/Icon';
import GlobeScene from './components/GlobeScene';
import type { GlobeControls } from './components/GlobeScene';
import SelectedStoryCard, { StoryButton, StoryArt } from './components/StoryCard';
import StoryDialog from './components/StoryDialog';
import ReaderInfo from './components/ReaderInfo';
import { useSavedStories } from './hooks/useSavedStories';
import { useStoryFeed } from './hooks/useStoryFeed';
import { CATEGORY_COLORS } from './types';
import type { Story, Filters, CategoryFilter } from './types';
import { filterStories, nextStory, dateLabel } from './lib/story-utils';
import { stories as demoStories, DEMO_DATE } from './data/demo.mjs';
const periods = { '30': 'Past 30 days', '7': 'Past 7 days', all: 'All dates' };
const repo = 'https://github.com/AiWapez/positivi-tv';
export default function App() {
  const [demo, setDemo] = useState(() => new URLSearchParams(location.search).get('demo') === '1');
  const { feed, loading, error, refresh, confirm } = useStoryFeed();
  const { saved, toggle, clear, storageWarning } = useSavedStories();
  const [filters, setFilters] = useState<Filters>({ category: 'All', query: '', period: '30', savedOnly: false });
  const [mode, setMode] = useState<'globe' | 'list'>('globe'), [selectedId, setSelected] = useState<string | null>(demo ? 'portugal' : null);
  const [dialog, setDialog] = useState<'about' | 'filters' | 'sample' | 'privacy' | 'terms' | null>(null), [message, setMessage] = useState('');
  const [globeReady, setGlobeReady] = useState(false), [globeFailed, setGlobeFailed] = useState(false), [expanded, setExpanded] = useState(false);
  const globe = useRef<GlobeControls>(null), explorer = useRef<HTMLElement>(null), discovery = useRef<HTMLButtonElement>(null);
  const items: Story[] = demo ? demoStories as Story[] : feed.stories;
  const visible = useMemo(() => filterStories(items, filters, saved, demo ? Date.parse(DEMO_DATE) : Date.now()), [items, filters, saved, demo]);
  const selected = visible.find(s => s.id === selectedId) ?? null;
  useEffect(() => { if (globeReady && selected?.lat != null && selected?.lng != null) globe.current?.flyTo(selected.lat, selected.lng); }, [globeReady, selected?.id, selected?.version]);
  function reset() { setFilters({ category: 'All', query: '', period: '30', savedOnly: false }); setMessage('Filters reset.'); }
  function changeMode(next: 'globe' | 'list') { setMode(next); setFilters(f => ({ ...f, savedOnly: false })); }
  async function select(id: string) {
    const s = visible.find(s => s.id === id); if (!s) return;
    if (!s.isDemo && !await confirm(s)) { setMessage('That story is no longer available in the current edition.'); return; }
    setSelected(id); setMode('globe');
    setMessage(`Selected ${s.title}, ${s.location}.${s.isDemo ? ' Design sample.' : ''}`);
    if (matchMedia('(max-width: 767px)').matches) explorer.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function discover(random = false) { const s = nextStory(visible, selectedId, random); if (s) void select(s.id); }
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
    const nodes = document.querySelectorAll<HTMLElement>('.topbar,.sidebar,.mobile-nav,.reader-footer'); nodes.forEach(el => { el.inert = true; }); document.body.classList.add('globe-expanded');
    const key = (e: KeyboardEvent) => {
      if (dialog) return;
      if (e.key === 'Escape' && !document.fullscreenElement) setExpanded(false);
      if (e.key === 'Tab') { const all = [...explorer.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length); const first = all[0], last = all[all.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    document.addEventListener('keydown', key);
    return () => { nodes.forEach(el => { el.inert = false; }); document.body.classList.remove('globe-expanded'); document.removeEventListener('keydown', key); };
  }, [expanded, dialog]);
  const hasFilters = filters.query || filters.category !== 'All' || filters.period !== '30' || filters.savedOnly;
  const empty = <div className="empty"><span className="empty-icon"><Icon name={filters.savedOnly ? 'bookmark' : 'globe'} /></span><h3>{filters.savedOnly ? 'Keep a little good.' : hasFilters ? 'No stories match just yet.' : 'Good things are on their way.'}</h3><p>{filters.savedOnly ? 'Save a story to find it here. Your filters still apply.' : hasFilters ? 'Try a different search or a wider date range.' : 'New stories will appear here. You can explore the design with clearly labelled samples.'}</p>{hasFilters ? <button className="secondary" onClick={reset}>Reset filters</button> : <button className="secondary" onClick={() => switchDemo(true)}>Explore sample edition</button>}</div>;
  return <>
    <a href="#search" className="skip">Skip to stories</a><div className="app">
      <header className="topbar"><a className="brand" href="/" aria-label="PositiviTV home"><img className="sun" src="/assets/sun.svg" alt="" width="42" height="42" /><span>Positivi<span className="brand-end">TV</span></span></a>
        <nav className="desktop-nav" aria-label="Main navigation"><button className={`nav ${mode === 'globe' && !filters.savedOnly ? 'active' : ''}`} onClick={() => changeMode('globe')}>Explore</button><button className={`nav ${mode === 'list' && !filters.savedOnly ? 'active' : ''}`} onClick={() => changeMode('list')}>Stories</button><button className="nav" onClick={() => setDialog('about')}>About</button></nav>
        <div className="header-end"><button className="quiet refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh stories"><Icon name="compass" /><span>Refresh</span></button><button id="saved-desktop" className={`quiet ${filters.savedOnly ? 'active' : ''}`} aria-label="Saved stories" aria-pressed={filters.savedOnly} onClick={() => { setFilters(f => ({ ...f, savedOnly: true })); setMode('list'); }}><Icon name="bookmark" /><span className="saved-label">Saved</span><span id="save-count">{saved.size}</span></button><a className="github" href={repo} target="_blank" rel="noopener noreferrer" aria-label="PositiviTV on GitHub, opens in a new tab"><Icon name="github" /><span>GitHub</span></a><button className="mobile-about" aria-label="About PositiviTV" onClick={() => setDialog('about')}><Icon name="menu" /></button></div>
      </header>
      {demo && <div className="edition-banner"><span>Sample edition · Fictional stories · Fixed example dates</span><button onClick={() => switchDemo(false)}>Return to live news <Icon name="arrow" /></button></div>}
      {!demo && feed.publisherFeed?.status === 'stale' && <div className="edition-banner"><span>Feed updates are delayed. Showing earlier reporting with its original dates.</span></div>}
      {!demo && feed.publisherFeed?.status === 'unavailable' && !error && !loading && <div className="edition-banner"><span>Publisher feeds are temporarily unavailable. Any reviewed stories remain available.</span></div>}
      {!demo && error && <div className="edition-banner feed-error" role="alert">{error}<button onClick={() => void refresh()}>Retry</button></div>}
      <main className="workspace"><aside className="sidebar" aria-label="Find stories"><div className="intro"><h1>A world of good.</h1><p>Discover the brighter side of our planet.</p></div><label className="search"><Icon name="search" /><input id="search" type="search" placeholder="Search a place or topic" aria-label="Search a place or topic" value={filters.query} onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} /></label>
        <div className="categories" role="group" aria-label="Filter by category">{Object.entries(CATEGORY_COLORS).map(([name,color]) => <button key={name} className={`chip ${filters.category === name ? 'active' : ''}`} aria-pressed={filters.category === name} onClick={() => setFilters(f => ({ ...f, category: name as CategoryFilter }))}>{name !== 'All' && <i className="dot" style={{ background: color }} />}{name}</button>)}</div>
        <label className="period"><Icon name="calendar" /><select aria-label="Story date range" value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value as Filters['period'] }))}>{Object.entries(periods).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="mobile-tools"><span className="mobile-disclosure">{demo ? 'Design samples' : loading ? 'Checking edition…' : `${items.length} stories`}</span><button className="filter-button" aria-haspopup="dialog" onClick={() => setDialog('filters')}><Icon name="sliders" />{periods[filters.period]}</button></div>
        <div className="list-heading"><span>{filters.savedOnly ? 'Saved' : demo ? 'Illustrative' : 'Current'} stories · {visible.length}</span><button className="text-button" onClick={reset}>Reset</button></div><div className="story-list">{visible.length ? visible.map(s => <StoryButton key={s.id} story={s} selected={selected?.id === s.id} onSelect={select} />) : !demo && loading ? <div className="empty" role="status">Checking the latest stories…</div> : empty}</div>
        <p className="sample-note">{demo ? 'These stories and dates are illustrative, not reported news.' : 'Original publishers and dates. Each story says whether PositiviTV reviewed it or it came automatically from publisher feeds. Unlocated stories have no map pin.'}{storageWarning && <span role="status"> Saves are available for this session; browser storage is unavailable.</span>}</p>
      </aside>
      <section className={`explorer ${mode === 'list' ? 'list-mode' : ''} ${!selected ? 'no-selection' : ''} ${expanded && !document.fullscreenElement ? 'expanded' : ''}`} ref={explorer} aria-label="Interactive news globe">
        <div className="view-switch" role="group" aria-label="Choose view">{(['globe','list'] as const).map(view => <button key={view} className={mode === view ? 'active' : ''} aria-pressed={mode === view} onClick={() => setMode(view)}><Icon name={view} />{view === 'globe' ? 'Globe' : 'List'}</button>)}</div>
        <GlobeScene ref={globe} stories={visible} selected={selected?.id ?? null} mode={mode} onSelect={select} onReady={setGlobeReady} onError={() => setGlobeFailed(true)} />
        {mode === 'globe' && (!globeReady || !visible.length) && <div className="globe-status" role="status">{globeFailed ? <>The globe couldn’t load. Every story is still available in the list.<button className="primary" onClick={() => setMode('list')}>Browse stories <Icon name="arrow" /></button></> : !globeReady ? 'Loading our world…' : loading && !demo ? 'Checking the latest stories…' : empty}</div>}
        <div className="map-controls" role="group" aria-label="Globe controls" hidden={mode === 'list'}><button aria-label="Zoom in" disabled={!globeReady} onClick={() => globe.current?.zoom(.85)}><Icon name="plus" /></button><button aria-label="Zoom out" disabled={!globeReady} onClick={() => globe.current?.zoom(1/.85)}><Icon name="minus" /></button><button aria-label="Reset globe orientation" disabled={!globeReady} onClick={() => globe.current?.reset()}><Icon name="compass" /></button><button aria-label={expanded ? 'Exit expanded globe' : 'Expand globe'} onClick={() => void expand()}><Icon name="expand" /></button></div>
        <div className="list-view" hidden={mode !== 'list'}><div className="list-view-heading"><div><p className="eyebrow">A little perspective</p><h2>Good news, wherever you look.</h2></div><span className="meta">{visible.length} stories{demo ? ' · Design samples' : ''}</span></div><div id="list-grid">{visible.length ? visible.map(s => <StoryButton key={s.id} story={s} selected={selected?.id === s.id} onSelect={select} />) : empty}</div></div>
        {selected && mode === 'globe' && <SelectedStoryCard story={selected} saved={saved.has(selected.id)} onSave={() => toggleSave(selected)} onClose={() => { setSelected(null); discovery.current?.focus(); }} onNext={() => discover()} onReadSample={() => setDialog('sample')} />}
        <div className="globe-footer"><span className="hint"><Icon name="mouse" />Drag to rotate · Scroll to zoom · Select a pin</span><button className="surprise" ref={discovery} disabled={!visible.length} onClick={() => discover(true)}><Icon name="shuffle" />Take me somewhere good</button></div><a className="credit" href="https://visibleearth.nasa.gov/images/57723/the-blue-marble" target="_blank" rel="noopener noreferrer">Earth imagery: NASA / Blue Marble</a>
      </section></main>
      <footer className="reader-footer" aria-label="Reader information"><span>Good news. Open to everyone.</span><div><button onClick={() => setDialog('about')}>About</button><button onClick={() => setDialog('privacy')}>Privacy</button><button onClick={() => setDialog('terms')}>Terms &amp; sources</button></div></footer>
      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={mode === 'globe' && !filters.savedOnly ? 'active' : ''} aria-pressed={mode === 'globe' && !filters.savedOnly} onClick={() => changeMode('globe')}><Icon name="globe" />Explore</button><button className={mode === 'list' && !filters.savedOnly ? 'active' : ''} aria-pressed={mode === 'list' && !filters.savedOnly} onClick={() => changeMode('list')}><Icon name="stories" />Stories</button><button className={filters.savedOnly ? 'active' : ''} aria-pressed={filters.savedOnly} onClick={() => { setFilters(f => ({ ...f, savedOnly: true })); setMode('list'); }}><Icon name="bookmark" />Saved<span className="sr-only">{saved.size} saved</span></button></nav>
    </div>
    <StoryDialog open={dialog !== null} onClose={() => setDialog(null)}>
      {(dialog === 'privacy' || dialog === 'terms') && <ReaderInfo page={dialog} savedCount={saved.size} onClear={() => { clear(); setMessage('Saved stories cleared from this device.'); }} />}
      {dialog === 'about' && <><p className="eyebrow">PositiviTV</p><h2 id="dialog-title">A world of good.</h2><p>Constructive stories, with their sources intact. A free window onto the brighter side of our planet, built to explore and share.</p><div className="sample-callout"><strong>Two clearly labelled kinds of story</strong><p><b>Reviewed by PositiviTV</b> stories were checked for constructive outcomes, evidence and event dates before an editor approved them. <b>From publisher feeds</b> stories were picked automatically from permitted publisher feeds by simple, conservative rules. They are not individually reviewed, the rules can make mistakes, and their event dates are not confirmed. Refresh reads the latest saved stories; it never starts a new search or fabricates stories.</p></div><p>Earth: NASA / Blue Marble. Sample photos: Unsplash. Inter: Rasmus Andersson, SIL Open Font License. Globe: Three.js, MIT.</p><div className="about-actions"><a className="primary" href={repo} target="_blank" rel="noopener noreferrer">View on GitHub <Icon name="external" /></a><button className="secondary" onClick={() => switchDemo(!demo)}>{demo ? 'Live news' : 'Try sample edition'}</button></div></>}
      {dialog === 'filters' && <><p className="eyebrow">Your view of the world</p><h2 id="dialog-title">Choose a date range.</h2><div className="date-options">{Object.entries(periods).map(([value,label]) => <button key={value} className={`date-option ${filters.period === value ? 'active' : ''}`} aria-pressed={filters.period === value} onClick={() => { setFilters(f => ({ ...f, period: value as Filters['period'] })); setDialog(null); }}><Icon name="calendar" />{label}</button>)}</div><p className="filter-note">{demo ? 'Fixed sample dates around October 14, 2026.' : 'Filters use original publication dates. Event dates and archive labels remain visible on each story.'}</p></>}
      {dialog === 'sample' && selected?.isDemo && <><StoryArt story={selected} /><p className="eyebrow">{selected.location} · {selected.category}</p><h2 id="dialog-title">{selected.title}</h2><p>{selected.summary}</p><div className="sample-callout"><strong>Design sample</strong><p>This fictional story has no publisher or original article. {dateLabel(selected)} is a fixed example date.</p></div><p className="image-credit">{selected.imageCredit}</p><button className="primary" onClick={() => toggleSave(selected)} aria-pressed={saved.has(selected.id)}><Icon name="bookmark" />{saved.has(selected.id) ? 'Remove from saved' : 'Save story'}</button></>}
    </StoryDialog><div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div>
  </>;
}
