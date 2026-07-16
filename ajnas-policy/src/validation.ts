import { normalizeJson } from "./stable-json.js";
import type { PolicyDefaultEffect, PolicyEffect, PolicyMatch, ValidationIssue, ValidationResult } from "./types.js";

const POLICY_EFFECTS = new Set<PolicyEffect>(["allow", "deny", "require_approval"]);
const DEFAULT_EFFECTS = new Set<PolicyDefaultEffect>(["allow", "deny"]);
const BUNDLE_KEYS = new Set(["schemaVersion", "id", "version", "description", "owner", "defaultEffect", "rules", "metadata"]);
const RULE_KEYS = new Set(["id", "description", "effect", "reason", "approvalPrompt", "priority", "enabled", "match"]);
const MATCH_KEYS = new Set(["toolNames", "toolNamePatterns", "risks", "purposes", "destinations", "dataClasses", "publishers", "capabilities", "metadata", "input"]);
const ARRAY_CRITERIA = ["toolNames", "toolNamePatterns", "risks", "purposes", "destinations", "dataClasses", "publishers", "capabilities"] as const;

export function validatePolicyBundle(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  let normalized: unknown;
  try {
    normalized = normalizeJson(value);
  } catch (error) {
    return {
      valid: false,
      issues: [issue("bundle.json", "$", error instanceof Error ? error.message : "Policy bundle must contain canonical JSON values")]
    };
  }
  if (!isRecord(normalized)) {
    return { valid: false, issues: [issue("bundle.type", "$", "Policy bundle must be a JSON object")] };
  }
  const bundle = normalized;
  rejectUnknownKeys(bundle, BUNDLE_KEYS, "$", "bundle.unknown_field", issues);
  if (bundle.schemaVersion !== "ajnas.policy.bundle.v1") issues.push(issue("bundle.schema", "schemaVersion", "schemaVersion must be ajnas.policy.bundle.v1"));
  requireString(bundle.id, "id", "bundle.id_required", "Policy bundle id is required", issues);
  requireString(bundle.version, "version", "bundle.version_required", "Policy bundle version is required", issues);
  optionalString(bundle.description, "description", "bundle.description", issues);
  optionalString(bundle.owner, "owner", "bundle.owner", issues);
  if (!DEFAULT_EFFECTS.has(bundle.defaultEffect as PolicyDefaultEffect)) issues.push(issue("bundle.default_effect", "defaultEffect", "defaultEffect must be allow or deny"));
  if (bundle.metadata !== undefined) validateJsonObject(bundle.metadata, "metadata", "bundle.metadata", issues);
  if (!Array.isArray(bundle.rules)) {
    issues.push(issue("bundle.rules_required", "rules", "rules must be an array"));
    return { valid: false, issues };
  }

  const seenRuleIds = new Set<string>();
  bundle.rules.forEach((candidate, index) => validateRule(candidate, index, seenRuleIds, issues));
  return { valid: issues.length === 0, issues };
}

function validateRule(value: unknown, index: number, seenRuleIds: Set<string>, issues: ValidationIssue[]): void {
  const path = `rules.${index}`;
  if (!isRecord(value)) {
    issues.push(issue("rule.type", path, "Rule must be a JSON object"));
    return;
  }
  rejectUnknownKeys(value, RULE_KEYS, path, "rule.unknown_field", issues);
  if (!isNonEmptyString(value.id)) issues.push(issue("rule.id_required", `${path}.id`, "Rule id is required"));
  else if (seenRuleIds.has(value.id)) issues.push(issue("rule.duplicate_id", `${path}.id`, `Rule id ${value.id} is duplicated`));
  else seenRuleIds.add(value.id);
  optionalString(value.description, `${path}.description`, "rule.description", issues);
  if (!POLICY_EFFECTS.has(value.effect as PolicyEffect)) issues.push(issue("rule.effect", `${path}.effect`, "Rule effect must be allow, deny, or require_approval"));
  requireString(value.reason, `${path}.reason`, "rule.reason_required", "Rule reason is required", issues);
  optionalString(value.approvalPrompt, `${path}.approvalPrompt`, "rule.approval_prompt", issues);
  if (value.approvalPrompt !== undefined && value.effect !== "require_approval") {
    issues.push(issue("rule.approval_prompt_effect", `${path}.approvalPrompt`, "approvalPrompt is only valid for require_approval rules"));
  }
  if (value.priority !== undefined && (typeof value.priority !== "number" || !Number.isFinite(value.priority))) {
    issues.push(issue("rule.priority", `${path}.priority`, "Rule priority must be a finite number"));
  }
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") issues.push(issue("rule.enabled", `${path}.enabled`, "enabled must be a boolean"));
  validateMatch(value.match, `${path}.match`, issues);
}

function validateMatch(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue("rule.match_type", path, "Rule match must be a JSON object"));
    return;
  }
  rejectUnknownKeys(value, MATCH_KEYS, path, "rule.match_unknown_field", issues);
  let hasCriterion = false;
  for (const key of ARRAY_CRITERIA) {
    const criterion = value[key];
    if (criterion === undefined) continue;
    if (!Array.isArray(criterion) || criterion.length === 0) {
      issues.push(issue("rule.match_array", `${path}.${key}`, `${key} must be a non-empty array of non-empty strings`));
      continue;
    }
    hasCriterion = true;
    criterion.forEach((item, index) => {
      if (!isNonEmptyString(item)) issues.push(issue("rule.match_value", `${path}.${key}.${index}`, "Match values must be non-empty strings"));
    });
  }
  for (const key of ["metadata", "input"] as const) {
    const criterion = value[key];
    if (criterion === undefined) continue;
    if (isRecord(criterion) && Object.keys(criterion).length > 0) hasCriterion = true;
    validateJsonObject(criterion, `${path}.${key}`, "rule.match_record", issues);
  }
  if (!hasCriterion) issues.push(issue("rule.empty_match", path, "Rule match must include at least one non-empty criterion"));
}

export function isEmptyMatch(match: PolicyMatch | undefined): boolean {
  if (!isRecord(match)) return true;
  return !ARRAY_CRITERIA.some((key) => Array.isArray(match[key]) && match[key]!.length > 0)
    && !(["metadata", "input"] as const).some((key) => isRecord(match[key]) && Object.keys(match[key]!).length > 0);
}

function validateJsonObject(value: unknown, path: string, code: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(code, path, "Expected a JSON object"));
    return;
  }
  try {
    normalizeJson(value);
  } catch (error) {
    issues.push(issue(code, path, error instanceof Error ? error.message : "Invalid JSON value"));
  }
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, path: string, code: string, issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(issue(code, `${path}.${key}`, `Unsupported field ${key}`));
}

function optionalString(value: unknown, path: string, code: string, issues: ValidationIssue[]): void {
  if (value !== undefined && !isNonEmptyString(value)) issues.push(issue(code, path, "Value must be a non-empty string"));
}

function requireString(value: unknown, path: string, code: string, message: string, issues: ValidationIssue[]): void {
  if (!isNonEmptyString(value)) issues.push(issue(code, path, message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function issue(code: string, path: string, message: string): ValidationIssue { return { code, path, message }; }
