import { useCallback, useEffect, useRef, useState } from 'react';
import type { Feed, Story } from '../types';
import { validPublicStory, statusMatchesProvenance } from '../lib/publication';
import { checkBeforeDisplay } from '../goodsignal/broadcast';
import { POLICY_VERSION } from '../goodsignal/types';
interface Payload extends Feed { manifest: Parameters<typeof checkBeforeDisplay>[1] }
export function useStoryFeed() {
  const [feed, setFeed] = useState<Feed>({ stories: [], revision: '', updatedAt: null, checkedAt: '' });
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null), latest = useRef<Payload | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(async (): Promise<Story[] | null> => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true);
    try {
      const response = await fetch('/api/stories', { cache: 'no-store', signal: request.signal });
      if (!response.ok) throw new Error('Feed unavailable');
      const payload = await response.json() as Payload;
      if (!payload || !Array.isArray(payload.stories) || !payload.manifest || typeof payload.revision !== 'string') throw new Error('Invalid feed');
      const time = new Date().toISOString();
      const stories = payload.stories.filter(s => validPublicStory({ ...s, expiresAt: '9999-01-01T00:00:00Z', policyVersion: POLICY_VERSION })
        && checkBeforeDisplay({ storyId: s.id, storyVersion: s.version }, payload.manifest, time).allowed
        && statusMatchesProvenance(s, payload.manifest?.stories?.[s.id]?.status));
      latest.current = { ...payload, stories }; setFeed({ ...payload, stories }); setError(null);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      expiryTimer.current = setTimeout(() => { latest.current = null; setFeed(f => ({ ...f, stories: [] })); setError('Story status has expired. Refresh to reconnect.'); }, Math.max(0, Date.parse(payload.manifest.generatedAt) + 30000 - Date.now()));
      return stories;
    } catch {
      if (request.signal.aborted) return null;
      latest.current = null; setFeed({ stories: [], revision: '', updatedAt: null, checkedAt: '' });
      setError('Stories are unavailable right now. Refresh to reconnect.'); return null;
    } finally { if (controller.current === request) { controller.current = null; setLoading(false); } }
  }, []);
  const confirm = useCallback(async (s: Story) => {
    const manifest = latest.current?.manifest;
    if (manifest && checkBeforeDisplay({ storyId: s.id, storyVersion: s.version }, manifest, new Date().toISOString()).allowed
      && statusMatchesProvenance(s, manifest.stories?.[s.id]?.status)) return true;
    const fresh = await refresh(); return !!fresh?.some(x => x.id === s.id && x.version === s.version);
  }, [refresh]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 25000);
    const visible = () => { if (!document.hidden) void refresh(); else setFeed(f => ({ ...f, stories: [] })); };
    document.addEventListener('visibilitychange', visible);
    const offline = () => { controller.current?.abort(); latest.current = null; setFeed(f => ({ ...f, stories: [] })); setError('You’re offline. Reconnect to check the latest stories.'); setLoading(false); };
    window.addEventListener('offline', offline);
    return () => { controller.current?.abort(); clearInterval(timer); if (expiryTimer.current) clearTimeout(expiryTimer.current); document.removeEventListener('visibilitychange', visible); window.removeEventListener('offline', offline); };
  }, [refresh]);
  return { feed, loading, error, refresh, confirm };
}
