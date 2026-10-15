import Icon from './Icon';
import type { CountryInfo } from '../hooks/useCountryFacts';

/** A few facts that fit the opened story, with a button that opens the full country page. Shown on the card, under the story details. */
export function CountryTeaser({ info, onOpen }: { info: CountryInfo; onOpen: () => void }) {
  if (!info.relevant.length) return null;
  return <section className="country-teaser" aria-label={`Good to know about ${info.name}`}>
    <h3>Good to know · {info.name}</h3>
    <ul>{info.relevant.map(fact => <li key={fact.label}><strong>{fact.label}</strong> {fact.text}</li>)}</ul>
    <button className="secondary" onClick={onOpen}>More about {info.name} <Icon name="arrow" /></button>
  </section>;
}

/** The full page, opened in the dialog: the facts that fit this story first, then every fact grouped by topic, with the source stated plainly. */
export function CountryPage({ info }: { info: CountryInfo }) {
  return <>
    <p className="eyebrow">About this country</p>
    <h2 id="dialog-title">{info.name}</h2>
    {!!info.relevant.length && <section className="country-section"><h3>Most relevant to this story</h3><dl>{info.relevant.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.text}</dd></div>)}</dl></section>}
    {info.groups.map(group => <section className="country-section" key={group.topic}><h3>{group.topic}</h3><dl>{group.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.text}</dd></div>)}</dl></section>)}
    <p className="country-source">Source: <a href={info.source.archive} target="_blank" rel="noopener noreferrer">{info.source.name}</a>, public domain. {info.source.note} Facts are shown as the Factbook wrote them, so a figure may be out of date.</p>
  </>;
}
