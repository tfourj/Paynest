import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const legacyEnvelopeVersion = 1;
const masterKeyEnvelopeVersion = 2;
const kdfName = "pbkdf2-sha256";
const kdfIterations = 120_000;
const keyLength = 32;
const saltLength = 16;
const nonceLength = 12;
const encryptedAppDataV1AssociatedData = utf8Encode("paynest.encryptedAppData.v1");
const encryptedAppDataV2AssociatedData = utf8Encode("paynest.encryptedAppData.v2");
const masterKeyAssociatedData = utf8Encode("paynest.masterKey.v1");
const derivedKeyCache = new Map<string, Promise<Uint8Array>>();

export type LegacyEncryptedEnvelope = {
  version: typeof legacyEnvelopeVersion;
  kdf: typeof kdfName;
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
};

export type MasterKeyEncryptedEnvelope = {
  version: typeof masterKeyEnvelopeVersion;
  nonce: string;
  ciphertext: string;
};

export type EncryptedEnvelope = LegacyEncryptedEnvelope | MasterKeyEncryptedEnvelope;

export type WrappedMasterKey = {
  kdf: typeof kdfName;
  iterations: number;
  salt: string;
  encryptedMasterKey: string;
  nonce: string;
};

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export async function encryptJsonPayload<T>(
  payload: T,
  password: string,
  saltOverride?: string,
): Promise<LegacyEncryptedEnvelope> {
  const normalizedPassword = normalizeEncryptionPassword(password);
  const salt = saltOverride ? hexToBytes(saltOverride) : randomBytes(saltLength);
  if (salt.length !== saltLength) {
    throw new EncryptionError("Encrypted cloud data uses an unsupported key format.");
  }
  const nonce = randomBytes(nonceLength);
  const key = await getDerivedKey(normalizedPassword, salt, kdfIterations);
  const plaintext = utf8Encode(JSON.stringify(payload));
  const ciphertext = gcm(key, nonce, encryptedAppDataV1AssociatedData).encrypt(plaintext);

  return {
    version: legacyEnvelopeVersion,
    kdf: kdfName,
    iterations: kdfIterations,
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export async function decryptJsonPayload<T>(envelope: EncryptedEnvelope, password: string): Promise<T> {
  assertSupportedLegacyEnvelope(envelope);

  const normalizedPassword = normalizeEncryptionPassword(password);
  const salt = hexToBytes(envelope.salt);
  const nonce = hexToBytes(envelope.nonce);
  const ciphertext = hexToBytes(envelope.ciphertext);
  const key = await getDerivedKey(normalizedPassword, salt, envelope.iterations);

  try {
    const plaintext = gcm(key, nonce, encryptedAppDataV1AssociatedData).decrypt(ciphertext);
    return JSON.parse(utf8Decode(plaintext)) as T;
  } catch {
    throw new EncryptionError("Could not decrypt cloud data. Check the encryption password.");
  }
}

export function createMasterKey() {
  return randomBytes(keyLength);
}

export function exportMasterKey(masterKey: Uint8Array) {
  assertMasterKey(masterKey);
  return bytesToHex(masterKey);
}

export function importMasterKey(value: string) {
  const masterKey = hexToBytes(value);
  assertMasterKey(masterKey);
  return masterKey;
}

export async function wrapMasterKey(masterKey: Uint8Array, password: string): Promise<WrappedMasterKey> {
  assertMasterKey(masterKey);

  const normalizedPassword = normalizeEncryptionPassword(password);
  const salt = randomBytes(saltLength);
  const nonce = randomBytes(nonceLength);
  const passwordKey = await getDerivedKey(normalizedPassword, salt, kdfIterations);
  const encryptedMasterKey = gcm(passwordKey, nonce, masterKeyAssociatedData).encrypt(masterKey);

  return {
    kdf: kdfName,
    iterations: kdfIterations,
    salt: bytesToHex(salt),
    encryptedMasterKey: bytesToHex(encryptedMasterKey),
    nonce: bytesToHex(nonce),
  };
}

export async function unwrapMasterKey(wrapped: WrappedMasterKey, password: string) {
  assertSupportedWrappedMasterKey(wrapped);

  const normalizedPassword = normalizeEncryptionPassword(password);
  const salt = hexToBytes(wrapped.salt);
  const nonce = hexToBytes(wrapped.nonce);
  const encryptedMasterKey = hexToBytes(wrapped.encryptedMasterKey);
  const passwordKey = await getDerivedKey(normalizedPassword, salt, wrapped.iterations);

  try {
    const masterKey = gcm(passwordKey, nonce, masterKeyAssociatedData).decrypt(encryptedMasterKey);
    assertMasterKey(masterKey);
    return masterKey;
  } catch {
    throw new EncryptionError("Could not unlock cloud data. Check the encryption password.");
  }
}

export function encryptJsonPayloadWithMasterKey<T>(
  payload: T,
  masterKey: Uint8Array,
): MasterKeyEncryptedEnvelope {
  assertMasterKey(masterKey);

  const nonce = randomBytes(nonceLength);
  const plaintext = utf8Encode(JSON.stringify(payload));
  const ciphertext = gcm(masterKey, nonce, encryptedAppDataV2AssociatedData).encrypt(plaintext);

  return {
    version: masterKeyEnvelopeVersion,
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export function decryptJsonPayloadWithMasterKey<T>(envelope: EncryptedEnvelope, masterKey: Uint8Array): T {
  assertSupportedMasterKeyEnvelope(envelope);
  assertMasterKey(masterKey);

  const nonce = hexToBytes(envelope.nonce);
  const ciphertext = hexToBytes(envelope.ciphertext);

  try {
    const plaintext = gcm(masterKey, nonce, encryptedAppDataV2AssociatedData).decrypt(ciphertext);
    return JSON.parse(utf8Decode(plaintext)) as T;
  } catch {
    throw new EncryptionError("Could not decrypt cloud data. Check the encryption password.");
  }
}

export function isLegacyEncryptedEnvelope(envelope: EncryptedEnvelope): envelope is LegacyEncryptedEnvelope {
  return envelope.version === legacyEnvelopeVersion;
}

export function isMasterKeyEncryptedEnvelope(envelope: EncryptedEnvelope): envelope is MasterKeyEncryptedEnvelope {
  return envelope.version === masterKeyEnvelopeVersion;
}

export function serializeEncryptedEnvelope(envelope: EncryptedEnvelope) {
  return JSON.stringify(envelope);
}

export function createEncryptionSalt() {
  return bytesToHex(randomBytes(saltLength));
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
  if (isLegacyEncryptedEnvelope(envelope)) {
    assertSupportedLegacyEnvelope(envelope);
    return;
  }
  if (isMasterKeyEncryptedEnvelope(envelope)) {
    assertSupportedMasterKeyEnvelope(envelope);
    return;
  }
  throw new EncryptionError("Encrypted cloud data uses an unsupported format.");
}

function assertSupportedLegacyEnvelope(envelope: EncryptedEnvelope): asserts envelope is LegacyEncryptedEnvelope {
  if (!envelope || typeof envelope !== "object") {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
  if (envelope.version !== legacyEnvelopeVersion || envelope.kdf !== kdfName) {
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
  if (envelope.salt.length !== saltLength * 2 || envelope.nonce.length !== nonceLength * 2) {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
}

function assertSupportedMasterKeyEnvelope(
  envelope: EncryptedEnvelope,
): asserts envelope is MasterKeyEncryptedEnvelope {
  if (!envelope || typeof envelope !== "object") {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
  if (envelope.version !== masterKeyEnvelopeVersion) {
    throw new EncryptionError("Encrypted cloud data uses an unsupported format.");
  }
  if (typeof envelope.nonce !== "string" || typeof envelope.ciphertext !== "string") {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
  if (envelope.nonce.length !== nonceLength * 2) {
    throw new EncryptionError("Encrypted cloud data is corrupted.");
  }
}

function assertSupportedWrappedMasterKey(wrapped: WrappedMasterKey) {
  if (!wrapped || typeof wrapped !== "object") {
    throw new EncryptionError("Encrypted cloud key is corrupted.");
  }
  if (wrapped.kdf !== kdfName) {
    throw new EncryptionError("Encrypted cloud key uses an unsupported format.");
  }
  if (!Number.isInteger(wrapped.iterations) || wrapped.iterations < 100_000) {
    throw new EncryptionError("Encrypted cloud key uses an unsupported key format.");
  }
  if (
    typeof wrapped.salt !== "string"
    || typeof wrapped.nonce !== "string"
    || typeof wrapped.encryptedMasterKey !== "string"
  ) {
    throw new EncryptionError("Encrypted cloud key is corrupted.");
  }
  if (wrapped.salt.length !== saltLength * 2 || wrapped.nonce.length !== nonceLength * 2) {
    throw new EncryptionError("Encrypted cloud key is corrupted.");
  }
}

function assertMasterKey(masterKey: Uint8Array) {
  if (!(masterKey instanceof Uint8Array) || masterKey.length !== keyLength) {
    throw new EncryptionError("Encrypted cloud data uses an unsupported key format.");
  }
}

function getDerivedKey(password: string, salt: Uint8Array, iterations: number) {
  const cacheKey = `${iterations}:${bytesToHex(salt)}:${password}`;
  let cached = derivedKeyCache.get(cacheKey);
  if (!cached) {
    cached = deriveKey(password, salt, iterations);
    derivedKeyCache.set(cacheKey, cached);
  }
  return cached;
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
