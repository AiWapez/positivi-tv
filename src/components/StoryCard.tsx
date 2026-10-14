import Icon from './Icon';
import { CATEGORY_COLORS } from '../types';
import type { Story } from '../types';
import { dateLabel, eventLabel, provenanceLabel, qualifierLabels } from '../lib/story-utils';
export function StoryArt({ story, decorative = false }: { story: Story; decorative?: boolean }) {
  return story.image ? <img src={story.image} alt={decorative ? '' : story.imageAlt} loading="lazy" width="170" height="168" />
    : <div className={`story-art category-${story.category.toLowerCase()}`} aria-hidden="true"><Icon name="globe" /></div>;
}
export function StoryButton({ story, selected, onSelect }: { story: Story; selected: boolean; onSelect: (id: string) => void }) {
  return <div className="story-entry"><button className="story" aria-pressed={selected} onClick={() => onSelect(story.id)}>
    <StoryArt story={story} decorative /><span className="story-copy"><span className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{story.location}</span>{story.provenance === 'publisher_feed' && story.lat !== null && <span className="meta">Approximate area</span>}{story.attribution && <span className="meta">By {story.attribution.author} · {story.sourceName}</span>}<strong>{story.title}</strong><span className="meta">{dateLabel(story)}{story.isDemo ? '' : ` · ${provenanceLabel(story)}`}</span></span><span className="card-arrow" aria-hidden="true"><Icon name="arrow" /></span>
  </button>{story.attribution && <div className="story-attribution"><a href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Original article</a><span> · </span><a href={story.attribution.licenseUrl} target="_blank" rel="license noopener noreferrer">{story.attribution.licenseName}</a><span> · Headline unchanged</span></div>}</div>;
}
export default function SelectedStoryCard({ story, saved, onSave, onClose, onNext, onReadSample }: { story: Story; saved: boolean; onSave: () => void; onClose: () => void; onNext: () => void; onReadSample: () => void }) {
  const event = eventLabel(story), qualifiers = qualifierLabels(story);
  return <article id="selected" className="selected" aria-label="Selected story">
    <button className="save-toggle" onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save story'} aria-pressed={saved}><Icon name="bookmark" /></button>
    <button className="close" onClick={onClose} aria-label="Close selected story"><Icon name="close" /></button>
    <StoryArt story={story} /><div className="selected-body"><div className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{story.location} · {story.category}</div>{story.attribution && <div className="meta">By {story.attribution.author} · {story.sourceName}</div>}<h2>{story.title}</h2><div className="meta">{dateLabel(story)}</div>
      {story.attribution && <div className="story-attribution"><a href={story.attribution.licenseUrl} target="_blank" rel="license noopener noreferrer">{story.attribution.licenseName}</a> · Headline unchanged</div>}
      {!story.isDemo && <div className="event-meta">{provenanceLabel(story)}</div>}
      {event && <div className="event-meta">{event}</div>}
      {qualifiers.map(text => <div key={text} className="event-meta">{text}</div>)}
      {story.mapArea && <div className="story-attribution"><a href={story.mapArea.referenceUrl} target="_blank" rel="noopener noreferrer">Map reference <Icon name="external" /></a></div>}
      <div className="actions">{story.isDemo ? <button className="primary" onClick={onReadSample}>Read story <Icon name="external" /></button> : <a className="primary" href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Read story <Icon name="external" /></a>}<button className="secondary" onClick={onNext}>Next location <Icon name="arrow" /></button></div>
    </div>
  </article>;
}
