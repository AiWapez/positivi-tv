import { useState } from 'react';
import { storyPhoto } from '../lib/story-images';
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
    <StoryArt story={story} decorative /><span className="story-copy"><span className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{story.location}</span>{story.provenance === 'publisher_feed' && story.lat !== null && <span className="meta">Approximate area</span>}{story.attribution && <span className="meta">By {story.attribution.author} · {story.sourceName}</span>}<strong>{story.title}</strong><span className="meta">{dateLabel(story)}{story.isDemo ? '' : ` · ${provenanceLabel(story)}`}{read ? ' · Read' : ''}</span></span><span className="card-arrow" aria-hidden="true"><Icon name="arrow" /></span>
  </button><StoryImageCredit story={story} compact />{story.attribution && <div className="story-attribution"><a href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Original article</a><span> · </span><a href={story.attribution.licenseUrl} target="_blank" rel="license noopener noreferrer">{story.attribution.licenseName}</a><span> · Headline unchanged</span></div>}</div>;
}
export default function SelectedStoryCard({ story, saved, onSave, onClose, onNext, onReadSample }: { story: Story; saved: boolean; onSave: () => void; onClose: () => void; onNext: () => void; onReadSample: () => void }) {
  const event = eventLabel(story), qualifiers = qualifierLabels(story);
  // On phones the card starts as a slim strip so the globe keeps its room, and the tab opens the full card.
  // The photo and its credit hide together, while the byline, date and license stay visible. Other screens always show the full card.
  const [open, setOpen] = useState(false);
  return <article id="selected" className={`selected${open ? '' : ' is-compact'}`} aria-label="Selected story">
    <button className="card-tab" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="selected-more">{open ? 'Hide details' : 'Show details'}</button>
    <button className="save-toggle" onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save story'} aria-pressed={saved}><Icon name="bookmark" /></button>
    <button className="close" onClick={onClose} aria-label="Close selected story"><Icon name="close" /></button>
    <StoryArt story={story} /><div className="selected-body"><div className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{story.location} · {story.category}</div>{story.attribution && <div className="meta">By {story.attribution.author} · {story.sourceName}</div>}<h2>{story.title}</h2><div className="meta">{dateLabel(story)}</div>
      {story.attribution && <div className="story-attribution"><a href={story.attribution.licenseUrl} target="_blank" rel="license noopener noreferrer">{story.attribution.licenseName}</a> · Headline unchanged</div>}
      <div id="selected-more" className="card-more">
        {!story.isDemo && <div className="event-meta">{provenanceLabel(story)}</div>}
        {event && <div className="event-meta">{event}</div>}
        {qualifiers.map(text => <div key={text} className="event-meta">{text}</div>)}
        <StoryImageCredit story={story} />
        {story.mapArea && <div className="story-attribution"><a href={story.mapArea.referenceUrl} target="_blank" rel="noopener noreferrer">Map reference <Icon name="external" /></a></div>}
        <div className="actions">{story.isDemo ? <button className="primary" onClick={onReadSample}>Read story <Icon name="external" /></button> : <a className="primary" href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Read story <Icon name="external" /></a>}<button className="secondary" onClick={onNext}>Next location <Icon name="arrow" /></button></div>
      </div>
    </div>
  </article>;
}
