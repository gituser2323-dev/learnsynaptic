import { randomBytes, createHmac, timingSafeEqual } from "crypto";

/**
 * RC-1 — a real, standards-compliant TOTP implementation (RFC 6238,
 * built on RFC 4226's HOTP), compatible with Google Authenticator,
 * Authy, and any other standard authenticator app — no external
 * dependency, since the algorithm itself is short and this codebase's
 * own established preference (per credentialCrypto.ts/tokenCrypto.ts's
 * own precedent for AES-256-GCM) is to implement a well-defined, small
 * cryptographic primitive directly with node:crypto rather than pull in
 * a package for it. Every step below cites the RFC section it
 * implements so a future reader can verify correctness against the
 * spec directly, not just trust this comment.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 §6 — base32, no padding (the conventional encoding for a
 *  TOTP secret shown to a human or embedded in an otpauth:// URI). */
export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A real 160-bit random secret — the standard TOTP secret length
 *  (RFC 4226 recommends at least 128 bits; 160 matches SHA-1's own
 *  block-friendly size and what every real authenticator app expects). */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

/** RFC 4226 §5.3 — HOTP(K, C): HMAC-SHA1 the 8-byte big-endian counter
 *  with the secret key, then "dynamic truncation" extracts a 31-bit
 *  integer from the digest at an offset given by its own last nibble,
 *  finally reduced mod 10^digits. */
function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  // JS numbers are safe integers well past any real TOTP counter value
  // (counter = unixTime/30 won't exceed Number.MAX_SAFE_INTEGER for
  // millennia), so a plain two-part 32-bit write is exact.
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const code = (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
  return code;
}

/** RFC 6238 §4.2 — TOTP(K) = HOTP(K, floor((currentUnixTime - T0) / X)),
 *  T0 = 0, X = 30 seconds (this function's own `atUnixSeconds` param,
 *  defaulting to now — parameterized so tests can verify a known
 *  RFC 6238 test vector at a fixed timestamp rather than only ever
 *  testing "generate now, verify now"). */
export function generateTotp(base32Secret: string, atUnixSeconds: number = Math.floor(Date.now() / 1000)): string {
  const counter = Math.floor(atUnixSeconds / STEP_SECONDS);
  return hotp(decodeBase32(base32Secret), counter);
}

/** Verifies a user-supplied code against a window of adjacent time
 *  steps (±1 step = ±30s) to tolerate real clock drift between the
 *  server and the user's own device/authenticator app — the standard
 *  RFC 6238 §5.2 recommendation ("Time Step Size and Synchronization
 *  Issue"), not an arbitrarily wide window that would meaningfully
 *  increase brute-force odds (a ±1-step window is 3 valid codes out of
 *  1,000,000 at any moment — still a ~1-in-333,333 guess). Uses
 *  `timingSafeEqual` for the actual comparison, the same anti-timing-
 *  attack discipline metaCloudApi.provider.ts's own webhook-signature
 *  check already established, so a wrong-length guess can't leak which
 *  digit differed via response timing. */
export function verifyTotp(base32Secret: string, code: string, atUnixSeconds: number = Math.floor(Date.now() / 1000)): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secretBuffer = decodeBase32(base32Secret);
  const counter = Math.floor(atUnixSeconds / STEP_SECONDS);

  for (const drift of [-1, 0, 1]) {
    const candidate = hotp(secretBuffer, counter + drift);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}

/** The otpauth:// URI a QR code renders — Google Authenticator/Authy's
 *  own documented format (`otpauth://totp/{issuer}:{account}?secret=...
 *  &issuer=...`). `issuer`/`accountName` are both real, human-visible
 *  labels shown inside the authenticator app, not security-relevant
 *  values — no encoding beyond the standard URI component escaping
 *  they already need. */
export function buildTotpUri(base32Secret: string, accountEmail: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({ secret: base32Secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
