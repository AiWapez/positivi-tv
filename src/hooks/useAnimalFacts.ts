import { useEffect, useState } from 'react';
import type { Story } from '../types';
import { animalForStory, animalLines, loadAnimalFacts } from '../lib/animal-facts';
import type { AnimalIndex, AnimalLine } from '../lib/animal-facts';

export interface AnimalInfo { name: string; lines: AnimalLine[]; wikipedia: string; credit: string }
/**
 * The animal facts for the opened story, or null. Only a Planet or Science story asks for them, so the animal file is not downloaded
 * until a reader opens one of those, and it waits a moment so it never competes with the globe and its pictures.
 */
export function useAnimalFacts(story: Story | null): AnimalInfo | null {
  const [index, setIndex] = useState<AnimalIndex | null>(null);
  const wants = !!story && (story.category === 'Planet' || story.category === 'Science');
  useEffect(() => {
    if (!wants) return;
    let cancelled = false;
    const timer = setTimeout(() => { loadAnimalFacts().then(value => { if (!cancelled) setIndex(value); }); }, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [wants]);
  if (!wants || !index) return null;
  const animal = animalForStory(story!, index);
  return animal ? { name: animal.name, lines: animalLines(animal), wikipedia: animal.wikipedia, credit: index.file.source.credit } : null;
}
