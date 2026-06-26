import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const envelopeVersion = 1;
const kdfName = "pbkdf2-sha256";
const kdfIterations = 310_000;
const keyLength = 32;
const saltLength = 16;
const nonceLength = 12;
const associatedData = utf8Encode("paynest.encryptedAppData.v1");

export type EncryptedEnvelope = {
  version: typeof envelopeVersion;
  kdf: typeof kdfName;
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
};

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export async function encryptJsonPayload<T>(payload: T, password: string): Promise<EncryptedEnvelope> {
  const normalizedPassword = normalizeEncryptionPassword(password);
  const salt = randomBytes(saltLength);
  const nonce = randomBytes(nonceLength);
  const key = await deriveKey(normalizedPassword, salt, kdfIterations);
  const plaintext = utf8Encode(JSON.stringify(payload));
  const ciphertext = gcm(key, nonce, associatedData).encrypt(plaintext);

  return {
    version: envelopeVersion,
    kdf: kdfName,
    iterations: kdfIterations,
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export async function decryptJsonPayload<T>(envelope: EncryptedEnvelope, password: string): Promise<T> {
  assertSupportedEnvelope(envelope);

  const normalizedPassword = normalizeEncryptionPassword(password);
  const salt = hexToBytes(envelope.salt);
  const nonce = hexToBytes(envelope.nonce);
  const ciphertext = hexToBytes(envelope.ciphertext);
  const key = await deriveKey(normalizedPassword, salt, envelope.iterations);

  try {
    const plaintext = gcm(key, nonce, associatedData).decrypt(ciphertext);
    return JSON.parse(utf8Decode(plaintext)) as T;
  } catch {
    throw new EncryptionError("Could not decrypt cloud data. Check the encryption password.");
  }
}

export function serializeEncryptedEnvelope(envelope: EncryptedEnvelope) {
  return JSON.stringify(envelope);
}

export function parseEncryptedEnvelope(value: unknown): EncryptedEnvelope {
  try {
    const parsed = typeof value === "string"
      ? JSON.parse(value) as EncryptedEnvelope
      : value as EncryptedEnvelope;
    assertSupportedEnvelope(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
}

export function normalizeEncryptionPassword(password: string) {
  return password.trim();
}

function assertSupportedEnvelope(envelope: EncryptedEnvelope) {
  if (!envelope || typeof envelope !== "object") {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
  if (envelope.version !== envelopeVersion || envelope.kdf !== kdfName) {
    throw new EncryptionError("Encrypted cloud data uses an unsupported format.");
  }
  if (!Number.isInteger(envelope.iterations) || envelope.iterations < 100_000) {
    throw new EncryptionError("Encrypted cloud data uses an unsupported key format.");
  }
  if (
    typeof envelope.salt !== "string"
    || typeof envelope.nonce !== "string"
    || typeof envelope.ciphertext !== "string"
  ) {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  return pbkdf2Async(sha256, utf8Encode(password), salt, {
    c: iterations,
    dkLen: keyLength,
    asyncTick: 10,
  });
}

function randomBytes(length: number) {
  return Crypto.getRandomBytes(length);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function utf8Encode(value: string) {
  return new TextEncoder().encode(value);
}

function utf8Decode(value: Uint8Array) {
  return new TextDecoder().decode(value);
}
