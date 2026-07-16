import { sha256Digest, toJsonObject, toJsonValue } from "./stable-json.js";
import type {
  ExtractedPolicyContext,
  JsonObject,
  JsonValue,
  PolicyBundle,
  PolicyEffect,
  PolicyMatch,
  PolicyRule,
  RuntimePolicyDecision,
  RuntimePolicyRequest
} from "./types.js";
import { validatePolicyBundle } from "./validation.js";

interface MatchedRule {
  rule: PolicyRule;
  index: number;
}

const EFFECT_RANK: Record<PolicyEffect, number> = {
  deny: 3,
  require_approval: 2,
  allow: 1
};

export function computePolicyBundleDigest(bundle: PolicyBundle): string {
  return sha256Digest(bundle);
}

export function evaluatePolicyBundle(inputBundle: PolicyBundle, request: RuntimePolicyRequest): RuntimePolicyDecision {
  let bundle: PolicyBundle;
  try {
    bundle = toJsonObject(inputBundle) as unknown as PolicyBundle;
  } catch {
    return {
      decision: "deny",
      reason: "policy bundle failed validation",
      metadata: {
        policyBundleId: "unknown",
        policyBundleVersion: "unknown",
        validationIssues: ["bundle.json"]
      }
    };
  }
  const validation = validatePolicyBundle(bundle);
  if (!validation.valid) {
    const identity = bundle as unknown as Record<string, unknown>;
    return {
      decision: "deny",
      reason: "policy bundle failed validation",
      metadata: {
        policyBundleId: typeof identity.id === "string" ? identity.id : "unknown",
        policyBundleVersion: typeof identity.version === "string" ? identity.version : "unknown",
        validationIssues: validation.issues.map((item) => item.code)
      }
    };
  }

  const context = extractPolicyContext(request);
  const matched = bundle.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.enabled !== false && matchesPolicyRule(rule, request, context));

  if (matched.length === 0) {
    return {
      decision: bundle.defaultEffect,
      reason: "no matching policy rule",
      metadata: decisionMetadata(bundle, context, [], null)
    };
  }

  const selected = selectRule(matched);
  const metadata = decisionMetadata(
    bundle,
    context,
    matched.map(({ rule }) => rule.id),
    selected.rule.id
  );
  const base = {
    decision: selected.rule.effect,
    reason: selected.rule.reason,
    metadata
  };

  if (selected.rule.effect === "require_approval") {
    return {
      ...base,
      decision: "require_approval",
      approvalPrompt: renderApprovalPrompt(selected.rule.approvalPrompt, request, context, bundle, selected.rule)
    };
  }

  return base as RuntimePolicyDecision;
}

export function extractPolicyContext(request: RuntimePolicyRequest): ExtractedPolicyContext {
  const inputRecord = asRecord(request.input);
  const trustRecord = asRecord(inputRecord?.trust);
  const metadata = request.metadata ?? {};
  const toolRisk = stringOrNull(metadata.risk) ?? stringOrNull(request.tool.risk) ?? "unknown";

  return {
    toolName: request.tool.name,
    risk: toolRisk,
    purpose: stringOrNull(metadata.purpose),
    destination: stringOrNull(inputRecord?.destination) ?? stringOrNull(metadata.destination),
    dataClasses: uniqueStrings([...arrayStrings(inputRecord?.dataClasses), ...arrayStrings(metadata.dataClasses)]),
    publisher: stringOrNull(inputRecord?.publisher) ?? stringOrNull(trustRecord?.publisher) ?? stringOrNull(metadata.publisher),
    capabilities: uniqueStrings([
      ...capabilityStrings(inputRecord?.capabilities),
      ...capabilityStrings(metadata.capabilities)
    ])
  };
}

function matchesPolicyRule(rule: PolicyRule, request: RuntimePolicyRequest, context: ExtractedPolicyContext): boolean {
  const match = rule.match;
  return (
    matchesExact(match.toolNames, context.toolName) &&
    matchesPatterns(match.toolNamePatterns, context.toolName) &&
    matchesExact(match.risks, context.risk) &&
    matchesExact(match.purposes, context.purpose) &&
    matchesExact(match.destinations, context.destination) &&
    intersects(match.dataClasses, context.dataClasses) &&
    matchesExact(match.publishers, context.publisher) &&
    intersects(match.capabilities, context.capabilities) &&
    matchesRecord(match.metadata, request.metadata) &&
    matchesRecord(match.input, asRecord(request.input) ?? {})
  );
}

function selectRule(matched: MatchedRule[]): MatchedRule {
  return [...matched].sort((left, right) => {
    const effectDifference = EFFECT_RANK[right.rule.effect] - EFFECT_RANK[left.rule.effect];
    if (effectDifference !== 0) {
      return effectDifference;
    }
    const priorityDifference = (right.rule.priority ?? 0) - (left.rule.priority ?? 0);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return left.index - right.index;
  })[0];
}

function decisionMetadata(
  bundle: PolicyBundle,
  context: ExtractedPolicyContext,
  matchedRuleIds: string[],
  selectedRuleId: string | null
): JsonObject {
  return {
    policyBundleId: bundle.id,
    policyBundleVersion: bundle.version,
    selectedRuleId,
    matchedRuleIds,
    toolName: context.toolName,
    risk: context.risk,
    purpose: context.purpose,
    destination: context.destination,
    dataClasses: context.dataClasses,
    publisher: context.publisher,
    capabilities: context.capabilities
  };
}

function renderApprovalPrompt(
  template: string | undefined,
  request: RuntimePolicyRequest,
  context: ExtractedPolicyContext,
  bundle: PolicyBundle,
  rule: PolicyRule
): string | undefined {
  if (!template) {
    return undefined;
  }
  const replacements: Record<string, string> = {
    toolName: request.tool.name,
    risk: context.risk,
    destination: context.destination ?? "unknown",
    dataClasses: context.dataClasses.join(", "),
    publisher: context.publisher ?? "unknown",
    ruleId: rule.id,
    policyBundleId: bundle.id
  };
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => replacements[key] ?? "");
}

function matchesExact(expected: string[] | undefined, actual: string | null): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }
  return actual !== null && expected.includes(actual);
}

function matchesPatterns(patterns: string[] | undefined, actual: string): boolean {
  if (!patterns || patterns.length === 0) {
    return true;
  }
  return patterns.some((pattern) => globToRegExp(pattern).test(actual));
}

function intersects(expected: string[] | undefined, actual: string[]): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }
  return expected.some((item) => actual.includes(item));
}

function matchesRecord(expected: Record<string, JsonValue> | undefined, actual: Record<string, unknown>): boolean {
  if (!expected || Object.keys(expected).length === 0) {
    return true;
  }
  return Object.entries(expected).every(([key, value]) => JSON.stringify(value) === JSON.stringify(toJsonValue(actual[key])));
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function arrayStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function capabilityStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item === "string" && item.length > 0) {
      return [item];
    }
    const record = asRecord(item);
    const name = stringOrNull(record?.name);
    return name ? [name] : [];
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function runtimeRequestDigest(request: RuntimePolicyRequest): string {
  return sha256Digest({
    runId: request.runId,
    stepId: request.stepId,
    tool: {
      name: request.tool.name,
      description: request.tool.description ?? null,
      risk: request.tool.risk ?? null
    },
    input: toJsonObject(request.input),
    metadata: toJsonObject(request.metadata)
  });
}
