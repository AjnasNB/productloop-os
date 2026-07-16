import type { ValidationIssue } from "./types.js";

export class AjnasSkillsRegistryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ManifestValidationError extends AjnasSkillsRegistryError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("ERR_SKILL_MANIFEST_INVALID", "Skill manifest failed validation.");
    this.issues = issues;
  }
}

export class SignatureVerificationError extends AjnasSkillsRegistryError {
  constructor(keyId?: string) {
    const displayKeyId = typeof keyId === "string" && keyId.trim() ? keyId : "<unknown>";
    super("ERR_SKILL_SIGNATURE_INVALID", `Skill manifest signature could not be verified with key '${displayKeyId}'.`);
  }
}

export class DuplicateSkillError extends AjnasSkillsRegistryError {
  constructor(skillId: string, version: string) {
    super("ERR_SKILL_DUPLICATE_CONFLICT", `Skill '${skillId}@${version}' is already registered with different content.`);
  }
}

export class UnknownApprovalRequestError extends AjnasSkillsRegistryError {
  constructor(id: string) {
    super("ERR_SKILL_APPROVAL_UNKNOWN", `Approval request '${id}' does not exist.`);
  }
}
