import { useEffect, useState } from 'react';
import type { Story } from '../types';
import { countryForLocation, loadCountryFacts, relevantFacts, groupByTopic } from '../lib/country-facts';
import type { CountryIndex, PickedFact } from '../lib/country-facts';
import { isSpaceStory } from '../lib/space-stories';

export interface CountryInfo { name: string; relevant: PickedFact[]; groups: { topic: string; facts: PickedFact[] }[]; source: CountryIndex['file']['source'] }
/**
 * The country facts for the opened story, or null. Only a story with a place on Earth asks for them, so the facts file is not
 * downloaded until a reader opens such a story.
 */
export function useCountryFacts(story: Story | null): CountryInfo | null {
  const [index, setIndex] = useState<CountryIndex | null>(null);
  const wants = !!story && story.lat !== null && !isSpaceStory(story);
  useEffect(() => {
    if (!wants) return;
    let cancelled = false;
    // The app opens a story by itself at load, so the download waits a moment and never competes with the globe and its pictures.
    const timer = setTimeout(() => { loadCountryFacts().then(value => { if (!cancelled) setIndex(value); }); }, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [wants]);
  if (!wants || !index) return null;
  const country = countryForLocation(story!.location, index);
  if (!country) return null;
  return { name: country.name, relevant: relevantFacts(country, index.file.topics, story!), groups: groupByTopic(country, index.file.topics), source: index.file.source };
}
