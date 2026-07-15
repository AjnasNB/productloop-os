import type { SkillManifest, SkillRisk, ValidationIssue, ValidationResult } from "./types.js";

const PERMISSIVE_LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]);
const RISK_ORDER: Record<SkillRisk, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function validateSkillManifest(manifest: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isObject(manifest)) {
    return {
      valid: false,
      issues: [issue("manifest.invalid_type", "$", "Manifest must be an object.")]
    };
  }

  const candidate = manifest as unknown as SkillManifest;
  requireString(candidate.schemaVersion, "$.schemaVersion", "schema.required", issues);
  if (candidate.schemaVersion && candidate.schemaVersion !== "ajnas.skill.v1") {
    issues.push(issue("schema.unsupported", "$.schemaVersion", "Only ajnas.skill.v1 manifests are supported."));
  }
  requirePattern(candidate.id, "$.id", "id.invalid", /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/, issues);
  requireString(candidate.name, "$.name", "name.required", issues);
  requirePattern(candidate.version, "$.version", "version.invalid", /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, issues);
  requireString(candidate.description, "$.description", "description.required", issues);

  if (!PERMISSIVE_LICENSES.has(candidate.license)) {
    issues.push(issue("license.not_permissive", "$.license", "License must be MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, or ISC."));
  }

  if (!isObject(candidate.entrypoint)) {
    issues.push(issue("entrypoint.required", "$.entrypoint", "Entrypoint is required."));
  } else {
    if (!["module", "command", "mcp"].includes(candidate.entrypoint.type)) {
      issues.push(issue("entrypoint.type_invalid", "$.entrypoint.type", "Entrypoint type must be module, command, or mcp."));
    }
    requireString(candidate.entrypoint.value, "$.entrypoint.value", "entrypoint.value_required", issues);
  }

  if (!isObject(candidate.compatibility) || !candidate.compatibility.ajnasRuntime) {
    issues.push(issue("compatibility.runtime_required", "$.compatibility.ajnasRuntime", "Manifest must declare ajnasRuntime compatibility."));
  }

  if (!Array.isArray(candidate.capabilities) || candidate.capabilities.length === 0) {
    issues.push(issue("capabilities.required", "$.capabilities", "At least one capability is required."));
  } else {
    candidate.capabilities.forEach((capability, index) => {
      if (!isObject(capability)) {
        issues.push(issue("capability.invalid", `$.capabilities[${index}]`, "Capability must be an object."));
        return;
      }
      requirePattern(capability.name, `$.capabilities[${index}].name`, "capability.name_invalid", /^[a-z][a-z0-9.-]+$/, issues);
      requireString(capability.description, `$.capabilities[${index}].description`, "capability.description_required", issues);
      if (!["low", "medium", "high", "critical"].includes(capability.risk)) {
        issues.push(issue("capability.risk_invalid", `$.capabilities[${index}].risk`, "Capability risk must be low, medium, high, or critical."));
      }
    });
  }

  if (!isObject(candidate.permissions)) {
    issues.push(issue("permissions.required", "$.permissions", "Permissions are required."));
  } else {
    if (!["none", "allowlist"].includes(candidate.permissions.network)) {
      issues.push(issue("permissions.network_invalid", "$.permissions.network", "Network permission must be none or allowlist."));
    }
    if (candidate.permissions.network === "allowlist" && (!Array.isArray(candidate.permissions.allowlist) || candidate.permissions.allowlist.length === 0)) {
      issues.push(issue("permissions.allowlist_required", "$.permissions.allowlist", "Network allowlist mode requires at least one allowed endpoint."));
    }
    if (!["none", "read", "write"].includes(candidate.permissions.filesystem)) {
      issues.push(issue("permissions.filesystem_invalid", "$.permissions.filesystem", "Filesystem permission must be none, read, or write."));
    }
    if (typeof candidate.permissions.externalPublish !== "boolean") {
      issues.push(issue("permissions.external_publish_required", "$.permissions.externalPublish", "externalPublish must be a boolean."));
    }
    if (!["never", "on_high_risk", "always"].includes(candidate.permissions.humanApproval)) {
      issues.push(issue("permissions.approval_invalid", "$.permissions.humanApproval", "humanApproval must be never, on_high_risk, or always."));
    }
  }

  if (!isObject(candidate.trust)) {
    issues.push(issue("trust.required", "$.trust", "Trust metadata is required."));
  } else {
    if (!["first-party", "vendor", "community"].includes(candidate.trust.source)) {
      issues.push(issue("trust.source_invalid", "$.trust.source", "Trust source must be first-party, vendor, or community."));
    }
    requireString(candidate.trust.publisher, "$.trust.publisher", "trust.publisher_required", issues);
    requirePattern(candidate.trust.repository, "$.trust.repository", "trust.repository_invalid", /^https:\/\/.+/, issues);
    if (!isObject(candidate.trust.licenseEvidence)) {
      issues.push(issue("trust.license_evidence_required", "$.trust.licenseEvidence", "License evidence is required."));
    } else {
      requireString(candidate.trust.licenseEvidence.checkedAt, "$.trust.licenseEvidence.checkedAt", "trust.license_checked_at_required", issues);
      if (!["repository", "package", "manual"].includes(candidate.trust.licenseEvidence.kind)) {
        issues.push(issue("trust.license_kind_invalid", "$.trust.licenseEvidence.kind", "License evidence kind must be repository, package, or manual."));
      }
    }
  }

  if (requiresHumanApproval(candidate) && candidate.permissions?.humanApproval === "never") {
    issues.push(issue("approval.required_for_high_risk", "$.permissions.humanApproval", "High-risk skills, write access, and external publishing require human approval."));
  }

  return {
    valid: issues.filter((entry) => entry.severity === "error").length === 0,
    issues
  };
}

export function isHighRiskManifest(manifest: SkillManifest): boolean {
  return requiresHumanApproval(manifest);
}

export function permissiveLicenses(): string[] {
  return [...PERMISSIVE_LICENSES].sort();
}

function requiresHumanApproval(manifest: SkillManifest): boolean {
  const hasHighRiskCapability = Array.isArray(manifest.capabilities)
    ? manifest.capabilities.some((capability) => RISK_ORDER[capability.risk] >= RISK_ORDER.high)
    : false;
  return hasHighRiskCapability || manifest.permissions?.filesystem === "write" || manifest.permissions?.externalPublish === true;
}

function issue(code: string, path: string, message: string, severity: ValidationIssue["severity"] = "error"): ValidationIssue {
  return {
    code,
    path,
    message,
    severity
  };
}

function requireString(value: unknown, path: string, code: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(issue(code, path, "Value must be a non-empty string."));
  }
}

function requirePattern(value: unknown, path: string, code: string, pattern: RegExp, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !pattern.test(value)) {
    issues.push(issue(code, path, "Value does not match the required format."));
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
