import type { Kysely } from "kysely";
import type { Database } from "../db";
import { createSession, type SessionUser } from "./session";

const ITERATIONS = 200_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (ch) => ch.codePointAt(0) ?? 0);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    HASH_BITS,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKey(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

async function verifyHash(password: string, stored: string): Promise<boolean> {
  const [algo, iterStr, saltB64, hashB64] = stored.split("$");
  if (algo !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number(iterStr);
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const actual = new Uint8Array(await deriveKey(password, salt, iterations));
  if (expected.length !== actual.length) return false;
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", expected),
    crypto.subtle.digest("SHA-256", actual),
  ]);
  return toBase64(digestA) === toBase64(digestB);
}

// Burn the same CPU as a real verify so response timing cannot enumerate users.
async function dummyVerify(password: string): Promise<void> {
  const salt = new Uint8Array(SALT_BYTES);
  await deriveKey(password, salt, ITERATIONS);
}

export async function verifyPassword(
  db: Kysely<Database>,
  username: string,
  password: string,
  clientVersion: string | null,
  now: number,
): Promise<(SessionUser & { token: string }) | null> {
  const user = await db
    .selectFrom("users")
    .select(["id", "name", "password_hash"])
    .where("id", "=", username)
    .executeTakeFirst();

  if (!user?.password_hash) {
    await dummyVerify(password);
    return null;
  }

  if (!(await verifyHash(password, user.password_hash))) return null;

  const token = await createSession(db, user.id, clientVersion, now);
  return { id: user.id, name: user.name, token };
}
