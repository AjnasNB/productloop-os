import {
  KeyObject,
  constants,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify
} from "node:crypto";
import type {
  BrowserResearchReport,
  ResearchProvenanceSignature,
  ResearchProvenanceBundle,
  SignResearchProvenanceOptions,
  VerificationResult,
  VerifyResearchProvenanceOptions
} from "./types.js";
import { sha256Digest, stableJson, toJsonObject } from "./stable-json.js";

const SIGNATURE_PURPOSE = "ajnas.browser.research.provenance.signature.v1" as const;
const SIGNATURE_ALGORITHMS = ["ed25519", "rsa-sha256", "rsa-pss-sha256", "ecdsa-sha256"] as const;
type SignatureAlgorithm = ResearchProvenanceSignature["algorithm"];

function bundleWithoutDigest(bundle: Omit<ResearchProvenanceBundle, "digest"> | ResearchProvenanceBundle): Omit<ResearchProvenanceBundle, "digest"> {
  const normalized = toJsonObject(bundle);
  const { digest: _digest, signature: _signature, ...withoutDigest } = normalized;
  return withoutDigest as unknown as Omit<ResearchProvenanceBundle, "digest">;
}

export function computeResearchProvenanceBundleDigest(bundle: Omit<ResearchProvenanceBundle, "digest"> | ResearchProvenanceBundle): string {
  return sha256Digest(bundleWithoutDigest(bundle));
}

export function createResearchProvenanceBundle(
  report: BrowserResearchReport,
  options: { generatedAt?: string } = {}
): ResearchProvenanceBundle {
  const withoutDigest: Omit<ResearchProvenanceBundle, "digest"> = {
    schema: "ajnas.browser.research.provenance-bundle.v1",
    runId: report.runId,
    planId: report.planId,
    reportDigest: report.digest,
    planDigest: report.planDigest,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    citations: report.citations,
    receipts: report.audit
  };

  return {
    ...withoutDigest,
    digest: computeResearchProvenanceBundleDigest(withoutDigest)
  };
}

export function signResearchProvenanceBundle(
  bundle: ResearchProvenanceBundle,
  options: SignResearchProvenanceOptions
): ResearchProvenanceBundle {
  const normalizedBundle = toJsonObject(bundle) as unknown as ResearchProvenanceBundle;
  const algorithm = options.algorithm ?? "rsa-sha256";
  if (!isSignatureAlgorithm(algorithm)) throw new TypeError(`Unsupported provenance signature algorithm: ${String(algorithm)}`);
  const keyId = normalizeKeyId(options.keyId);
  if (normalizedBundle.digest !== computeResearchProvenanceBundleDigest(normalizedBundle)) throw new TypeError("Cannot sign a provenance bundle with an invalid digest");
  const privateKey = normalizePrivateKey(options.privateKey, algorithm);
  const payload = signaturePayload({
    algorithm,
    bundleDigest: normalizedBundle.digest,
    keyId
  });
  const value = signPayload(payload, algorithm, privateKey).toString("base64");

  return {
    ...normalizedBundle,
    signature: {
      algorithm,
      keyId,
      value
    }
  };
}

export function verifyResearchProvenanceBundle(
  bundle: ResearchProvenanceBundle,
  options?: VerifyResearchProvenanceOptions
): VerificationResult {
  const issues: VerificationResult["issues"] = [];
  if (bundle === null || typeof bundle !== "object" || Array.isArray(bundle)) {
    return {
      valid: false,
      issues: [{ path: "$", message: "Provenance bundle must be a JSON object", severity: "error" }]
    };
  }
  try {
    bundle = toJsonObject(bundle) as unknown as ResearchProvenanceBundle;
  } catch (error) {
    return {
      valid: false,
      issues: [{ path: "$", message: `Provenance bundle must contain canonical JSON values: ${error instanceof Error ? error.message : String(error)}`, severity: "error" }]
    };
  }
  let expectedDigest: string | undefined;
  try {
    expectedDigest = computeResearchProvenanceBundleDigest(bundle);
  } catch (error) {
    issues.push({
      path: "$.digest",
      message: `Provenance bundle contents are invalid: ${error instanceof Error ? error.message : String(error)}`,
      severity: "error" as const
    });
  }

  if (expectedDigest !== undefined && bundle.digest !== expectedDigest) {
    issues.push({ path: "$.digest", message: "Provenance bundle digest does not match deterministic contents", severity: "error" as const });
  }

  const hasSignature = Object.prototype.hasOwnProperty.call(bundle, "signature") && bundle.signature !== undefined;
  if (hasSignature) {
    if (bundle.signature === null || typeof bundle.signature !== "object" || Array.isArray(bundle.signature)) {
      issues.push({ path: "$.signature", message: "Provenance signature must be an object", severity: "error" as const });
      return { valid: false, issues };
    }
    if (!options?.publicKey) {
      issues.push({ path: "$.signature", message: "A public key is required to verify this signed provenance bundle", severity: "error" as const });
    } else if (!hasExactSignatureShape(bundle.signature)) {
      issues.push({ path: "$.signature", message: "Provenance signature must contain only algorithm, keyId, and value", severity: "error" as const });
    } else if (!isSignatureAlgorithm(bundle.signature.algorithm)) {
      issues.push({ path: "$.signature.algorithm", message: `Unsupported provenance signature algorithm: ${String(bundle.signature.algorithm)}`, severity: "error" as const });
    } else if (!isCanonicalKeyId(bundle.signature.keyId)) {
      issues.push({ path: "$.signature.keyId", message: "Provenance signature keyId must be a canonical non-empty string", severity: "error" as const });
    } else if (!isCanonicalBase64(bundle.signature.value)) {
      issues.push({ path: "$.signature.value", message: "Provenance signature must be canonical base64", severity: "error" as const });
    } else {
      try {
        const publicKey = normalizePublicKey(options.publicKey, bundle.signature.algorithm);
        const payload = signaturePayload({
          algorithm: bundle.signature.algorithm,
          bundleDigest: bundle.digest,
          keyId: bundle.signature.keyId
        });
        const valid = verifyPayload(
          payload,
          bundle.signature.algorithm,
          publicKey,
          Buffer.from(bundle.signature.value, "base64")
        );
        if (!valid) issues.push({ path: "$.signature.value", message: "Provenance signature verification failed", severity: "error" as const });
      } catch {
        issues.push({ path: "$.signature.value", message: "Provenance signature or public key is malformed", severity: "error" as const });
      }
    }
  } else if (options?.publicKey) {
    issues.push({ path: "$.signature", message: "A signature is required when a public key is supplied", severity: "error" as const });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function isCanonicalBase64(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return false;
  return Buffer.from(value, "base64").toString("base64") === value;
}

function isSignatureAlgorithm(value: unknown): value is SignatureAlgorithm {
  return typeof value === "string" && (SIGNATURE_ALGORITHMS as readonly string[]).includes(value);
}

function isCanonicalKeyId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function normalizeKeyId(value: unknown): string {
  if (!isCanonicalKeyId(value)) throw new TypeError("Provenance signature keyId must be a canonical non-empty string");
  return value;
}

function hasExactSignatureShape(value: object): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === 3 && keys[0] === "algorithm" && keys[1] === "keyId" && keys[2] === "value";
}

function normalizePrivateKey(
  material: SignResearchProvenanceOptions["privateKey"],
  algorithm: SignatureAlgorithm
): KeyObject {
  let key: KeyObject;
  try {
    key = material instanceof KeyObject ? material : createPrivateKey(material);
  } catch (cause) {
    throw new TypeError("Provenance signing key is malformed", { cause });
  }
  if (key.type !== "private") throw new TypeError("Provenance signing requires a private key");
  assertKeyType(key, algorithm);
  return key;
}

function normalizePublicKey(
  material: VerifyResearchProvenanceOptions["publicKey"],
  algorithm: SignatureAlgorithm
): KeyObject {
  let key: KeyObject;
  try {
    key = material instanceof KeyObject ? material : createPublicKey(material);
  } catch (cause) {
    throw new TypeError("Provenance verification key is malformed", { cause });
  }
  if (key.type !== "public") throw new TypeError("Provenance verification requires a public key");
  assertKeyType(key, algorithm);
  return key;
}

function assertKeyType(key: KeyObject, algorithm: SignatureAlgorithm): void {
  const expected = algorithm === "ed25519"
    ? "ed25519"
    : algorithm === "rsa-sha256"
      ? "rsa"
      : algorithm === "rsa-pss-sha256"
        ? "rsa-pss"
        : "ec";
  if (key.asymmetricKeyType !== expected) {
    throw new TypeError(`Provenance signature algorithm ${algorithm} requires a ${expected} key`);
  }
}

function signaturePayload(input: {
  algorithm: SignatureAlgorithm;
  bundleDigest: string;
  keyId: string;
}): Buffer {
  return Buffer.from(stableJson({
    purpose: SIGNATURE_PURPOSE,
    bundleDigest: input.bundleDigest,
    algorithm: input.algorithm,
    keyId: input.keyId
  }), "utf8");
}

function signPayload(payload: Buffer, algorithm: SignatureAlgorithm, privateKey: KeyObject): Buffer {
  switch (algorithm) {
    case "ed25519":
      return cryptoSign(null, payload, privateKey);
    case "rsa-sha256":
      return cryptoSign("sha256", payload, { key: privateKey, padding: constants.RSA_PKCS1_PADDING });
    case "rsa-pss-sha256":
      return cryptoSign("sha256", payload, {
        key: privateKey,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: constants.RSA_PSS_SALTLEN_DIGEST
      });
    case "ecdsa-sha256":
      return cryptoSign("sha256", payload, { key: privateKey, dsaEncoding: "der" });
  }
}

function verifyPayload(
  payload: Buffer,
  algorithm: SignatureAlgorithm,
  publicKey: KeyObject,
  signature: Buffer
): boolean {
  switch (algorithm) {
    case "ed25519":
      return cryptoVerify(null, payload, publicKey, signature);
    case "rsa-sha256":
      return cryptoVerify("sha256", payload, { key: publicKey, padding: constants.RSA_PKCS1_PADDING }, signature);
    case "rsa-pss-sha256":
      return cryptoVerify("sha256", payload, {
        key: publicKey,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: constants.RSA_PSS_SALTLEN_DIGEST
      }, signature);
    case "ecdsa-sha256":
      return cryptoVerify("sha256", payload, { key: publicKey, dsaEncoding: "der" }, signature);
  }
}
