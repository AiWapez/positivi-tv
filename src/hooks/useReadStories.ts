import { useEffect, useState } from 'react';
import { parseReadMap } from '../lib/reading';
import type { ReadMap } from '../lib/reading';

const key = 'positivitv.read.v1';
/** Reading history stays in this browser only, like saved stories. */
export function useReadStories() {
  const [read, setRead] = useState<ReadMap>(() => { try { return parseReadMap(localStorage.getItem(key)); } catch { return {}; } });
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === key) setRead(parseReadMap(e.newValue)); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  function markRead(id: string) {
    setRead(current => {
      if (current[id]) return current;
      const next = parseReadMap(JSON.stringify({ ...current, [id]: new Date().toISOString() }));
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Read state then lasts for this visit only. */ }
      return next;
    });
  }
  function clearRead() {
    try { localStorage.removeItem(key); } catch { /* nothing stored */ }
    setRead({});
  }
  return { read, markRead, clearRead };
}
