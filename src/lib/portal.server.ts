export const ADMIN_EMAIL = "willieeffiong52@gmail.com";
export const ADMIN_PASSWORD = "willie44?";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function countWords(value: string | null | undefined): number {
  if (!value) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/** Requires first, middle and surname. */
export function isThreeNames(fullName: string) {
  return fullName.trim().split(/\s+/).filter((part) => part.length >= 2).length >= 3;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function normalizeAnswer(answer: string) {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

async function derive(answer: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizeAnswer(answer)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
}

/** Hashes a security answer with PBKDF2-SHA256 and a random salt. */
export async function hashSecurityAnswer(answer: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(answer, salt);
  return `pbkdf2$100000$${toHex(salt.buffer)}$${toHex(bits)}`;
}

export async function verifySecurityAnswer(answer: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [, , saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const bits = await derive(answer, fromHex(saltHex));
  const computed = toHex(bits);
  if (computed.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i += 1) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}
