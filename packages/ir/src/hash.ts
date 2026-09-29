/**
 * Portable, dependency-free stable hash (FNV-1a, 64-bit) for cache keys and versions.
 * Runs identically on the server and in the browser. Not cryptographic.
 */
export function stableHash(text: string, length = 16): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c ^ (h1 >>> 7), 0x01000193) >>> 0;
  }
  // Mix both halves so short inputs still spread across all hex digits.
  h1 = Math.imul(h1 ^ (h2 >>> 13), 0x5bd1e995) >>> 0;
  h2 = Math.imul(h2 ^ (h1 >>> 15), 0x5bd1e995) >>> 0;
  const hex = h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  return (hex + hex.split("").reverse().join("")).slice(0, length);
}
