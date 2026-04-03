/** Tiny crypto-random ID generator (no external dep) */
export function nanoid(len = 12): string {
  return crypto.getRandomValues(new Uint8Array(len))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
    .slice(0, len)
}
