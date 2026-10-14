import Icon from './Icon';
import { CATEGORY_COLORS } from '../types';
import type { Story } from '../types';
import { dateLabel, eventLabel } from '../lib/story-utils';
export function StoryArt({ story, decorative = false }: { story: Story; decorative?: boolean }) {
  return story.image ? <img src={story.image} alt={decorative ? '' : story.imageAlt} loading="lazy" width="170" height="168" />
    : <div className={`story-art category-${story.category.toLowerCase()}`} aria-hidden="true"><Icon name="globe" /></div>;
}
export function StoryButton({ story, selected, onSelect }: { story: Story; selected: boolean; onSelect: (id: string) => void }) {
  return <button className="story" aria-pressed={selected} onClick={() => onSelect(story.id)}>
    <StoryArt story={story} decorative /><span className="story-copy"><span className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{story.location}</span><strong>{story.title}</strong><span className="meta">{dateLabel(story)}</span></span><span className="card-arrow" aria-hidden="true"><Icon name="arrow" /></span>
  </button>;
}
export default function SelectedStoryCard({ story, saved, onSave, onClose, onNext, onReadSample }: { story: Story; saved: boolean; onSave: () => void; onClose: () => void; onNext: () => void; onReadSample: () => void }) {
  return <article id="selected" className="selected" aria-label="Selected story">
    <button className="save-toggle" onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save story'} aria-pressed={saved}><Icon name="bookmark" /></button>
    <button className="close" onClick={onClose} aria-label="Close selected story"><Icon name="close" /></button>
    <StoryArt story={story} /><div className="selected-body"><div className="eyebrow"><i className="dot" style={{ background: CATEGORY_COLORS[story.category] }} />{story.location} · {story.category}</div><h2>{story.title}</h2><div className="meta">{dateLabel(story)}</div>{eventLabel(story) && <div className="event-meta">{eventLabel(story)}</div>}
      <div className="actions">{story.isDemo ? <button className="primary" onClick={onReadSample}>Read story <Icon name="external" /></button> : <a className="primary" href={story.sourceUrl!} target="_blank" rel="noopener noreferrer">Read story <Icon name="external" /></a>}<button className="secondary" onClick={onNext}>Next location <Icon name="arrow" /></button></div>
    </div>
  </article>;
}
