// ULID without the dependency: 10 chars of millisecond time + 16 random,
// Crockford base32, so IDs sort by creation time (ADR 0004 wants ULIDs and
// today's-entries queries lean on the ordering).
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(now: number = Date.now()): string {
  let out = "";
  for (let i = 9; i >= 0; i--) out += B32[Math.floor(now / 32 ** i) % 32];
  for (const byte of crypto.getRandomValues(new Uint8Array(16))) out += B32[byte % 32];
  return out;
}
