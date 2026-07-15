import { sign, verify } from "node:crypto";
import { stableStringify } from "./stable-json.js";
import type { KeyMaterial, SignedTraceBundle, SignTraceBundleOptions, TraceBundle } from "./types.js";

export function signTraceBundle(bundle: TraceBundle, options: SignTraceBundleOptions): SignedTraceBundle {
  const signedAt = options.signedAt ?? (options.clock ?? (() => new Date()))().toISOString();
  const payload = signaturePayload({
    algorithm: options.algorithm,
    digest: bundle.digest,
    keyId: options.keyId,
    signedAt
  });
  const signature = sign(null, Buffer.from(payload), options.privateKey).toString("base64");

  return {
    bundle,
    digest: bundle.digest,
    signature: {
      algorithm: options.algorithm,
      keyId: options.keyId,
      signedAt,
      value: signature
    }
  };
}

export function verifyTraceBundleSignature(signed: SignedTraceBundle, publicKey: KeyMaterial): boolean {
  if (signed.signature.algorithm !== "ed25519") {
    return false;
  }
  if (signed.digest !== signed.bundle.digest) {
    return false;
  }
  const payload = signaturePayload({
    algorithm: signed.signature.algorithm,
    digest: signed.digest,
    keyId: signed.signature.keyId,
    signedAt: signed.signature.signedAt
  });
  return verify(null, Buffer.from(payload), publicKey, Buffer.from(signed.signature.value, "base64"));
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
