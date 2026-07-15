import type {
  BrowserResearchAction,
  BrowserResearchPlan,
  BrowserResearchPolicy,
  BrowserResearchStep,
  ValidationIssue,
  ValidationResult
} from "./types.js";
import { sha256Digest } from "./stable-json.js";

export const BROWSER_RESEARCH_PLAN_SCHEMA = "ajnas.browser.research.plan.v1" as const;
export const BROWSER_RESEARCH_ACTIONS: BrowserResearchAction[] = ["search", "open", "extract", "crawl", "note"];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(path: string, message: string, severity: "error" | "warning" = "error"): ValidationIssue {
  return { path, message, severity };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAction(value: unknown): value is BrowserResearchAction {
  return typeof value === "string" && BROWSER_RESEARCH_ACTIONS.includes(value as BrowserResearchAction);
}

function validateUrl(value: unknown): boolean {
  if (!isNonEmptyString(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateStringArray(value: unknown, path: string, issues: ValidationIssue[]): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push(issue(path, "Expected an array of strings"));
    return undefined;
  }
  const strings: string[] = [];
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      issues.push(issue(`${path}[${index}]`, "Expected a non-empty string"));
      return;
    }
    strings.push(item);
  });
  return strings;
}

function validatePolicy(value: unknown, issues: ValidationIssue[]): BrowserResearchPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isObject(value)) {
    issues.push(issue("$.policy", "Expected a policy object"));
    return undefined;
  }

  const policy = value as BrowserResearchPolicy;
  validateStringArray(value.allowedOrigins, "$.policy.allowedOrigins", issues);
  validateStringArray(value.blockedOrigins, "$.policy.blockedOrigins", issues);

  if (value.allowedActions !== undefined) {
    if (!Array.isArray(value.allowedActions)) {
      issues.push(issue("$.policy.allowedActions", "Expected an array of browser research actions"));
    } else {
      value.allowedActions.forEach((action, index) => {
        if (!isAction(action)) {
          issues.push(issue(`$.policy.allowedActions[${index}]`, `Expected one of: ${BROWSER_RESEARCH_ACTIONS.join(", ")}`));
        }
      });
    }
  }

  if (value.requireApprovalForActions !== undefined) {
    if (!Array.isArray(value.requireApprovalForActions)) {
      issues.push(issue("$.policy.requireApprovalForActions", "Expected an array of browser research actions"));
    } else {
      value.requireApprovalForActions.forEach((action, index) => {
        if (!isAction(action)) {
          issues.push(issue(`$.policy.requireApprovalForActions[${index}]`, `Expected one of: ${BROWSER_RESEARCH_ACTIONS.join(", ")}`));
        }
      });
    }
  }

  const maxSteps = value.maxSteps;
  if (maxSteps !== undefined && (typeof maxSteps !== "number" || !Number.isInteger(maxSteps) || maxSteps < 1)) {
    issues.push(issue("$.policy.maxSteps", "Expected a positive integer"));
  }

  if (value.citationRequired !== undefined && typeof value.citationRequired !== "boolean") {
    issues.push(issue("$.policy.citationRequired", "Expected a boolean"));
  }

  if (value.retainFullText !== undefined && typeof value.retainFullText !== "boolean") {
    issues.push(issue("$.policy.retainFullText", "Expected a boolean"));
  }

  return policy;
}

function validateStep(value: unknown, index: number, issues: ValidationIssue[]): BrowserResearchStep | undefined {
  const path = `$.steps[${index}]`;
  if (!isObject(value)) {
    issues.push(issue(path, "Expected a step object"));
    return undefined;
  }

  if (!isNonEmptyString(value.id)) {
    issues.push(issue(`${path}.id`, "Expected a non-empty step id"));
  }
  if (!isAction(value.action)) {
    issues.push(issue(`${path}.action`, `Expected one of: ${BROWSER_RESEARCH_ACTIONS.join(", ")}`));
  }
  if (!isNonEmptyString(value.purpose)) {
    issues.push(issue(`${path}.purpose`, "Expected a non-empty step purpose"));
  }

  const action = value.action;
  if (action === "search" && !isNonEmptyString(value.query)) {
    issues.push(issue(`${path}.query`, "Search steps require a query"));
  }
  if ((action === "open" || action === "extract" || action === "crawl") && !validateUrl(value.url)) {
    issues.push(issue(`${path}.url`, `${action} steps require an http(s) URL`));
  }
  const maxPages = value.maxPages;
  if (maxPages !== undefined && (typeof maxPages !== "number" || !Number.isInteger(maxPages) || maxPages < 1)) {
    issues.push(issue(`${path}.maxPages`, "Expected a positive integer"));
  }
  if (value.requiresApproval !== undefined && typeof value.requiresApproval !== "boolean") {
    issues.push(issue(`${path}.requiresApproval`, "Expected a boolean"));
  }

  return value as unknown as BrowserResearchStep;
}

export function validateBrowserResearchPlan(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isObject(value)) {
    return { valid: false, issues: [issue("$", "Expected a browser research plan object")] };
  }

  if (value.schema !== BROWSER_RESEARCH_PLAN_SCHEMA) {
    issues.push(issue("$.schema", `Expected ${BROWSER_RESEARCH_PLAN_SCHEMA}`));
  }
  if (!isNonEmptyString(value.id)) {
    issues.push(issue("$.id", "Expected a non-empty plan id"));
  }
  if (!isNonEmptyString(value.objective)) {
    issues.push(issue("$.objective", "Expected a non-empty objective"));
  }
  if (value.createdAt !== undefined && !isNonEmptyString(value.createdAt)) {
    issues.push(issue("$.createdAt", "Expected an ISO timestamp string"));
  }

  validatePolicy(value.policy, issues);

  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    issues.push(issue("$.steps", "Expected at least one browser research step"));
  } else {
    const seen = new Set<string>();
    value.steps.forEach((step, index) => {
      const parsed = validateStep(step, index, issues);
      if (parsed?.id) {
        if (seen.has(parsed.id)) {
          issues.push(issue(`$.steps[${index}].id`, `Duplicate step id: ${parsed.id}`));
        }
        seen.add(parsed.id);
      }
    });
  }

  if (isObject(value.output)) {
    if (value.output.requireCitations !== undefined && typeof value.output.requireCitations !== "boolean") {
      issues.push(issue("$.output.requireCitations", "Expected a boolean"));
    }
    if (value.output.exportProvenance !== undefined && typeof value.output.exportProvenance !== "boolean") {
      issues.push(issue("$.output.exportProvenance", "Expected a boolean"));
    }
    if (value.output.format !== undefined && !["json", "jsonl", "markdown"].includes(String(value.output.format))) {
      issues.push(issue("$.output.format", "Expected json, jsonl, or markdown"));
    }
  } else if (value.output !== undefined) {
    issues.push(issue("$.output", "Expected an output requirements object"));
  }

  return {
    valid: issues.every((current) => current.severity !== "error"),
    issues
  };
}

export function assertBrowserResearchPlan(value: unknown): BrowserResearchPlan {
  const result = validateBrowserResearchPlan(value);
  if (!result.valid) {
    const errors = result.issues.map((current) => `${current.path}: ${current.message}`).join("; ");
    throw new Error(`Invalid browser research plan: ${errors}`);
  }
  return value as BrowserResearchPlan;
}

export function computeBrowserResearchPlanDigest(plan: unknown): string {
  return sha256Digest(plan);
}
