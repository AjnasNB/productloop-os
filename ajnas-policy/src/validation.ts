import type { PolicyBundle, PolicyDefaultEffect, PolicyEffect, PolicyMatch, ValidationIssue, ValidationResult } from "./types.js";

const POLICY_EFFECTS = new Set<PolicyEffect>(["allow", "deny", "require_approval"]);
const DEFAULT_EFFECTS = new Set<PolicyDefaultEffect>(["allow", "deny"]);

export function validatePolicyBundle(bundle: PolicyBundle): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (bundle.schemaVersion !== "ajnas.policy.bundle.v1") {
    issues.push(issue("bundle.schema", "schemaVersion", "schemaVersion must be ajnas.policy.bundle.v1"));
  }
  if (!isNonEmptyString(bundle.id)) {
    issues.push(issue("bundle.id_required", "id", "Policy bundle id is required"));
  }
  if (!isNonEmptyString(bundle.version)) {
    issues.push(issue("bundle.version_required", "version", "Policy bundle version is required"));
  }
  if (!DEFAULT_EFFECTS.has(bundle.defaultEffect)) {
    issues.push(issue("bundle.default_effect", "defaultEffect", "defaultEffect must be allow or deny"));
  }
  if (!Array.isArray(bundle.rules)) {
    issues.push(issue("bundle.rules_required", "rules", "rules must be an array"));
    return { valid: false, issues };
  }

  const seenRuleIds = new Set<string>();
  bundle.rules.forEach((rule, index) => {
    const path = `rules.${index}`;
    if (!isNonEmptyString(rule.id)) {
      issues.push(issue("rule.id_required", `${path}.id`, "Rule id is required"));
    } else if (seenRuleIds.has(rule.id)) {
      issues.push(issue("rule.duplicate_id", `${path}.id`, `Rule id ${rule.id} is duplicated`));
    } else {
      seenRuleIds.add(rule.id);
    }

    if (!POLICY_EFFECTS.has(rule.effect)) {
      issues.push(issue("rule.effect", `${path}.effect`, "Rule effect must be allow, deny, or require_approval"));
    }
    if (!isNonEmptyString(rule.reason)) {
      issues.push(issue("rule.reason_required", `${path}.reason`, "Rule reason is required"));
    }
    if (rule.priority !== undefined && !Number.isFinite(rule.priority)) {
      issues.push(issue("rule.priority", `${path}.priority`, "Rule priority must be a finite number"));
    }
    if (isEmptyMatch(rule.match)) {
      issues.push(issue("rule.empty_match", `${path}.match`, "Rule match must include at least one criterion"));
    }
  });

  return {
    valid: issues.length === 0,
    issues
  };
}

export function isEmptyMatch(match: PolicyMatch | undefined): boolean {
  if (!match || typeof match !== "object") {
    return true;
  }
  return (
    isEmptyArray(match.toolNames) &&
    isEmptyArray(match.toolNamePatterns) &&
    isEmptyArray(match.risks) &&
    isEmptyArray(match.purposes) &&
    isEmptyArray(match.destinations) &&
    isEmptyArray(match.dataClasses) &&
    isEmptyArray(match.publishers) &&
    isEmptyArray(match.capabilities) &&
    isEmptyObject(match.metadata) &&
    isEmptyObject(match.input)
  );
}

function isEmptyArray(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

function isEmptyObject(value: unknown): boolean {
  return value === undefined || value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}
