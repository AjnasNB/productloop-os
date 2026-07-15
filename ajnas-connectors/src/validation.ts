import { sha256Digest } from "./stable-json.js";
import type {
  ConnectorDataClass,
  ConnectorKind,
  ConnectorManifest,
  ConnectorOperation,
  ConnectorRisk,
  ValidationIssue,
  ValidationResult
} from "./types.js";

export const PERMISSIVE_LICENSES = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"] as const;

const CONNECTOR_KINDS: ConnectorKind[] = ["mcp", "rest", "browser", "search", "crawl", "github", "npm", "publish", "custom"];
const TRANSPORTS = ["stdio", "http", "sse", "websocket", "browser", "local"];
const AUTH_TYPES = ["none", "api_key", "oauth2", "bearer", "basic", "custom"];
const OPERATIONS: ConnectorOperation[] = ["read", "write", "execute", "search", "crawl", "publish", "delete"];
const DATA_CLASSES: ConnectorDataClass[] = ["public", "internal", "confidential", "personal", "credential", "secret"];
const RISKS: ConnectorRisk[] = ["low", "medium", "high", "critical"];
const REVIEW_STATUSES = ["unreviewed", "reviewed", "approved", "blocked"];
const ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const RISK_RANK: Record<ConnectorRisk, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function validateConnectorManifest(manifest: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(manifest)) {
    return {
      valid: false,
      issues: [{ code: "MANIFEST_OBJECT_REQUIRED", path: "$", message: "Connector manifest must be an object." }]
    };
  }

  const connector = manifest as unknown as ConnectorManifest;

  if (connector.schemaVersion !== "ajnas.connector.manifest.v1") {
    issue(issues, "SCHEMA_VERSION_INVALID", "$.schemaVersion", "Expected ajnas.connector.manifest.v1.");
  }

  requireId(connector.id, "$.id", issues);
  requireVersion(connector.version, "$.version", issues);
  requireString(connector.name, "$.name", issues);
  requireString(connector.description, "$.description", issues);

  if (!CONNECTOR_KINDS.includes(connector.kind)) {
    issue(issues, "KIND_INVALID", "$.kind", `Kind must be one of ${CONNECTOR_KINDS.join(", ")}.`);
  }

  validatePublisher(connector, issues);
  validateRuntime(connector, issues);
  validateAuth(connector, issues);
  validatePermissions(connector, issues);
  validateCapabilities(connector, issues);
  validateTrust(connector, issues);
  validatePolicyHints(connector, issues);

  return { valid: issues.length === 0, issues };
}

export function computeConnectorDigest(manifest: ConnectorManifest): string {
  return sha256Digest(manifest);
}

export function riskAtLeast(risk: ConnectorRisk, minimum: ConnectorRisk): boolean {
  return RISK_RANK[risk] >= RISK_RANK[minimum];
}

export function maxRisk(risks: ConnectorRisk[]): ConnectorRisk {
  let selected: ConnectorRisk = "low";
  for (const risk of risks) {
    if (RISK_RANK[risk] > RISK_RANK[selected]) {
      selected = risk;
    }
  }
  return selected;
}

function validatePublisher(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!isRecord(connector.publisher)) {
    issue(issues, "PUBLISHER_INVALID", "$.publisher", "Publisher metadata is required.");
    return;
  }
  requireString(connector.publisher.name, "$.publisher.name", issues);
  optionalString(connector.publisher.url, "$.publisher.url", issues);
  optionalString(connector.publisher.contact, "$.publisher.contact", issues);
}

function validateRuntime(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!isRecord(connector.runtime)) {
    issue(issues, "RUNTIME_INVALID", "$.runtime", "Runtime metadata is required.");
    return;
  }
  if (!TRANSPORTS.includes(connector.runtime.transport)) {
    issue(issues, "TRANSPORT_INVALID", "$.runtime.transport", `Transport must be one of ${TRANSPORTS.join(", ")}.`);
  }
  optionalString(connector.runtime.entrypoint, "$.runtime.entrypoint", issues);
  optionalString(connector.runtime.node, "$.runtime.node", issues);
  optionalString(connector.runtime.protocol, "$.runtime.protocol", issues);
}

function validateAuth(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!isRecord(connector.auth)) {
    issue(issues, "AUTH_INVALID", "$.auth", "Auth metadata is required.");
    return;
  }
  if (!AUTH_TYPES.includes(connector.auth.type)) {
    issue(issues, "AUTH_TYPE_INVALID", "$.auth.type", `Auth type must be one of ${AUTH_TYPES.join(", ")}.`);
  }
  if (connector.auth.secretRefs !== undefined) {
    validateStringArray(connector.auth.secretRefs, "$.auth.secretRefs", issues, { nonEmpty: true });
  }
  if (connector.auth.scopes !== undefined) {
    validateStringArray(connector.auth.scopes, "$.auth.scopes", issues, { nonEmpty: true });
  }
  if (connector.auth.type === "none" && connector.auth.secretRefs && connector.auth.secretRefs.length > 0) {
    issue(issues, "AUTH_SECRET_REF_WITH_NONE", "$.auth.secretRefs", "Auth type none cannot declare secret references.");
  }
}

function validatePermissions(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!Array.isArray(connector.permissions) || connector.permissions.length === 0) {
    issue(issues, "PERMISSIONS_REQUIRED", "$.permissions", "At least one connector permission is required.");
    return;
  }

  const ids = new Set<string>();
  connector.permissions.forEach((permission, index) => {
    const path = `$.permissions[${index}]`;
    if (!isRecord(permission)) {
      issue(issues, "PERMISSION_INVALID", path, "Permission must be an object.");
      return;
    }
    requireId(permission.id, `${path}.id`, issues);
    if (ids.has(permission.id)) {
      issue(issues, "PERMISSION_ID_DUPLICATE", `${path}.id`, `Duplicate permission id ${permission.id}.`);
    }
    ids.add(permission.id);
    requireString(permission.purpose, `${path}.purpose`, issues);
    validateEnumArray(permission.operations, OPERATIONS, `${path}.operations`, issues);
    validateStringArray(permission.resources, `${path}.resources`, issues, { nonEmpty: true });
    validateEnumArray(permission.dataClasses, DATA_CLASSES, `${path}.dataClasses`, issues);
    validateStringArray(permission.destinations, `${path}.destinations`, issues, { nonEmpty: true });
    validateRisk(permission.risk, `${path}.risk`, issues);

    if ((permission.operations?.includes("publish") || permission.operations?.includes("delete")) && !riskAtLeast(permission.risk, "high")) {
      issue(issues, "PERMISSION_RISK_TOO_LOW", `${path}.risk`, "Publish and delete permissions must be high or critical risk.");
    }
    if ((permission.dataClasses?.includes("credential") || permission.dataClasses?.includes("secret")) && !riskAtLeast(permission.risk, "high")) {
      issue(issues, "PERMISSION_SECRET_RISK_TOO_LOW", `${path}.risk`, "Credential and secret data classes must be high or critical risk.");
    }
  });
}

function validateCapabilities(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!Array.isArray(connector.capabilities) || connector.capabilities.length === 0) {
    issue(issues, "CAPABILITIES_REQUIRED", "$.capabilities", "At least one connector capability is required.");
    return;
  }

  const ids = new Set<string>();
  connector.capabilities.forEach((capability, index) => {
    const path = `$.capabilities[${index}]`;
    if (!isRecord(capability)) {
      issue(issues, "CAPABILITY_INVALID", path, "Capability must be an object.");
      return;
    }
    requireId(capability.id, `${path}.id`, issues);
    if (ids.has(capability.id)) {
      issue(issues, "CAPABILITY_ID_DUPLICATE", `${path}.id`, `Duplicate capability id ${capability.id}.`);
    }
    ids.add(capability.id);
    requireString(capability.name, `${path}.name`, issues);
    requireString(capability.description, `${path}.description`, issues);
    validateEnumArray(capability.operations, OPERATIONS, `${path}.operations`, issues);
    validateEnumArray(capability.dataClasses, DATA_CLASSES, `${path}.dataClasses`, issues);
    validateStringArray(capability.destinations, `${path}.destinations`, issues, { nonEmpty: true });
    validateRisk(capability.risk, `${path}.risk`, issues);
    if ((capability.operations?.includes("publish") || capability.operations?.includes("delete")) && capability.requiresApproval !== true) {
      issue(issues, "CAPABILITY_APPROVAL_REQUIRED", `${path}.requiresApproval`, "Publish and delete capabilities must require approval.");
    }
    if ((capability.dataClasses?.includes("credential") || capability.dataClasses?.includes("secret")) && !riskAtLeast(capability.risk, "high")) {
      issue(issues, "CAPABILITY_SECRET_RISK_TOO_LOW", `${path}.risk`, "Credential and secret capabilities must be high or critical risk.");
    }
  });
}

function validateTrust(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!isRecord(connector.trust)) {
    issue(issues, "TRUST_INVALID", "$.trust", "Trust metadata is required.");
    return;
  }
  requireString(connector.trust.license, "$.trust.license", issues);
  if (typeof connector.trust.license === "string" && !PERMISSIVE_LICENSES.includes(connector.trust.license as (typeof PERMISSIVE_LICENSES)[number])) {
    issue(issues, "LICENSE_NOT_PERMISSIVE", "$.trust.license", "License must be MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, or ISC.");
  }
  if (!REVIEW_STATUSES.includes(connector.trust.reviewStatus)) {
    issue(issues, "TRUST_REVIEW_STATUS_INVALID", "$.trust.reviewStatus", `Review status must be one of ${REVIEW_STATUSES.join(", ")}.`);
  }
  optionalString(connector.trust.sourceUrl, "$.trust.sourceUrl", issues);
  optionalString(connector.trust.homepageUrl, "$.trust.homepageUrl", issues);
  optionalString(connector.trust.packageName, "$.trust.packageName", issues);
  optionalString(connector.trust.packageVersion, "$.trust.packageVersion", issues);
  optionalString(connector.trust.reviewedBy, "$.trust.reviewedBy", issues);
  optionalString(connector.trust.reviewedAt, "$.trust.reviewedAt", issues);
  if (connector.trust.sandbox !== undefined) {
    validateSandbox(connector, issues);
  }
  if (connector.trust.attestations !== undefined) {
    validateAttestations(connector, issues);
  }
}

function validateSandbox(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  const sandbox = connector.trust.sandbox;
  if (!isRecord(sandbox)) {
    issue(issues, "SANDBOX_INVALID", "$.trust.sandbox", "Sandbox metadata must be an object.");
    return;
  }
  if (!["none", "restricted", "external"].includes(sandbox.network)) {
    issue(issues, "SANDBOX_NETWORK_INVALID", "$.trust.sandbox.network", "Network access must be none, restricted, or external.");
  }
  if (!["none", "read", "write"].includes(sandbox.filesystem)) {
    issue(issues, "SANDBOX_FILESYSTEM_INVALID", "$.trust.sandbox.filesystem", "Filesystem access must be none, read, or write.");
  }
  if (!["none", "read"].includes(sandbox.secrets)) {
    issue(issues, "SANDBOX_SECRETS_INVALID", "$.trust.sandbox.secrets", "Secret access must be none or read.");
  }
  if (sandbox.egressDestinations !== undefined) {
    validateStringArray(sandbox.egressDestinations, "$.trust.sandbox.egressDestinations", issues, { nonEmpty: true });
  }
}

function validateAttestations(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (!Array.isArray(connector.trust.attestations)) {
    issue(issues, "ATTESTATIONS_INVALID", "$.trust.attestations", "Attestations must be an array.");
    return;
  }
  connector.trust.attestations.forEach((attestation, index) => {
    const path = `$.trust.attestations[${index}]`;
    if (!isRecord(attestation)) {
      issue(issues, "ATTESTATION_INVALID", path, "Attestation must be an object.");
      return;
    }
    requireId(attestation.id, `${path}.id`, issues);
    if (!["license", "security-review", "provenance", "sandbox", "data-processing", "custom"].includes(attestation.kind)) {
      issue(issues, "ATTESTATION_KIND_INVALID", `${path}.kind`, "Attestation kind is invalid.");
    }
    requireString(attestation.statement, `${path}.statement`, issues);
    optionalString(attestation.evidence, `${path}.evidence`, issues);
    optionalString(attestation.signedBy, `${path}.signedBy`, issues);
    optionalString(attestation.issuedAt, `${path}.issuedAt`, issues);
  });
}

function validatePolicyHints(connector: ConnectorManifest, issues: ValidationIssue[]): void {
  if (connector.policyHints === undefined) {
    return;
  }
  if (!isRecord(connector.policyHints)) {
    issue(issues, "POLICY_HINTS_INVALID", "$.policyHints", "Policy hints must be an object.");
    return;
  }
  if (connector.policyHints.defaultPurpose !== undefined) {
    optionalString(connector.policyHints.defaultPurpose, "$.policyHints.defaultPurpose", issues);
  }
  validateSelector(connector.policyHints.approvalRequiredFor, "$.policyHints.approvalRequiredFor", issues);
  validateSelector(connector.policyHints.deniedFor, "$.policyHints.deniedFor", issues);
}

function validateSelector(selector: unknown, path: string, issues: ValidationIssue[]): void {
  if (selector === undefined) {
    return;
  }
  if (!isRecord(selector)) {
    issue(issues, "POLICY_SELECTOR_INVALID", path, "Policy selector must be an object.");
    return;
  }
  const record = selector as {
    operations?: ConnectorOperation[];
    capabilities?: string[];
    dataClasses?: ConnectorDataClass[];
    destinations?: string[];
    risks?: ConnectorRisk[];
  };
  if (record.operations !== undefined) {
    validateEnumArray(record.operations, OPERATIONS, `${path}.operations`, issues);
  }
  if (record.capabilities !== undefined) {
    validateStringArray(record.capabilities, `${path}.capabilities`, issues, { nonEmpty: true });
  }
  if (record.dataClasses !== undefined) {
    validateEnumArray(record.dataClasses, DATA_CLASSES, `${path}.dataClasses`, issues);
  }
  if (record.destinations !== undefined) {
    validateStringArray(record.destinations, `${path}.destinations`, issues, { nonEmpty: true });
  }
  if (record.risks !== undefined) {
    validateEnumArray(record.risks, RISKS, `${path}.risks`, issues);
  }
}

function validateRisk(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!RISKS.includes(value as ConnectorRisk)) {
    issue(issues, "RISK_INVALID", path, `Risk must be one of ${RISKS.join(", ")}.`);
  }
}

function validateEnumArray<T extends string>(value: unknown, allowed: T[], path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issue(issues, "ARRAY_REQUIRED", path, "A non-empty array is required.");
    return;
  }
  value.forEach((item, index) => {
    if (!allowed.includes(item as T)) {
      issue(issues, "ARRAY_VALUE_INVALID", `${path}[${index}]`, `Value must be one of ${allowed.join(", ")}.`);
    }
  });
}

function validateStringArray(value: unknown, path: string, issues: ValidationIssue[], options: { nonEmpty: boolean }): void {
  if (!Array.isArray(value) || (options.nonEmpty && value.length === 0)) {
    issue(issues, "STRING_ARRAY_REQUIRED", path, "A non-empty string array is required.");
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      issue(issues, "STRING_ARRAY_VALUE_INVALID", `${path}[${index}]`, "Array values must be non-empty strings.");
    }
  });
}

function requireId(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    issue(issues, "ID_REQUIRED", path, "A non-empty id is required.");
    return;
  }
  if (!ID_PATTERN.test(value)) {
    issue(issues, "ID_INVALID", path, "Id must use lowercase letters, digits, dots, and hyphens.");
  }
}

function requireVersion(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    issue(issues, "VERSION_REQUIRED", path, "A semantic version is required.");
    return;
  }
  if (!VERSION_PATTERN.test(value)) {
    issue(issues, "VERSION_INVALID", path, "Version must be semantic, for example 1.0.0.");
  }
}

function requireString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    issue(issues, "STRING_REQUIRED", path, "A non-empty string is required.");
  }
}

function optionalString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value !== undefined && (typeof value !== "string" || value.trim() === "")) {
    issue(issues, "STRING_INVALID", path, "Value must be a non-empty string when present.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(issues: ValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}
