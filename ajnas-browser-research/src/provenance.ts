import { createSign, createVerify, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import type {
  BrowserResearchReport,
  ResearchProvenanceBundle,
  SignResearchProvenanceOptions,
  VerificationResult,
  VerifyResearchProvenanceOptions
} from "./types.js";
import { sha256Digest } from "./stable-json.js";

function bundleWithoutDigest(bundle: Omit<ResearchProvenanceBundle, "digest"> | ResearchProvenanceBundle): Omit<ResearchProvenanceBundle, "digest"> {
  const { digest: _digest, signature: _signature, ...withoutDigest } = bundle as ResearchProvenanceBundle;
  return withoutDigest;
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
  const algorithm = options.algorithm ?? "rsa-sha256";
  const value =
    algorithm === "ed25519"
      ? cryptoSign(null, Buffer.from(bundle.digest, "utf8"), options.privateKey).toString("base64")
      : (() => {
          const signer = createSign("SHA256");
          signer.update(bundle.digest);
          signer.end();
          return signer.sign(options.privateKey, "base64");
        })();

  return {
    ...bundle,
    signature: {
      algorithm,
      keyId: options.keyId,
      value
    }
  };
}

export function verifyResearchProvenanceBundle(
  bundle: ResearchProvenanceBundle,
  options?: VerifyResearchProvenanceOptions
): VerificationResult {
  const issues = [];
  const expectedDigest = computeResearchProvenanceBundleDigest(bundle);
  if (bundle.digest !== expectedDigest) {
    issues.push({
      path: "$.digest",
      message: "Provenance bundle digest does not match deterministic contents",
      severity: "error" as const
    });
  }

  if (bundle.signature && options?.publicKey) {
    const valid =
      bundle.signature.algorithm === "ed25519"
        ? cryptoVerify(
            null,
            Buffer.from(bundle.digest, "utf8"),
            options.publicKey,
            Buffer.from(bundle.signature.value, "base64")
          )
        : (() => {
            const verifier = createVerify("SHA256");
            verifier.update(bundle.digest);
            verifier.end();
            return verifier.verify(options.publicKey, bundle.signature.value, "base64");
          })();
    if (!valid) {
      issues.push({
        path: "$.signature.value",
        message: "Provenance signature verification failed",
        severity: "error" as const
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
