import { useEffect, useState } from 'react';
const key = 'positivitv.saved.v2';
const parse = (value: string | null) => { try { const data = JSON.parse(value || '[]'); return new Set<string>(Array.isArray(data) ? data.filter(x => typeof x === 'string').slice(0, 2000) : []); } catch { return new Set<string>(); } };
export function useSavedStories() {
  const [saved, setSaved] = useState<Set<string>>(() => { try { return parse(localStorage.getItem(key)); } catch { return new Set(); } });
  const [storageWarning, setWarning] = useState(false);
  useEffect(() => { const sync = (e: StorageEvent) => { if (e.key === key) setSaved(parse(e.newValue)); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);
  function toggle(id: string) {
    const next = new Set(saved); if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); setWarning(false); } catch { setWarning(true); }
    setSaved(next);
  }
  function clear() {
    try { localStorage.removeItem(key); setWarning(false); } catch { setWarning(true); }
    setSaved(new Set());
  }
  return { saved, toggle, clear, storageWarning };
}
