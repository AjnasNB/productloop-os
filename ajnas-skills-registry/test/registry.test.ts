import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  DuplicateSkillError,
  SignatureVerificationError,
  SkillApprovalQueue,
  SkillAuditLedger,
  SkillRegistry,
  computeSkillDigest,
  createSkillInstallPolicy,
  signSkillManifest,
  validateSkillManifest,
  verifySkillSignature,
  type SkillManifest
} from "../src/index.js";

function baseManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    schemaVersion: "ajnas.skill.v1",
    id: "com.ajnas.research-brief",
    name: "Research Brief",
    version: "1.0.0",
    description: "Turns approved research notes into a concise internal brief.",
    license: "MIT",
    entrypoint: {
      type: "module",
      value: "./dist/research-brief.js"
    },
    compatibility: {
      ajnasRuntime: "^0.2.1"
    },
    capabilities: [
      {
        name: "research.summarize",
        description: "Summarize reviewed research notes.",
        risk: "medium"
      }
    ],
    permissions: {
      network: "none",
      filesystem: "read",
      externalPublish: false,
      humanApproval: "on_high_risk"
    },
    trust: {
      source: "first-party",
      publisher: "ajnas",
      repository: "https://github.com/ajnas/examples",
      licenseEvidence: {
        kind: "repository",
        checkedAt: "2026-07-05T02:00:00.000Z",
        url: "https://github.com/ajnas/examples/blob/main/LICENSE"
      }
    },
    ...overrides
  };
}

describe("skill manifest validation", () => {
  test("accepts permissive manifests with runtime compatibility and trust evidence", () => {
    const result = validateSkillManifest(baseManifest());

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("rejects non-permissive or high-risk manifests that skip approval", () => {
    const result = validateSkillManifest(
      baseManifest({
        license: "Elastic-2.0",
        permissions: {
          network: "allowlist",
          allowlist: ["https://api.example.com"],
          filesystem: "write",
          externalPublish: true,
          humanApproval: "never"
        },
        capabilities: [
          {
            name: "release.publish",
            description: "Publish an external package release.",
            risk: "critical"
          }
        ]
      })
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "license.not_permissive",
      "approval.required_for_high_risk"
    ]);
  });
});

describe("signed manifest envelopes", () => {
  test("uses canonical manifest bytes for deterministic digests", () => {
    const manifest = baseManifest();
    const reorderedManifest = {
      ...manifest,
      trust: {
        repository: manifest.trust.repository,
        publisher: manifest.trust.publisher,
        licenseEvidence: manifest.trust.licenseEvidence,
        source: manifest.trust.source
      }
    };

    expect(computeSkillDigest(manifest)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(computeSkillDigest(reorderedManifest)).toBe(computeSkillDigest(manifest));
  });

  test("verifies Ed25519 signatures and rejects tampered manifests", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signed = signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: "ajnas-local-test-key",
      privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    });

    expect(verifySkillSignature(signed, publicKey)).toBe(true);
    expect(verifySkillSignature({ ...signed, manifest: { ...signed.manifest, version: "1.0.1" } }, publicKey)).toBe(false);
  });

  test("snapshots manifests and strictly validates signed-envelope fields without invoking accessors", () => {
    const manifest = baseManifest();
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signed = signSkillManifest(manifest, {
      algorithm: "ed25519",
      keyId: "ajnas-local-test-key",
      privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    });

    manifest.description = "mutated after signing";
    expect(signed.manifest.description).toBe("Turns approved research notes into a concise internal brief.");
    expect(verifySkillSignature(signed, publicKey)).toBe(true);

    expect(verifySkillSignature({
      ...signed,
      signature: { ...signed.signature, algorithm: "rsa-sha256" as never }
    }, publicKey)).toBe(false);
    expect(verifySkillSignature({
      ...signed,
      signature: { ...signed.signature, keyId: "   " }
    }, publicKey)).toBe(false);
    expect(verifySkillSignature({
      ...signed,
      signature: { ...signed.signature, signedAt: "2026-07-05T02:00:00Z" }
    }, publicKey)).toBe(false);
    expect(verifySkillSignature({
      ...signed,
      signature: { ...signed.signature, value: "not-base64" }
    }, publicKey)).toBe(false);
    expect(verifySkillSignature({ ...signed, unsignedMetadata: true } as never, publicKey)).toBe(false);
    expect(verifySkillSignature({
      ...signed,
      signature: { ...signed.signature, unsignedMetadata: true }
    } as never, publicKey)).toBe(false);

    let invoked = false;
    const accessorEnvelope = { ...signed } as unknown as Record<string, unknown>;
    Object.defineProperty(accessorEnvelope, "signature", {
      enumerable: true,
      get() {
        invoked = true;
        return signed.signature;
      }
    });
    expect(verifySkillSignature(accessorEnvelope as never, publicKey)).toBe(false);
    expect(invoked).toBe(false);

    expect(() => signSkillManifest(baseManifest(), {
      algorithm: "rsa-sha256" as never,
      keyId: "key",
      privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    })).toThrow(/ed25519/);
    expect(() => signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: " key ",
      privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    })).toThrow(/keyId/);
    expect(() => signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: "key",
      privateKey,
      signedAt: "2026-07-05T02:00:00Z"
    })).toThrow(/canonical ISO/);
  });

  test("accepts Ed25519 PEM strings and buffers while rejecting RSA and EC key material", () => {
    const ed25519 = generateKeyPairSync("ed25519");
    const privatePem = ed25519.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const publicPem = ed25519.publicKey.export({ format: "pem", type: "spki" }).toString();

    for (const privateKey of [ed25519.privateKey, privatePem, Buffer.from(privatePem)]) {
      const signed = signSkillManifest(baseManifest(), {
        algorithm: "ed25519",
        keyId: "ajnas-local-test-key",
        privateKey,
        signedAt: "2026-07-05T02:00:00.000Z"
      });
      for (const publicKey of [ed25519.publicKey, publicPem, Buffer.from(publicPem)]) {
        expect(verifySkillSignature(signed, publicKey)).toBe(true);
      }
    }

    const signed = signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: "ajnas-local-test-key",
      privateKey: ed25519.privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    });
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });

    for (const keyPair of [rsa, ec]) {
      const wrongPrivatePem = keyPair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
      const wrongPublicPem = keyPair.publicKey.export({ format: "pem", type: "spki" }).toString();
      for (const privateKey of [keyPair.privateKey, wrongPrivatePem, Buffer.from(wrongPrivatePem)]) {
        expect(() => signSkillManifest(baseManifest(), {
          algorithm: "ed25519",
          keyId: "wrong-key",
          privateKey,
          signedAt: "2026-07-05T02:00:00.000Z"
        })).toThrow(/Ed25519/);
      }
      for (const publicKey of [keyPair.publicKey, wrongPublicPem, Buffer.from(wrongPublicPem)]) {
        expect(verifySkillSignature(signed, publicKey)).toBe(false);
      }
    }

    expect(() => signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: "public-key-is-not-private",
      privateKey: ed25519.publicKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    })).toThrow(/private key/);
    expect(verifySkillSignature(signed, ed25519.privateKey)).toBe(false);
  });
});

describe("skill registry", () => {
  test("registers signed manifests, exports replayable audit receipts, and blocks conflicting duplicates", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const ledger = new SkillAuditLedger({
      clock: () => new Date("2026-07-05T02:00:00.000Z")
    });
    const registry = new SkillRegistry({
      audit: ledger,
      keyResolver: (keyId) => (keyId === "ajnas-local-test-key" ? publicKey : null),
      clock: () => new Date("2026-07-05T02:00:00.000Z")
    });
    const signed = signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: "ajnas-local-test-key",
      privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    });

    const record = registry.register(signed, {
      actor: "automation",
      source: "unit-test"
    });

    expect(record.manifest.id).toBe("com.ajnas.research-brief");
    expect(registry.get("com.ajnas.research-brief")?.digest).toBe(record.digest);
    expect(registry.list()).toHaveLength(1);
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0].receipt.previousHash).toBeNull();
    expect(ledger.events[0].receipt.eventHash).toMatch(/^[a-f0-9]{64}$/);

    const conflicting = signSkillManifest({ ...baseManifest(), description: "Different package content." }, {
      algorithm: "ed25519",
      keyId: "ajnas-local-test-key",
      privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    });
    expect(() => registry.register(conflicting, { actor: "automation", source: "unit-test" })).toThrow(DuplicateSkillError);
  });

  test("reports malformed, tampered, accessor-backed, and wrong-key envelopes as signature errors", () => {
    const ed25519 = generateKeyPairSync("ed25519");
    const signed = signSkillManifest(baseManifest(), {
      algorithm: "ed25519",
      keyId: "ajnas-local-test-key",
      privateKey: ed25519.privateKey,
      signedAt: "2026-07-05T02:00:00.000Z"
    });
    const registry = new SkillRegistry({
      keyResolver: (keyId) => keyId === "ajnas-local-test-key" ? ed25519.publicKey : null
    });
    const register = (input: unknown) => registry.register(input as never, { actor: "test", source: "unit-test" });

    for (const malformed of [
      { ...signed, signature: { ...signed.signature, algorithm: "rsa-sha256" } },
      { ...signed, signature: { ...signed.signature, keyId: "" } },
      { ...signed, signature: { ...signed.signature, signedAt: "yesterday" } },
      { ...signed, signature: { ...signed.signature, value: "not-base64" } },
      { manifest: signed.manifest, digest: signed.digest },
      { ...signed, unexpected: true }
    ]) {
      expect(() => register(malformed)).toThrow(SignatureVerificationError);
    }

    expect(() => register({
      ...signed,
      manifest: { ...signed.manifest, version: "1.0.1" }
    })).toThrow(SignatureVerificationError);

    let invoked = false;
    const accessorEnvelope = { ...signed } as unknown as Record<string, unknown>;
    Object.defineProperty(accessorEnvelope, "signature", {
      enumerable: true,
      get() {
        invoked = true;
        return signed.signature;
      }
    });
    expect(() => register(accessorEnvelope)).toThrow(SignatureVerificationError);
    expect(invoked).toBe(false);

    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const wrongKeyRegistry = new SkillRegistry({ keyResolver: () => rsa.publicKey });
    expect(() => wrongKeyRegistry.register(signed, { actor: "test", source: "unit-test" }))
      .toThrow(SignatureVerificationError);
    expect(registry.list()).toEqual([]);
  });
});

describe("runtime integration helpers", () => {
  test("creates a policy engine that gates skill installation by validation, trust, and risk", async () => {
    const trustedPolicy = createSkillInstallPolicy({
      trustedPublishers: ["ajnas"],
      highRiskRequiresApproval: true
    });

    await expect(
      trustedPolicy.evaluate({
        runId: "run_1",
        stepId: "install",
        tool: {
          name: "skills.install",
          description: "Install a skill",
          risk: "high",
          execute: () => ({ ok: true })
        },
        input: baseManifest(),
        metadata: {}
      })
    ).resolves.toMatchObject({
      decision: "allow",
      reason: "skill manifest is valid and trusted"
    });

    await expect(
      trustedPolicy.evaluate({
        runId: "run_1",
        stepId: "install",
        tool: {
          name: "skills.install",
          description: "Install a skill",
          risk: "critical",
          execute: () => ({ ok: true })
        },
        input: baseManifest({
          trust: {
            ...baseManifest().trust,
            source: "community",
            publisher: "unknown-vendor"
          },
          capabilities: [
            {
              name: "release.publish",
              description: "Publish release artifacts externally.",
              risk: "critical"
            }
          ]
        }),
        metadata: {}
      })
    ).resolves.toMatchObject({
      decision: "require_approval",
      reason: "skill publisher is not trusted"
    });

    await expect(
      trustedPolicy.evaluate({
        runId: "run_1",
        stepId: "install",
        tool: {
          name: "skills.install",
          description: "Install a skill",
          risk: "high",
          execute: () => ({ ok: true })
        },
        input: baseManifest({ license: "BUSL-1.1" }),
        metadata: {}
      })
    ).resolves.toMatchObject({
      decision: "deny",
      reason: "skill manifest failed validation"
    });

    await expect(trustedPolicy.evaluate({
      runId: "run_1",
      stepId: "publish",
      tool: { name: "npm.publish", description: "Publish", risk: "critical" },
      input: {},
      metadata: {}
    })).resolves.toMatchObject({ decision: "deny", reason: expect.stringContaining("scoped") });
  });

  test("serializes human review requests for resumable approval workflows", () => {
    const queue = new SkillApprovalQueue({
      clock: () => new Date("2026-07-05T02:00:00.000Z")
    });

    const request = queue.enqueue({
      skillId: "com.ajnas.research-brief",
      version: "1.0.0",
      digest: "sha256:abc",
      reason: "community publisher requires review",
      requestedBy: "automation",
      manifest: baseManifest()
    });
    queue.resolve(request.id, {
      approved: true,
      approverId: "human-release-owner",
      comment: "Approved for internal pilot."
    });

    expect(queue.pending()).toEqual([]);
    expect(queue.toJSON()).toMatchObject({
      requests: [
        {
          id: request.id,
          status: "approved",
          resolution: {
            approved: true,
            approverId: "human-release-owner"
          }
        }
      ]
    });

    expect(() => queue.resolve(request.id, { approved: false, approverId: "other" }))
      .toThrow(/already approved/);
  });

  test("rejects truthy approval flags and malformed reviewer identity", () => {
    const queue = new SkillApprovalQueue({ clock: () => new Date("2026-07-05T02:00:00.000Z") });
    const request = queue.enqueue({
      skillId: "com.ajnas.research-brief",
      version: "1.0.0",
      digest: "sha256:abc",
      reason: "review",
      requestedBy: "automation",
      manifest: baseManifest()
    });
    expect(() => queue.resolve(request.id, { approved: "yes", approverId: "owner" } as never)).toThrow(/boolean/);
    expect(() => queue.resolve(request.id, { approved: true, approverId: "   " })).toThrow(/non-empty/);
    let invoked = false;
    const accessorResolution = { approverId: "owner" } as Record<string, unknown>;
    Object.defineProperty(accessorResolution, "approved", { enumerable: true, get: () => { invoked = true; return true; } });
    expect(() => queue.resolve(request.id, accessorResolution as never)).toThrow(/data properties/);
    expect(invoked).toBe(false);
    expect(queue.pending()).toHaveLength(1);
  });
});
