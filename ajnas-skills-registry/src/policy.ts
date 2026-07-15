import { sanitizeJson } from "./stable-json.js";
import type { JsonObject, RuntimePolicyDecision, RuntimePolicyEngine, SkillInstallPolicyOptions, SkillManifest } from "./types.js";
import { isHighRiskManifest, validateSkillManifest } from "./validation.js";

export function createSkillInstallPolicy(options: SkillInstallPolicyOptions = {}): RuntimePolicyEngine {
  const toolName = options.toolName ?? "skills.install";
  const trustedPublishers = new Set(options.trustedPublishers ?? []);
  const highRiskRequiresApproval = options.highRiskRequiresApproval ?? true;

  return {
    async evaluate(request): Promise<RuntimePolicyDecision> {
      if (request.tool.name !== toolName) {
        return {
          decision: "allow",
          reason: "not a skill installation tool"
        };
      }

      const manifest = extractManifest(request.input);
      const validation = validateSkillManifest(manifest);
      if (!validation.valid) {
        return {
          decision: "deny",
          reason: "skill manifest failed validation",
          metadata: {
            issues: sanitizeJson(validation.issues)
          } as JsonObject
        };
      }

      const skillManifest = manifest as SkillManifest;
      if (trustedPublishers.size > 0 && !trustedPublishers.has(skillManifest.trust.publisher)) {
        return {
          decision: "require_approval",
          reason: "skill publisher is not trusted",
          approvalPrompt: `Review installation of ${skillManifest.id}@${skillManifest.version} from publisher ${skillManifest.trust.publisher}.`,
          metadata: policyMetadata(skillManifest)
        };
      }

      if (highRiskRequiresApproval && isHighRiskManifest(skillManifest)) {
        return {
          decision: "require_approval",
          reason: "skill requires high-risk permissions",
          approvalPrompt: `Review high-risk permissions for ${skillManifest.id}@${skillManifest.version}.`,
          metadata: policyMetadata(skillManifest)
        };
      }

      return {
        decision: "allow",
        reason: "skill manifest is valid and trusted",
        metadata: policyMetadata(skillManifest)
      };
    }
  };
}

function extractManifest(input: unknown): unknown {
  if (typeof input === "object" && input !== null && "manifest" in input) {
    return (input as { manifest: unknown }).manifest;
  }
  return input;
}

function policyMetadata(manifest: SkillManifest): JsonObject {
  return {
    skillId: manifest.id,
    version: manifest.version,
    publisher: manifest.trust.publisher,
    trustSource: manifest.trust.source
  };
}
