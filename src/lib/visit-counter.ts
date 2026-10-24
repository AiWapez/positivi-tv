/** Browser side of the visit counter. The only thing remembered is the UTC date of the last tick, in this browser's local storage. */
export const VISIT_TICK_KEY = 'positivitv.visit.v1';
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface VisitNumbers { today: number; total: number }
/** Accepts exactly the two whole numbers /api/visits sends. Null (or anything else) means "show nothing". */
export function parseVisits(value: unknown): VisitNumbers | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'today,total') return null;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1e12;
  return ok(v.today) && ok(v.total) ? { today: v.today, total: v.total } : null;
}

/**
 * True when this browser has not yet been counted today and its storage demonstrably works. The date is written first and read back:
 * if storage throws, is blocked, or does not keep the value, nothing is sent, so a broken setting can never count on every load.
 */
export function claimTodaysTick(storage: Pick<Storage, 'getItem' | 'setItem'> | null, ms: number): boolean {
  try {
    if (!storage) return false;
    const day = utcDate(ms);
    if (storage.getItem(VISIT_TICK_KEY) === day) return false;
    storage.setItem(VISIT_TICK_KEY, day);
    return storage.getItem(VISIT_TICK_KEY) === day;
  } catch { return false; }
}
