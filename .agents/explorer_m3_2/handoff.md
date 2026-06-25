# Handoff Report — Explorer 2 (Milestone 3: Web Crypto API & Fallback Hashing)

## 1. Observation
From inspecting the codebase, the following files and code snippets govern cryptographic operations, answer hashing, and verification:

* **File: `knowledge-tug-of-war/src/crypto.ts` (Lines 1–30)**:
  ```typescript
  /**
   * Hashes a given answer string and salt using SHA-256 via the Web Crypto API.
   * @param answer The selected answer string (e.g. option text)
   * @param salt The salt string
   * @returns A promise that resolves to the hex string representation of the SHA-256 hash
   */
  export async function hashAnswer(answer: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(answer + salt);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }

  /**
   * Verifies if the selected answer matches the expected answer hash.
   * @param answer The selected answer string
   * @param salt The salt string
   * @param expectedHash The expected SHA-256 hash to compare against
   * @returns A promise that resolves to true if the hash matches, false otherwise
   */
  export async function verifyAnswer(answer: string, salt: string, expectedHash: string): Promise<boolean> {
    const hash = await hashAnswer(answer, salt);
    return hash === expectedHash;
  }
  ```

* **File: `knowledge-tug-of-war/src/app.tsx` (Lines 87–91, 180)**:
  ```typescript
          const isCorrect = await verifyAnswer(
            currentQuestion.options[i],
            currentQuestion.salt || '',
            currentQuestion.answer_hash
          );
  ```
  ```typescript
        const isCorrect = await verifyAnswer(optionText, currentQuestion.salt || '', currentQuestion.answer_hash);
  ```

* **System Environment**:
  * Node.js version: `v22.22.0` (successfully verified by running `node -v` command).
  * Pure JS SHA-256 validation script written to `test_sha256.js` and successfully verified against Node.js native `crypto` module (reported: "All tests passed successfully!").

## 2. Logic Chain
1. **HTTP (Non-Secure) Vulnerability**: In browsers, `crypto.subtle` is a property of the `Crypto` interface that is only exposed in secure contexts (HTTPS and `localhost`/`127.0.0.1`). If the web component is deployed on a non-secure HTTP context (e.g., standard IP access in a local network `http://192.168.x.x:3000`), `window.crypto.subtle` is `undefined`. Calling `crypto.subtle.digest` will throw an unhandled `TypeError`, crashing the Preact component during either correct option pre-calculation or user selection.
2. **Missing Salt Bug**: In `crypto.ts`, both `hashAnswer` and `verifyAnswer` require `salt` as a mandatory `string` parameter. If a caller passes `undefined` or `null` (e.g., when implementing tests or due to missing JSON properties), the concatenation `answer + salt` translates to `"AnswerTextundefined"` or `"AnswerTextnull"`, yielding an incorrect, unmatchable SHA-256 hash.
3. **Case Sensitivity Failure**: The comparison `hash === expectedHash` is case-sensitive. While the generated hash is lowercase, imported JSON question sets might contain uppercase hex strings (e.g., `"E3B0C4..."` instead of `"e3b0c4..."`), leading to false negatives where correct answers are flagged as wrong.
4. **SubtleCrypto Availability Guard**: We can safely check if the secure Web Crypto API is available by running:
   ```typescript
   const hasSubtleCrypto = typeof globalThis !== 'undefined' &&
     globalThis.crypto &&
     typeof globalThis.crypto.subtle !== 'undefined' &&
     typeof globalThis.crypto.subtle.digest === 'function';
   ```
5. **Pure JS SHA-256 Fallback Integration**: If `hasSubtleCrypto` is false, or if calls to `crypto.subtle.digest` throw an exception (e.g. security policy blocker), the code should fall back to a self-contained, pure JS SHA-256 algorithm that processes the byte representation from `TextEncoder` and outputs a lowercase hex string.

## 3. Caveats
* **Performance Overhead**: A pure JS fallback is slower than browser-optimized C++ implementations used by `crypto.subtle`. However, since this application only hashes small strings (short multiple-choice options) on demand, the CPU overhead is negligible (< 1ms).
* **TextEncoder Dependency**: The fallback relies on `TextEncoder` to generate UTF-8 bytes for correct hashing of non-ASCII characters. `TextEncoder` is globally supported in all modern browsers in both HTTP and HTTPS contexts.
* **No BigInt compatibility**: The pure JS fallback uses bitwise operators on standard 32-bit values and does not rely on modern `BigInt` types, guaranteeing full compatibility with older target configurations or Transpiler/Vite build steps.

## 4. Conclusion
We must enhance `crypto.ts` with a pure JS SHA-256 fallback algorithm, parameter normalization to tolerate `undefined`/`null`, and case-insensitive comparison to make it resilient across HTTP/HTTPS contexts and custom JSON input formats.

### Proposed Code Changes in `knowledge-tug-of-war/src/crypto.ts`

Replace the contents of `crypto.ts` with:

```typescript
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
 * Hashes a given answer string and salt using SHA-256.
 * Uses Web Crypto API if available, otherwise falls back to a pure JS SHA-256 implementation.
 * 
 * @param answer The selected answer string (e.g. option text)
 * @param salt The salt string (optional, defaults to empty string)
 * @returns A promise that resolves to the hex string representation of the SHA-256 hash
 */
export async function hashAnswer(answer: string | null | undefined, salt: string | null | undefined = ""): Promise<string> {
  const cleanAnswer = answer || "";
  const cleanSalt = salt || "";
  const encoder = new TextEncoder();
  const data = encoder.encode(cleanAnswer + cleanSalt);
  
  // Guard Web Crypto Subtle check
  const hasSubtleCrypto = typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.digest === 'function';
    
  if (hasSubtleCrypto) {
    try {
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
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
```

No changes are strictly required in `app.tsx` for answer verification since `app.tsx` imports and uses `verifyAnswer` which will now safely handle non-secure contexts and optional salts. However, the type annotation of the `Question` interface in `app.tsx` (line 11) is already correct: `salt?: string;`.

## 5. Verification Method

### 1. Verification of the Pure JS Fallback Logic
Execute the following verification command to run the self-contained test script in the agent's folder:
```powershell
node .agents/explorer_m3_2/test_sha256.js
```
* **Expectation**: Output should print `All tests passed successfully!`.
* **Invalidation Condition**: If any hash mismatch is found, the script will exit with an error.

### 2. Browser Verification of Fallback Execution (Non-Secure Context Simulator)
In the browser console of any browser window opened on `dist-test.html` (under secure or non-secure contexts):
1. Temporarily override `crypto.subtle` to simulate a non-secure environment:
   ```javascript
   Object.defineProperty(window.crypto, 'subtle', { value: undefined, writable: true, configurable: true });
   ```
2. Re-trigger the verification workflow (e.g. submit an answer or import a new JSON question set).
3. **Expectation**: The app should continue to evaluate answers correctly and retrieve correct options without throwing `TypeError` or printing uncaught errors.
4. **Invalidation Condition**: The console logs `TypeError: Cannot read properties of undefined (reading 'digest')` or the answer selection freezes.

### 3. Case Insensitive Hash Matching Test
1. Set the expected answer hash of a question in the imported JSON to uppercase (e.g. `E3B0...`).
2. Select the correct answer in the UI.
3. **Expectation**: The selection must be marked as correct.
4. **Invalidation Condition**: Selecting the correct option registers as incorrect.
