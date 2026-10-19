/**
 * Small dependency-free hashing utilities.
 *
 * The engine cannot import `node:crypto` (or any platform module), so SHA-256,
 * HMAC and HKDF are implemented here in pure TypeScript over `Uint8Array`.
 * Everything is deterministic and operates only on integer arithmetic.
 */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_BLOCK_SIZE = 64;
const SHA256_DIGEST_SIZE = 32;
const HMAC_BLOCK_SIZE = 64;

function rotateRight(value: number, shift: number): number {
  return ((value >>> shift) | (value << (32 - shift))) >>> 0;
}

/** Encodes a JS string as UTF-8 without relying on `TextEncoder`. */
export function utf8Encode(input: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new RangeError('hex string must have an even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new RangeError('hex string contains non-hexadecimal characters');
    }
    bytes[i] = byte;
  }
  return bytes;
}

/** SHA-256 (FIPS 180-4) over raw bytes. */
export function sha256(message: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((message.length + 9) / SHA256_BLOCK_SIZE) * SHA256_BLOCK_SIZE;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const bitLength = message.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += SHA256_BLOCK_SIZE) {
    for (let i = 0; i < 16; i += 1) {
      schedule[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = schedule[i - 15] ?? 0;
      const w2 = schedule[i - 2] ?? 0;
      const sigma0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const sigma1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);
      schedule[i] = ((schedule[i - 16] ?? 0) + sigma0 + (schedule[i - 7] ?? 0) + sigma1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choose + (SHA256_K[i] ?? 0) + (schedule[i] ?? 0)) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const digest = new Uint8Array(SHA256_DIGEST_SIZE);
  const digestView = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  digestView.setUint32(0, h0, false);
  digestView.setUint32(4, h1, false);
  digestView.setUint32(8, h2, false);
  digestView.setUint32(12, h3, false);
  digestView.setUint32(16, h4, false);
  digestView.setUint32(20, h5, false);
  digestView.setUint32(24, h6, false);
  digestView.setUint32(28, h7, false);
  return digest;
}

/** HMAC-SHA-256 (RFC 2104) over raw bytes. */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const normalizedKey = key.length > HMAC_BLOCK_SIZE ? sha256(key) : key;
  const keyBlock = new Uint8Array(HMAC_BLOCK_SIZE);
  keyBlock.set(normalizedKey);

  const inner = new Uint8Array(HMAC_BLOCK_SIZE + message.length);
  for (let i = 0; i < HMAC_BLOCK_SIZE; i += 1) {
    inner[i] = (keyBlock[i] ?? 0) ^ 0x36;
  }
  inner.set(message, HMAC_BLOCK_SIZE);

  const outer = new Uint8Array(HMAC_BLOCK_SIZE + SHA256_DIGEST_SIZE);
  for (let i = 0; i < HMAC_BLOCK_SIZE; i += 1) {
    outer[i] = (keyBlock[i] ?? 0) ^ 0x5c;
  }
  outer.set(sha256(inner), HMAC_BLOCK_SIZE);
  return sha256(outer);
}

/**
 * HKDF-SHA-256 (RFC 5869) with a single expand block (32 bytes).
 *
 * The daily seed follows ADR-002: the user salt is the HKDF salt and
 * `dayKey + engineVersion` is the input keying material.
 */
export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length = SHA256_DIGEST_SIZE,
): Uint8Array {
  if (length <= 0 || length > SHA256_DIGEST_SIZE * 255) {
    throw new RangeError('HKDF length must be between 1 and 255 * 32 bytes');
  }
  const effectiveSalt = salt.length > 0 ? salt : new Uint8Array(SHA256_DIGEST_SIZE);
  const prk = hmacSha256(effectiveSalt, ikm);

  const output = new Uint8Array(length);
  let previous: Uint8Array = new Uint8Array(0);
  let written = 0;
  let counter = 1;
  while (written < length) {
    const block = new Uint8Array(previous.length + info.length + 1);
    block.set(previous);
    block.set(info, previous.length);
    block[block.length - 1] = counter;
    previous = hmacSha256(prk, block);
    const take = Math.min(previous.length, length - written);
    output.set(previous.subarray(0, take), written);
    written += take;
    counter += 1;
  }
  return output;
}

/**
 * xmur3 string hash, used by the RNG to turn a textual seed into 32-bit words.
 * Returns a generator so callers can pull successive spread values from it.
 */
export function xmur3(input: string): () => number {
  let hash = 1779033703 ^ input.length;
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

/** cyrb128: 128-bit string hash, used to seed xoshiro128**. */
export function cyrb128(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
