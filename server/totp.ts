import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) implementado con node:crypto, sin dependencias.
 * Compatible con Google Authenticator, 1Password, Authy, etc.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  const raw = randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpAt(secret: string, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, '0');
}

/** Verifica el código aceptando ±1 ventana de 30s (desfase de reloj). */
export function verifyTotp(secret: string, code: string): boolean {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  const candidate = Buffer.from(normalized);
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secret, counter + offset));
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) {
      return true;
    }
  }
  return false;
}

export function otpauthUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('Pistachio');
  const label = encodeURIComponent(`Pistachio:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
