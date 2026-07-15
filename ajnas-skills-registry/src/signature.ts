import { sign, verify } from "node:crypto";
import { stableStringify, sha256 } from "./stable-json.js";
import type { KeyMaterial, SignedSkillManifest, SignSkillManifestOptions, SkillManifest } from "./types.js";

export function computeSkillDigest(manifest: SkillManifest): string {
  return `sha256:${sha256(stableStringify(manifest))}`;
}

export function signSkillManifest(manifest: SkillManifest, options: SignSkillManifestOptions): SignedSkillManifest {
  const signedAt = options.signedAt ?? (options.clock ?? (() => new Date()))().toISOString();
  const digest = computeSkillDigest(manifest);
  const payload = signaturePayload({
    algorithm: options.algorithm,
    digest,
    keyId: options.keyId,
    signedAt
  });
  const signature = sign(null, Buffer.from(payload), options.privateKey).toString("base64");

  return {
    manifest,
    digest,
    signature: {
      algorithm: options.algorithm,
      keyId: options.keyId,
      signedAt,
      value: signature
    }
  };
}

export function verifySkillSignature(envelope: SignedSkillManifest, publicKey: KeyMaterial): boolean {
  if (envelope.signature.algorithm !== "ed25519") {
    return false;
  }
  const digest = computeSkillDigest(envelope.manifest);
  if (digest !== envelope.digest) {
    return false;
  }
  const payload = signaturePayload({
    algorithm: envelope.signature.algorithm,
    digest,
    keyId: envelope.signature.keyId,
    signedAt: envelope.signature.signedAt
  });
  return verify(null, Buffer.from(payload), publicKey, Buffer.from(envelope.signature.value, "base64"));
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
