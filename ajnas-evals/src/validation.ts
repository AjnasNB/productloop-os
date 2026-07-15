import { sha256Digest } from "./stable-json.js";
import type { EvalAssertion, EvalAssertionKind, EvalCase, EvalSuite, ValidationIssue, ValidationResult } from "./types.js";

const ASSERTION_KINDS = new Set<EvalAssertionKind>([
  "run.status",
  "json.path",
  "event.type.count",
  "policy.decision",
  "approval.status",
  "provenance.valid",
  "connector.trust",
  "browser.step"
]);

export function validateEvalSuite(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      issues: [{ code: "suite.type", path: "$", message: "eval suite must be an object" }]
    };
  }

  const suite = value as Partial<EvalSuite>;
  requireLiteral(suite.schemaVersion, "ajnas.eval.suite.v1", "$.schemaVersion", issues);
  requireString(suite.id, "$.id", issues);
  requireString(suite.version, "$.version", issues);

  if (!Array.isArray(suite.cases) || suite.cases.length === 0) {
    issues.push({ code: "cases.required", path: "$.cases", message: "suite must contain at least one case" });
  } else {
    const caseIds = new Set<string>();
    suite.cases.forEach((testCase, index) => {
      validateCase(testCase, `$.cases[${index}]`, issues);
      if (isObject(testCase) && typeof testCase.id === "string") {
        if (caseIds.has(testCase.id)) {
          issues.push({
            code: "case.id.duplicate",
            path: `$.cases[${index}].id`,
            message: `case id ${testCase.id} is duplicated`
          });
        }
        caseIds.add(testCase.id);
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function computeEvalSuiteDigest(suite: EvalSuite): string {
  return sha256Digest(suite);
}

function validateCase(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(value)) {
    issues.push({ code: "case.type", path, message: "case must be an object" });
    return;
  }

  const testCase = value as Partial<EvalCase>;
  requireString(testCase.id, `${path}.id`, issues);

  if (!Array.isArray(testCase.assertions) || testCase.assertions.length === 0) {
    issues.push({
      code: "case.assertions.required",
      path: `${path}.assertions`,
      message: "case must contain at least one assertion"
    });
    return;
  }

  const assertionIds = new Set<string>();
  testCase.assertions.forEach((assertion, index) => {
    validateAssertion(assertion, `${path}.assertions[${index}]`, issues);
    if (isObject(assertion) && typeof assertion.id === "string") {
      if (assertionIds.has(assertion.id)) {
        issues.push({
          code: "assertion.id.duplicate",
          path: `${path}.assertions[${index}].id`,
          message: `assertion id ${assertion.id} is duplicated within case ${testCase.id ?? index}`
        });
      }
      assertionIds.add(assertion.id);
    }
  });
}

function validateAssertion(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(value)) {
    issues.push({ code: "assertion.type", path, message: "assertion must be an object" });
    return;
  }

  const assertion = value as Partial<EvalAssertion>;
  requireString(assertion.id, `${path}.id`, issues);

  if (typeof assertion.kind !== "string" || !ASSERTION_KINDS.has(assertion.kind as EvalAssertionKind)) {
    issues.push({
      code: "assertion.kind",
      path: `${path}.kind`,
      message: `assertion kind must be one of ${Array.from(ASSERTION_KINDS).join(", ")}`
    });
    return;
  }

  if (assertion.kind === "run.status") {
    requireString(assertion.status, `${path}.status`, issues);
  }
  if (assertion.kind === "json.path") {
    requireString(assertion.path, `${path}.path`, issues);
    if (!hasOwn(assertion, "equals") && !hasOwn(assertion, "includes")) {
      issues.push({
        code: "assertion.json.expected",
        path,
        message: "json.path assertion requires equals or includes"
      });
    }
  }
  if (assertion.kind === "event.type.count") {
    requireString(assertion.eventType, `${path}.eventType`, issues);
    if (
      typeof assertion.min !== "number" &&
      typeof assertion.max !== "number" &&
      typeof assertion.equals !== "number"
    ) {
      issues.push({
        code: "assertion.event.count",
        path,
        message: "event.type.count assertion requires min, max, or numeric equals"
      });
    }
  }
  if (assertion.kind === "policy.decision") {
    requireString(assertion.decision, `${path}.decision`, issues);
  }
  if (assertion.kind === "approval.status") {
    requireString(assertion.status, `${path}.status`, issues);
  }
  if (assertion.kind === "provenance.valid" && typeof assertion.valid !== "boolean") {
    issues.push({ code: "assertion.provenance.valid", path: `${path}.valid`, message: "valid must be boolean" });
  }
  if (assertion.kind === "connector.trust") {
    requireString(assertion.connectorId, `${path}.connectorId`, issues);
    requireString(assertion.trustTier, `${path}.trustTier`, issues);
  }
  if (assertion.kind === "browser.step") {
    requireString(assertion.stepType, `${path}.stepType`, issues);
  }
}

function requireLiteral(value: unknown, expected: string, path: string, issues: ValidationIssue[]): void {
  if (value !== expected) {
    issues.push({ code: "literal", path, message: `expected ${expected}` });
  }
}

function requireString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ code: "string.required", path, message: "must be a non-empty string" });
  }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
