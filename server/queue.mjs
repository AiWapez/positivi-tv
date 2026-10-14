import { get, put, list, del, BlobPreconditionFailedError } from '@vercel/blob';
export const queuePath = day => { if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid queue date'); return 'editorial/queue/' + day + '.json'; };
export async function readBatch(pathname) {
  if (!/^editorial\/queue\/\d{4}-\d{2}-\d{2}\.json$/.test(pathname)) throw new Error('Invalid queue path');
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const body = await new Response(result.stream).text(); if (body.length > 128 * 1024) throw new Error('Oversized queue batch');
  return JSON.parse(body);
}
export function serializeBatch(batch) {
  if (batch.schemaVersion !== 1 || !Array.isArray(batch.candidates) || batch.candidates.length > 10 || batch.candidates.some(s => s.status !== 'pending' || s.review)) throw new Error('Invalid pending batch');
  const text = JSON.stringify(batch); if (Buffer.byteLength(text) > 128 * 1024) throw new Error('Oversized queue batch'); return text;
}
export async function writeBatch(batch) {
  return put(queuePath(batch.collectedAt.slice(0,10)), serializeBatch(batch), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' });
}
export async function listBatches() { return (await list({ prefix: 'editorial/queue/', limit: 100 })).blobs; }
export async function pruneQueue(now = Date.now()) {
  const stale = (await listBatches()).filter(b => now - new Date(b.uploadedAt).getTime() > 30 * 86400000);
  if (stale.length) await del(stale.map(b => b.url)); return stale.length;
}
export function duplicateBatch(error) { return error instanceof BlobPreconditionFailedError || /already exists/i.test(String(error.message)); }
