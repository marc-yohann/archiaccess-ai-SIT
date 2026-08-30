// scrypt (natif à Node, module crypto) plutôt que bcrypt/argon2 : évite une
// dépendance avec des bindings natifs à compiler/bundler pour la Lambda.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 64)
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, "hex")
  const hash = Buffer.from(hashHex, "hex")
  const derivedKey = await scrypt(password, salt, 64)
  return derivedKey.length === hash.length && timingSafeEqual(derivedKey, hash)
}

// Mot de passe temporaire lisible à l'oral/par écrit (pas de 0/O/1/l/I
// ambigus) — remis à l'employé par l'admin qui crée son compte.
const READABLE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"

export function generateTempPassword(): string {
  const bytes = randomBytes(14)
  return Array.from(bytes, (b) => READABLE_ALPHABET[b % READABLE_ALPHABET.length]).join("")
}
