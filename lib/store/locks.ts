/**
 * Per-room in-process mutex. Serializes async fns that share a code so a
 * read-modify-write sequence on the same room can't interleave with another.
 *
 * Sufficient for single-process Next.js (one Node.js worker per Vercel
 * function instance). Cross-instance Redis deployments would need a
 * distributed lock on top of this; for now the in-process lock plus
 * Redis pub/sub fan-out is enough since each instance only races itself.
 */
const tails = new Map<string, Promise<unknown>>();

export async function withCodeLock<T>(
  code: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = tails.get(code) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  tails.set(code, next);
  try {
    return await next;
  } finally {
    if (tails.get(code) === next) tails.delete(code);
  }
}
