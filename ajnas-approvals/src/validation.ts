import type {
  ApprovalQuorumStrategy,
  ApprovalRisk,
  ApprovalSubject,
  ApprovalWorkflow,
  ValidationIssue,
  ValidationResult
} from "./types.js";
import { sha256Digest } from "./stable-json.js";

const RISKS = new Set<ApprovalRisk>(["low", "medium", "high", "critical"]);
const QUORUM_STRATEGIES = new Set<string>(["any", "all", "majority", "count"]);
const REVIEWER_KINDS = new Set(["user", "group", "role"]);
const SUBJECT_KINDS = new Set(["runtime-tool", "connector-invocation", "package-release", "policy-exception", "provenance-export", "custom"]);

export function validateApprovalWorkflow(workflow: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isObject(workflow)) {
    return { valid: false, issues: [issue("WORKFLOW_OBJECT", "$", "Workflow must be an object.")] };
  }

  if (workflow.schemaVersion !== "ajnas.approval.workflow.v1") {
    issues.push(issue("WORKFLOW_SCHEMA", "$.schemaVersion", "schemaVersion must be ajnas.approval.workflow.v1."));
  }
  requireString(workflow.id, "$.id", "WORKFLOW_ID", issues);
  requireString(workflow.version, "$.version", "WORKFLOW_VERSION", issues);
  requireString(workflow.name, "$.name", "WORKFLOW_NAME", issues);
  requireString(workflow.owner, "$.owner", "WORKFLOW_OWNER", issues);

  if (!Array.isArray(workflow.stages) || workflow.stages.length === 0) {
    issues.push(issue("WORKFLOW_STAGES", "$.stages", "At least one approval stage is required."));
  } else {
    const stageIds = new Set<string>();
    workflow.stages.forEach((stage, index) => {
      const path = `$.stages[${index}]`;
      if (!isObject(stage)) {
        issues.push(issue("STAGE_OBJECT", path, "Stage must be an object."));
        return;
      }
      requireString(stage.id, `${path}.id`, "STAGE_ID", issues);
      if (typeof stage.id === "string") {
        if (stageIds.has(stage.id)) {
          issues.push(issue("STAGE_DUPLICATE", `${path}.id`, `Stage id ${stage.id} is duplicated.`));
        }
        stageIds.add(stage.id);
      }
      requireString(stage.name, `${path}.name`, "STAGE_NAME", issues);

      if (!Array.isArray(stage.reviewers) || stage.reviewers.length === 0) {
        issues.push(issue("STAGE_REVIEWERS", `${path}.reviewers`, "Stage must declare at least one reviewer."));
      } else {
        const reviewerIds = new Set<string>();
        stage.reviewers.forEach((reviewer, reviewerIndex) => {
          const reviewerPath = `${path}.reviewers[${reviewerIndex}]`;
          if (!isObject(reviewer)) {
            issues.push(issue("REVIEWER_OBJECT", reviewerPath, "Reviewer must be an object."));
            return;
          }
          requireString(reviewer.id, `${reviewerPath}.id`, "REVIEWER_ID", issues);
          if (typeof reviewer.id === "string") {
            if (reviewerIds.has(reviewer.id)) {
              issues.push(issue("REVIEWER_DUPLICATE", `${reviewerPath}.id`, `Reviewer id ${reviewer.id} is duplicated in this stage.`));
            }
            reviewerIds.add(reviewer.id);
          }
          if (typeof reviewer.kind !== "string" || !REVIEWER_KINDS.has(reviewer.kind)) {
            issues.push(issue("REVIEWER_KIND", `${reviewerPath}.kind`, "Reviewer kind must be user, group, or role."));
          }
        });
      }

      if (!isObject(stage.quorum)) {
        issues.push(issue("STAGE_QUORUM", `${path}.quorum`, "Stage quorum is required."));
      } else {
        if (typeof stage.quorum.strategy !== "string" || !QUORUM_STRATEGIES.has(stage.quorum.strategy)) {
          issues.push(issue("QUORUM_STRATEGY", `${path}.quorum.strategy`, "Quorum strategy must be any, all, majority, or count."));
        }
        if (stage.quorum.strategy === "count") {
          const reviewerCount = Array.isArray(stage.reviewers) ? stage.reviewers.length : 0;
          const required = stage.quorum.required;
          if (typeof required !== "number" || !Number.isInteger(required) || required < 1 || required > reviewerCount) {
            issues.push(issue("QUORUM_REQUIRED", `${path}.quorum.required`, "Count quorum requires a number between 1 and reviewer count."));
          }
        }
      }

      if (stage.escalation !== undefined) {
        if (!isObject(stage.escalation)) {
          issues.push(issue("ESCALATION_OBJECT", `${path}.escalation`, "Escalation must be an object."));
        } else {
          if (typeof stage.escalation.afterHours !== "number" || stage.escalation.afterHours <= 0) {
            issues.push(issue("ESCALATION_AFTER_HOURS", `${path}.escalation.afterHours`, "Escalation afterHours must be greater than zero."));
          }
          if (!Array.isArray(stage.escalation.notify) || stage.escalation.notify.length === 0) {
            issues.push(issue("ESCALATION_NOTIFY", `${path}.escalation.notify`, "Escalation must declare at least one notification target."));
          }
        }
      }
    });

    workflow.stages.forEach((stage, index) => {
      if (isObject(stage) && isObject(stage.escalation) && typeof stage.escalation.stageId === "string" && !stageIds.has(stage.escalation.stageId)) {
        issues.push(issue("ESCALATION_STAGE", `$.stages[${index}].escalation.stageId`, `Escalation target ${stage.escalation.stageId} does not exist.`));
      }
    });
  }

  if (isObject(workflow.policy)) {
    if (workflow.policy.defaultTtlHours !== undefined && (typeof workflow.policy.defaultTtlHours !== "number" || workflow.policy.defaultTtlHours <= 0)) {
      issues.push(issue("POLICY_TTL", "$.policy.defaultTtlHours", "defaultTtlHours must be greater than zero."));
    }
    const maxDelegationDepth = workflow.policy.maxDelegationDepth;
    if (
      maxDelegationDepth !== undefined &&
      (typeof maxDelegationDepth !== "number" || !Number.isInteger(maxDelegationDepth) || maxDelegationDepth < 0)
    ) {
      issues.push(issue("POLICY_DELEGATION_DEPTH", "$.policy.maxDelegationDepth", "maxDelegationDepth must be a non-negative integer."));
    }
    if (workflow.policy.allowedRiskLevels !== undefined) {
      validateRiskArray(workflow.policy.allowedRiskLevels, "$.policy.allowedRiskLevels", issues);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateApprovalSubject(subject: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isObject(subject)) {
    return { valid: false, issues: [issue("SUBJECT_OBJECT", "$", "Approval subject must be an object.")] };
  }
  requireString(subject.id, "$.id", "SUBJECT_ID", issues);
  if (typeof subject.kind !== "string" || !SUBJECT_KINDS.has(subject.kind)) {
    issues.push(issue("SUBJECT_KIND", "$.kind", "Subject kind is not recognized."));
  }
  requireString(subject.title, "$.title", "SUBJECT_TITLE", issues);
  requireString(subject.summary, "$.summary", "SUBJECT_SUMMARY", issues);
  if (typeof subject.risk !== "string" || !RISKS.has(subject.risk as ApprovalRisk)) {
    issues.push(issue("SUBJECT_RISK", "$.risk", "Subject risk must be low, medium, high, or critical."));
  }
  requireString(subject.requestedAction, "$.requestedAction", "SUBJECT_ACTION", issues);
  validateOptionalStringArray(subject.destinations, "$.destinations", "SUBJECT_DESTINATIONS", issues);
  validateOptionalStringArray(subject.dataClasses, "$.dataClasses", "SUBJECT_DATA_CLASSES", issues);
  validateOptionalStringArray(subject.artifactDigests, "$.artifactDigests", "SUBJECT_ARTIFACT_DIGESTS", issues);
  return { valid: issues.length === 0, issues };
}

export function computeApprovalWorkflowDigest(workflow: ApprovalWorkflow): string {
  return sha256Digest(workflow);
}

export function computeApprovalSubjectDigest(subject: ApprovalSubject): string {
  return sha256Digest(subject);
}

function validateRiskArray(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(issue("RISK_ARRAY", path, "Risk list must be a non-empty array."));
    return;
  }
  value.forEach((risk, index) => {
    if (typeof risk !== "string" || !RISKS.has(risk as ApprovalRisk)) {
      issues.push(issue("RISK_VALUE", `${path}[${index}]`, "Risk must be low, medium, high, or critical."));
    }
  });
}

function validateOptionalStringArray(value: unknown, path: string, code: string, issues: ValidationIssue[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    issues.push(issue(code, path, "Value must be an array of strings."));
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      issues.push(issue(code, `${path}[${index}]`, "Array entries must be non-empty strings."));
    }
  });
}

function requireString(value: unknown, path: string, code: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.length === 0) {
    issues.push(issue(code, path, "Value must be a non-empty string."));
  }
}

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
