import { describe, expect, test } from "vitest";
import {
  PolicyApprovalQueue,
  PolicyDecisionLedger,
  computePolicyBundleDigest,
  createDeclarativePolicyEngine,
  evaluatePolicyBundle,
  validatePolicyBundle,
  type PolicyBundle,
  type RuntimePolicyRequest
} from "../src/index.js";

function baseBundle(overrides: Partial<PolicyBundle> = {}): PolicyBundle {
  return {
    schemaVersion: "ajnas.policy.bundle.v1",
    id: "com.ajnas.enterprise-release",
    version: "1.0.0",
    description: "Controls package publishing, data export, and low-risk observation tools.",
    owner: "security-platform",
    defaultEffect: "deny",
    rules: [
      {
        id: "allow-low-risk-observation",
        description: "Low-risk read-only tools can run without human review.",
        effect: "allow",
        reason: "low-risk observation is allowed",
        priority: 10,
        match: {
          risks: ["low"],
          capabilities: ["observe"]
        }
      },
      {
        id: "review-external-release",
        description: "External release publishing requires release-owner approval.",
        effect: "require_approval",
        reason: "external package publishing requires release-owner approval",
        approvalPrompt: "Review {toolName} for {destination} with data classes {dataClasses}.",
        priority: 50,
        match: {
          toolNames: ["packages.publish"],
          destinations: ["npm"],
          dataClasses: ["release-artifact"]
        }
      },
      {
        id: "deny-untrusted-publisher",
        description: "Unknown publishers cannot publish release artifacts.",
        effect: "deny",
        reason: "publisher is outside the trusted release allowlist",
        priority: 100,
        match: {
          publishers: ["unknown-vendor"],
          dataClasses: ["release-artifact"]
        }
      }
    ],
    metadata: {
      compliance: ["SOC2", "internal-release-control"]
    },
    ...overrides
  };
}

function request(overrides: Partial<RuntimePolicyRequest> = {}): RuntimePolicyRequest {
  return {
    runId: "run_1",
    stepId: "release",
    tool: {
      name: "packages.publish",
      description: "Publish package release artifacts.",
      risk: "critical"
    },
    input: {
      destination: "npm",
      dataClasses: ["release-artifact"],
      publisher: "ajnas"
    },
    metadata: {
      purpose: "release",
      capabilities: ["publish"]
    },
    ...overrides
  };
}

describe("policy bundle validation and digests", () => {
  test("accepts declarative bundles and creates deterministic digests", () => {
    const bundle = baseBundle();
    const reordered: PolicyBundle = {
      ...bundle,
      metadata: {
        compliance: bundle.metadata?.compliance ?? []
      },
      rules: [...bundle.rules].reverse().reverse()
    };

    expect(validatePolicyBundle(bundle)).toEqual({ valid: true, issues: [] });
    expect(computePolicyBundleDigest(bundle)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(computePolicyBundleDigest(reordered)).toBe(computePolicyBundleDigest(bundle));
  });

  test("rejects duplicate rules and rules without match criteria", () => {
    const result = validatePolicyBundle(
      baseBundle({
        rules: [
          {
            id: "duplicate-rule",
            effect: "allow",
            reason: "first copy",
            match: {
              risks: ["low"]
            }
          },
          {
            id: "duplicate-rule",
            effect: "deny",
            reason: "second copy",
            match: {}
          }
        ]
      })
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(["rule.duplicate_id", "rule.empty_match"]);
  });
});

describe("declarative policy evaluation", () => {
  test("selects deny over approval when multiple enterprise rules match", () => {
    const decision = evaluatePolicyBundle(
      baseBundle(),
      request({
        input: {
          destination: "npm",
          dataClasses: ["release-artifact"],
          publisher: "unknown-vendor"
        }
      })
    );

    expect(decision).toMatchObject({
      decision: "deny",
      reason: "publisher is outside the trusted release allowlist",
      metadata: {
        policyBundleId: "com.ajnas.enterprise-release",
        selectedRuleId: "deny-untrusted-publisher",
        matchedRuleIds: ["review-external-release", "deny-untrusted-publisher"]
      }
    });
  });

  test("renders approval prompts and returns runtime-compatible decisions", () => {
    const decision = evaluatePolicyBundle(baseBundle(), request());

    expect(decision).toMatchObject({
      decision: "require_approval",
      reason: "external package publishing requires release-owner approval",
      approvalPrompt: "Review packages.publish for npm with data classes release-artifact.",
      metadata: {
        selectedRuleId: "review-external-release",
        destination: "npm",
        dataClasses: ["release-artifact"]
      }
    });
  });

  test("records deterministic audit receipts while acting as an Ajnas runtime policy engine", async () => {
    const ledger = new PolicyDecisionLedger({
      clock: () => new Date("2026-07-07T06:45:00.000Z")
    });
    const engine = createDeclarativePolicyEngine({
      bundle: baseBundle(),
      audit: ledger
    });

    await expect(engine.evaluate(request())).resolves.toMatchObject({
      decision: "require_approval"
    });
    await expect(
      engine.evaluate(
        request({
          tool: {
            name: "research.fetch",
            description: "Fetch internal read-only research context.",
            risk: "low",
            execute: () => ({ ok: true })
          },
          input: {
            capabilities: ["observe"]
          },
          metadata: {
            capabilities: ["observe"]
          }
        })
      )
    ).resolves.toMatchObject({
      decision: "allow",
      reason: "low-risk observation is allowed"
    });

    expect(ledger.events).toHaveLength(2);
    expect(ledger.events[0].receipt.previousHash).toBeNull();
    expect(ledger.events[1].receipt.previousHash).toBe(ledger.events[0].receipt.eventHash);
    expect(ledger.verify()).toEqual({ valid: true, issues: [] });
  });
});

describe("human review queue", () => {
  test("serializes policy exceptions for resumable approval workflows", () => {
    const queue = new PolicyApprovalQueue({
      clock: () => new Date("2026-07-07T06:45:00.000Z")
    });

    const item = queue.enqueue({
      policyBundleId: "com.ajnas.enterprise-release",
      ruleId: "review-external-release",
      reason: "release-owner review required",
      requestedBy: "automation",
      request: request()
    });
    queue.resolve(item.id, {
      approved: true,
      approverId: "release-owner",
      comment: "Approved for release candidate dry-run."
    });

    expect(queue.pending()).toEqual([]);
    expect(queue.toJSON()).toMatchObject({
      requests: [
        {
          id: item.id,
          status: "approved",
          resolution: {
            approved: true,
            approverId: "release-owner"
          }
        }
      ]
    });
  });
});
