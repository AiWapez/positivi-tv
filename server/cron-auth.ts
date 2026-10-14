import { timingSafeEqual } from 'node:crypto';
/** Same Bearer CRON_SECRET check as api/collect.ts. Missing secret = deny. */
export function cronAuthorized(header: unknown, secret = process.env.CRON_SECRET): boolean {
  if (!secret || typeof header !== 'string') return false;
  const expected = Buffer.from('Bearer ' + secret), actual = Buffer.from(header);
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}
