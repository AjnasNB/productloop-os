import { createPrivateKey, createPublicKey, KeyObject, sign, verify } from "node:crypto";
import { verifyTraceBundle } from "./bundle.js";
import { stableStringify } from "./stable-json.js";
import type { KeyMaterial, SignedTraceBundle, SignTraceBundleOptions, TraceBundle } from "./types.js";

export function signTraceBundle(bundle: TraceBundle, options: SignTraceBundleOptions): SignedTraceBundle {
  if (options.algorithm !== "ed25519") throw new TypeError("Only ed25519 trace-bundle signatures are supported");
  if (typeof options.keyId !== "string" || !options.keyId.trim()) throw new TypeError("Trace-bundle signature keyId must be a non-empty string");
  const normalizedBundle = JSON.parse(stableStringify(bundle)) as TraceBundle;
  const integrity = verifyTraceBundle(normalizedBundle);
  if (!integrity.valid) throw new TypeError(`Cannot sign an invalid trace bundle: ${integrity.issues.join("; ")}`);
  const signedAt = options.signedAt ?? (options.clock ?? (() => new Date()))().toISOString();
  if (!isIsoTimestamp(signedAt)) throw new TypeError("Trace-bundle signedAt must be a valid ISO timestamp");
  const payload = signaturePayload({
    algorithm: options.algorithm,
    digest: normalizedBundle.digest,
    keyId: options.keyId,
    signedAt
  });
  const signature = sign(null, Buffer.from(payload), toEd25519PrivateKey(options.privateKey)).toString("base64");

  return {
    bundle: normalizedBundle,
    digest: normalizedBundle.digest,
    signature: {
      algorithm: options.algorithm,
      keyId: options.keyId,
      signedAt,
      value: signature
    }
  };
}

export function verifyTraceBundleSignature(signed: SignedTraceBundle, publicKey: KeyMaterial): boolean {
  try {
    const normalized = JSON.parse(stableStringify(signed)) as SignedTraceBundle;
    if (!normalized || typeof normalized !== "object" || !normalized.signature || !normalized.bundle) return false;
    if (normalized.signature.algorithm !== "ed25519") return false;
    if (typeof normalized.signature.keyId !== "string" || !normalized.signature.keyId.trim()) return false;
    if (!isIsoTimestamp(normalized.signature.signedAt) || !isCanonicalBase64(normalized.signature.value)) return false;
    if (normalized.digest !== normalized.bundle.digest || !verifyTraceBundle(normalized.bundle).valid) return false;
    const payload = signaturePayload({
      algorithm: normalized.signature.algorithm,
      digest: normalized.digest,
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

function toEd25519PrivateKey(key: KeyMaterial): KeyObject {
  let normalized: KeyObject;
  try {
    normalized = key instanceof KeyObject ? key : createPrivateKey(key);
  } catch {
    throw new TypeError("Trace-bundle signing requires a valid Ed25519 private key");
  }
  if (normalized.type !== "private" || normalized.asymmetricKeyType !== "ed25519") {
    throw new TypeError("Trace-bundle signing requires an Ed25519 private key");
  }
  return normalized;
}

function toEd25519PublicKey(key: KeyMaterial): KeyObject {
  let normalized: KeyObject;
  try {
    normalized = key instanceof KeyObject ? key : createPublicKey(key);
  } catch {
    throw new TypeError("Trace-bundle verification requires a valid Ed25519 public key");
  }
  if (normalized.type !== "public" || normalized.asymmetricKeyType !== "ed25519") {
    throw new TypeError("Trace-bundle verification requires an Ed25519 public key");
  }
  return normalized;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isCanonicalBase64(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}

function signaturePayload(input: {
  algorithm: string;
  digest: string;
  keyId: string;
  signedAt: string;
}): string {
  return stableStringify({
    purpose: "ajnas.provenance.bundle.signature.v1",
    ...input
  });
}
