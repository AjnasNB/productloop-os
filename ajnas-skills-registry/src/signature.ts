import { createPrivateKey, createPublicKey, KeyObject, sign, verify } from "node:crypto";
import { stableStringify, sha256 } from "./stable-json.js";
import type { KeyMaterial, SignedSkillManifest, SignSkillManifestOptions, SkillManifest } from "./types.js";

const SIGNATURE_ALGORITHM = "ed25519";
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export function computeSkillDigest(manifest: SkillManifest): string {
  return `sha256:${sha256(stableStringify(manifest))}`;
}

export function signSkillManifest(manifest: SkillManifest, options: SignSkillManifestOptions): SignedSkillManifest {
  if (options.algorithm !== SIGNATURE_ALGORITHM) {
    throw new TypeError("Only ed25519 skill-manifest signatures are supported");
  }
  if (!isValidKeyId(options.keyId)) {
    throw new TypeError("Skill-manifest signature keyId must be a non-empty canonical string");
  }

  const normalizedManifest = normalizeManifestSnapshot(manifest);
  const signedAt = options.signedAt === undefined
    ? (options.clock ?? (() => new Date()))().toISOString()
    : options.signedAt;
  if (!isCanonicalIsoTimestamp(signedAt)) {
    throw new TypeError("Skill-manifest signedAt must be a canonical ISO timestamp");
  }

  const digest = computeSkillDigest(normalizedManifest);
  const payload = signaturePayload({
    algorithm: SIGNATURE_ALGORITHM,
    digest,
    keyId: options.keyId,
    signedAt
  });
  const signature = sign(null, Buffer.from(payload), toEd25519PrivateKey(options.privateKey)).toString("base64");

  return {
    manifest: normalizedManifest,
    digest,
    signature: {
      algorithm: SIGNATURE_ALGORITHM,
      keyId: options.keyId,
      signedAt,
      value: signature
    }
  };
}

export function verifySkillSignature(envelope: SignedSkillManifest, publicKey: KeyMaterial): boolean {
  try {
    const normalized = normalizeSignedSkillManifest(envelope);
    const digest = computeSkillDigest(normalized.manifest);
    if (digest !== normalized.digest) return false;
    const payload = signaturePayload({
      algorithm: SIGNATURE_ALGORITHM,
      digest,
      keyId: normalized.signature.keyId,
      signedAt: normalized.signature.signedAt
    });
    return verify(
      null,
      Buffer.from(payload),
      toEd25519PublicKey(publicKey),
      Buffer.from(normalized.signature.value, "base64")
    );
  } catch {
    return false;
  }
}

/** Internal registry boundary: clones an envelope without evaluating accessors and validates its signed fields. */
export function normalizeSignedSkillManifest(envelope: unknown): SignedSkillManifest {
  let normalized: unknown;
  try {
    normalized = JSON.parse(stableStringify(envelope)) as unknown;
  } catch {
    throw new TypeError("Signed skill manifest must contain only canonical JSON data properties");
  }
  if (!isRecord(normalized) || !hasExactKeys(normalized, ["digest", "manifest", "signature"])) {
    throw new TypeError("Signed skill manifest must contain exactly manifest, digest, and signature");
  }
  if (!isRecord(normalized.manifest)) {
    throw new TypeError("Signed skill manifest must contain a manifest object");
  }
  if (typeof normalized.digest !== "string" || !DIGEST_PATTERN.test(normalized.digest)) {
    throw new TypeError("Signed skill manifest digest must be canonical sha256");
  }
  if (!isRecord(normalized.signature) || !hasExactKeys(normalized.signature, ["algorithm", "keyId", "signedAt", "value"])) {
    throw new TypeError("Signed skill manifest signature has an invalid shape");
  }
  if (normalized.signature.algorithm !== SIGNATURE_ALGORITHM) {
    throw new TypeError("Only ed25519 skill-manifest signatures are supported");
  }
  if (!isValidKeyId(normalized.signature.keyId)) {
    throw new TypeError("Skill-manifest signature keyId must be a non-empty canonical string");
  }
  if (!isCanonicalIsoTimestamp(normalized.signature.signedAt)) {
    throw new TypeError("Skill-manifest signedAt must be a canonical ISO timestamp");
  }
  if (!isCanonicalEd25519Signature(normalized.signature.value)) {
    throw new TypeError("Skill-manifest signature value must be canonical base64 Ed25519 material");
  }
  return normalized as unknown as SignedSkillManifest;
}

function normalizeManifestSnapshot(manifest: SkillManifest): SkillManifest {
  let normalized: unknown;
  try {
    normalized = JSON.parse(stableStringify(manifest)) as unknown;
  } catch {
    throw new TypeError("Skill manifest must contain only canonical JSON data properties");
  }
  if (!isRecord(normalized)) throw new TypeError("Skill manifest must be an object");
  return normalized as unknown as SkillManifest;
}

function toEd25519PrivateKey(key: KeyMaterial): KeyObject {
  let normalized: KeyObject;
  try {
    normalized = key instanceof KeyObject ? key : createPrivateKey(key);
  } catch {
    throw new TypeError("Skill-manifest signing requires a valid Ed25519 private key");
  }
  if (normalized.type !== "private" || normalized.asymmetricKeyType !== SIGNATURE_ALGORITHM) {
    throw new TypeError("Skill-manifest signing requires an Ed25519 private key");
  }
  return normalized;
}

function toEd25519PublicKey(key: KeyMaterial): KeyObject {
  let normalized: KeyObject;
  try {
    normalized = key instanceof KeyObject ? key : createPublicKey(key);
  } catch {
    throw new TypeError("Skill-manifest verification requires a valid Ed25519 public key");
  }
  if (normalized.type !== "public" || normalized.asymmetricKeyType !== SIGNATURE_ALGORITHM) {
    throw new TypeError("Skill-manifest verification requires an Ed25519 public key");
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isValidKeyId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isCanonicalEd25519Signature(value: unknown): value is string {
  if (typeof value !== "string" || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  return decoded.byteLength === 64 && decoded.toString("base64") === value;
}

function signaturePayload(input: {
  algorithm: string;
  digest: string;
  keyId: string;
  signedAt: string;
}): string {
  return stableStringify({
    purpose: "ajnas.skill_manifest.signature.v1",
    ...input
  });
}
