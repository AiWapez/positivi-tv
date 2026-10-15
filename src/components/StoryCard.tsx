import { useRef, useState } from 'react';
import { storyPhoto } from '../lib/story-images';
import { storyPlace } from '../lib/space-stories';
import { swipeIntent } from '../lib/story-swipe';
import Icon from './Icon';
import { CATEGORY_COLORS } from '../types';
import type { Story } from '../types';
import { dateLabel, eventLabel, provenanceLabel, qualifierLabels } from '../lib/story-utils';
export function StoryArt({ story, decorative = false }: { story: Story; decorative?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return story.image && failed !== story.image ? <img src={story.image} alt={decorative ? '' : story.imageAlt} loading="lazy" width="330" height="220" onError={() => setFailed(story.image)} />
    : <div className={`story-art category-${story.category.toLowerCase()}`} aria-hidden="true"><Icon name="globe" /></div>;
}
export function StoryImageCredit({ story, compact = false }: { story: Story; compact?: boolean }) {
  const photo = storyPhoto(story);
  return photo ? <div className="photo-credit"><span>{compact ? photo.kind === 'place' ? 'Location photo · Not the event' : 'Illustrative photo · Not the event' : photo.caption}</span><span><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">Photo: {photo.credit}</a><span> · </span><a href={photo.licenseUrl} target="_blank" rel="license noopener noreferrer">{photo.licenseName}</a>{!compact && ' · Thumbnail resized; may be cropped for display'}</span></div> : null;
}
export function StoryButton({ story, selected, onSelect, read = false }: { story: Story; selected: boolean; onSelect: (id: string) => void; read?: boolean }) {
  return <div className={`story-entry${read ? ' is-read' : ''}`}><button className="story" aria-pressed={selected} onClick={() => onSelect(story.id)}>
    <StoryArt story={story} decorative /><span className="story-copy"><span className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{storyPlace(story)}</span>{story.provenance === 'publisher_feed' && story.lat !== null && <span className="meta">Approximate area</span>}{story.attribution && <span className="meta">By {story.attribution.author} · {story.sourceName}</span>}<strong>{story.title}</strong><span className="meta">{dateLabel(story)}{story.isDemo ? '' : ` · ${provenanceLabel(story)}`}{read ? ' · Read' : ''}</span></span><span className="card-arrow" aria-hidden="true"><Icon name="arrow" /></span>
  </button><StoryImageCredit story={story} compact />{story.attribution && <div className="story-attribution"><a href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Original article</a><span> · </span><a href={story.attribution.licenseUrl} target="_blank" rel="license noopener noreferrer">{story.attribution.licenseName}</a><span> · Headline unchanged</span></div>}</div>;
}
/** Under the card on phones: one dot per story (or a count when there are many), so the swipe is easy to discover. */
function SwipeDots({ position }: { position: { index: number; total: number } }) {
  return <div className="card-pager" aria-hidden="true">{position.total <= 7
    ? Array.from({ length: position.total }, (_, i) => <i key={i} className={i === position.index ? 'on' : ''} />)
    : <span>{position.index + 1} of {position.total}</span>}</div>;
}
interface CardProps {
  story: Story; saved: boolean; position: { index: number; total: number } | null; enterFrom: 'next' | 'previous' | null;
  onSave: () => void; onClose: () => void; onStep: (direction: 1 | -1) => void; onReadSample: () => void;
}
export default function SelectedStoryCard({ story, saved, position, enterFrom, onSave, onClose, onStep, onReadSample }: CardProps) {
  const event = eventLabel(story), qualifiers = qualifierLabels(story);
  // On phones the card starts as a slim strip so the globe keeps its room, and the tab opens the full card.
  // The photo and its credit hide together, while the byline, date and license stay visible. Other screens always show the full card.
  const [open, setOpen] = useState(false);
  // Swiping the card sideways moves to the next or previous story. Only fingers and pens swipe; a mouse never does.
  // The card allows vertical scrolling (touch-action: pan-y), so scrolling the page is never mistaken for a swipe.
  const start = useRef<{ x: number; y: number; at: number; id: number } | null>(null);
  const begin = (e: React.PointerEvent) => { start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, at: e.timeStamp, id: e.pointerId }; };
  const finish = (e: React.PointerEvent) => {
    const from = start.current; start.current = null;
    if (!from || from.id !== e.pointerId || !position) return;
    const intent = swipeIntent(e.clientX - from.x, e.clientY - from.y, e.timeStamp - from.at);
    if (intent) onStep(intent === 'next' ? 1 : -1);
  };
  return <article id="selected" className={`selected${open ? '' : ' is-compact'}`} data-enter={enterFrom ?? undefined} aria-label="Selected story"
    onPointerDown={begin} onPointerUp={finish} onPointerCancel={() => { start.current = null; }}>
    <button className="card-tab" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="selected-more">{open ? 'Hide details' : 'Show details'}</button>
    <button className="save-toggle" onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save story'} aria-pressed={saved}><Icon name="bookmark" /></button>
    <button className="close" onClick={onClose} aria-label="Close selected story"><Icon name="close" /></button>
    <StoryArt story={story} /><div className="selected-body"><div className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{storyPlace(story)} · {story.category}</div>{story.attribution && <div className="meta">By {story.attribution.author} · {story.sourceName}</div>}<h2>{story.title}</h2><div className="meta">{dateLabel(story)}</div>
      {story.attribution && <div className="story-attribution"><a href={story.attribution.licenseUrl} target="_blank" rel="license noopener noreferrer">{story.attribution.licenseName}</a> · Headline unchanged</div>}
      <div id="selected-more" className="card-more">
        {!story.isDemo && <div className="event-meta">{provenanceLabel(story)}</div>}
        {event && <div className="event-meta">{event}</div>}
        {qualifiers.map(text => <div key={text} className="event-meta">{text}</div>)}
        <StoryImageCredit story={story} />
        {story.mapArea && <div className="story-attribution"><a href={story.mapArea.referenceUrl} target="_blank" rel="noopener noreferrer">Map reference <Icon name="external" /></a></div>}
        <div className="actions">{story.isDemo ? <button className="primary" onClick={onReadSample}>Read story <Icon name="external" /></button> : <a className="primary" href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Read story <Icon name="external" /></a>}
          <div className="stepper">{position && <button className="secondary" onClick={() => onStep(-1)}><span className="flip"><Icon name="arrow" /></span> Previous location</button>}<button className="secondary" onClick={() => onStep(1)}>Next location <Icon name="arrow" /></button></div></div>
      </div>
    </div>
    {position && <><SwipeDots position={position} /><span className="sr-only">Story {position.index + 1} of {position.total}. Swipe left or right to move between stories.</span></>}
  </article>;
}
