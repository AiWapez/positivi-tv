import type { AnimalInfo } from '../hooks/useAnimalFacts';
import type { AnimalLine } from '../lib/animal-facts';
import Icon from './Icon';

/** One line of the card. A line with a link puts the link on just those words ("Endangered (IUCN Red List)" links "IUCN Red List"). */
function Line({ line }: { line: AnimalLine }) {
  if (!line.link) return <>{line.text}</>;
  const at = line.text.indexOf(line.link.text);
  return <>{line.text.slice(0, at)}<a href={line.link.href} target="_blank" rel="noopener noreferrer">{line.link.text}</a>{line.text.slice(at + line.link.text.length)}</>;
}

/** A few checked facts about the animal the headline names, under the story details. The source is stated on the card itself. */
export function AnimalTeaser({ info }: { info: AnimalInfo }) {
  return <section className="animal-teaser" aria-label={`Good to know about the ${info.name}`}>
    <h3>Good to know · {info.name}</h3>
    <ul>{info.lines.map(line => <li key={line.label}><strong>{line.label}</strong> <Line line={line} /></li>)}</ul>
    <p className="animal-source">{info.credit} <a href={info.wikipedia} target="_blank" rel="noopener noreferrer">Read more on Wikipedia <Icon name="external" /></a></p>
  </section>;
}
