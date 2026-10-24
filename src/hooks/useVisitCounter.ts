import { useEffect, useState } from 'react';
import { claimTodaysTick, parseVisits } from '../lib/visit-counter';
import type { VisitNumbers } from '../lib/visit-counter';

/**
 * Asks /api/visits once. When the counter is off, paused or unavailable the answer is null, so nothing is shown and nothing is sent.
 * When it is on, this browser sends at most one tick per UTC day (see claimTodaysTick) and shows the numbers.
 */
export function useVisitCounter(): VisitNumbers | null {
  const [visits, setVisits] = useState<VisitNumbers | null>(null);
  useEffect(() => {
    const request = new AbortController();
    (async () => {
      try {
        const response = await fetch('/api/visits', { signal: request.signal });
        if (!response.ok) return;
        const numbers = parseVisits(await response.json());
        if (!numbers) return;
        setVisits(numbers);
        let storage: Storage | null = null;
        try { storage = window.localStorage; } catch { storage = null; }
        if (claimTodaysTick(storage, Date.now())) {
          void fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"v":1}', keepalive: true }).catch(() => undefined);
        }
      } catch { /* the counter never affects the stories */ }
    })();
    return () => request.abort();
  }, []);
  return visits;
}
