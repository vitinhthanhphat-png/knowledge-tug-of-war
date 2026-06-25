/**
 * Pure JavaScript SHA-256 implementation to serve as a fallback in non-secure HTTP environments
 * where Web Crypto's `crypto.subtle` is undefined.
 */
function sha256Fallback(bytes: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const l = bytes.length;
  const bitLen = l * 8;
  const paddingLen = (l % 64 < 56) ? (56 - l % 64) : (120 - l % 64);
  
  const padded = new Uint8Array(l + paddingLen + 8);
  padded.set(bytes);
  padded[l] = 0x80;
  
  const view = new DataView(padded.buffer);
  const highBitLen = Math.floor(bitLen / 0x100000000);
  const lowBitLen = bitLen % 0x100000000;
  view.setUint32(l + paddingLen, highBitLen, false);
  view.setUint32(l + paddingLen + 4, lowBitLen, false);

  const W = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const w2 = W[t - 2];
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

    for (let t = 0; t < 64; t++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + W[t]) | 0;
      
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  const hexParts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const val = H[i] >>> 0;
    hexParts.push(val.toString(16).padStart(8, '0'));
  }
  return hexParts.join('');
}

/**
 * Manual UTF-8 string to bytes encoder fallback if TextEncoder is not available.
 */
export function encodeUTF8(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 
                0x80 | (charcode & 0x3f));
    }
    else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 
                0x80 | ((charcode >> 6) & 0x3f), 
                0x80 | (charcode & 0x3f));
    }
    else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10)
                | (str.charCodeAt(i) & 0x3ff));
      utf8.push(0xf0 | (charcode >> 18), 
                0x80 | ((charcode >> 12) & 0x3f), 
                0x80 | ((charcode >> 6) & 0x3f), 
                0x80 | (charcode & 0x3f));
    }
  }
  return new Uint8Array(utf8);
}

/**
 * Hashes a given answer string and salt using SHA-256.
 * Uses Web Crypto API if available, otherwise falls back to a pure JS SHA-256 implementation.
 * 
 * @param answer The selected answer string (e.g. option text)
 * @param salt The salt string (optional, defaults to empty string)
 * @returns A promise that resolves to the hex string representation of the SHA-256 hash
 */
export async function hashAnswer(
  answer: string | null | undefined,
  salt?: string | null | undefined
): Promise<string> {
  const cleanAnswer = answer || "";
  const cleanSalt = salt || "";
  const data = encodeUTF8(cleanAnswer + cleanSalt);
  
  // Guard Web Crypto Subtle check
  const hasSubtleCrypto = typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.digest === 'function';
    
  if (hasSubtleCrypto) {
    try {
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data as any);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.warn("Web Crypto API failed, falling back to pure JS implementation:", err);
    }
  }
  
  return sha256Fallback(data);
}

/**
 * Verifies if the selected answer matches the expected answer hash.
 * Handles undefined / null parameters and case-insensitivity of hashes.
 * 
 * @param answer The selected answer string
 * @param salt The salt string (optional, defaults to empty string)
 * @param expectedHash The expected SHA-256 hash to compare against
 * @returns A promise that resolves to true if the hash matches, false otherwise
 */
export async function verifyAnswer(
  answer: string | null | undefined,
  salt: string | null | undefined,
  expectedHash: string | null | undefined
): Promise<boolean> {
  try {
    if (!expectedHash) return false;
    const hash = await hashAnswer(answer, salt);
    return hash.toLowerCase() === expectedHash.toLowerCase();
  } catch (err) {
    console.error("verifyAnswer failed:", err);
    return false;
  }
}

