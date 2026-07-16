export class AjnasRuntimeError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class UnknownToolError extends AjnasRuntimeError {
  constructor(toolName: string) {
    super("AJNAS_UNKNOWN_TOOL", `Tool is not registered: ${toolName}`, { toolName });
  }
}

export class DuplicateToolError extends AjnasRuntimeError {
  constructor(toolName: string) {
    super("AJNAS_DUPLICATE_TOOL", `Tool is already registered: ${toolName}`, { toolName });
  }
}

export class PolicyDeniedError extends AjnasRuntimeError {
  constructor(toolName: string, reason: string) {
    super("AJNAS_POLICY_DENIED", `Policy denied tool call ${toolName}: ${reason}`, { toolName, reason });
  }
}

export class InvalidPolicyDecisionError extends AjnasRuntimeError {
  constructor(toolName: string, reason: string) {
    super(
      "AJNAS_POLICY_DECISION_INVALID",
      `Policy returned an invalid decision for tool call ${toolName}: ${reason}`,
      { toolName, reason }
    );
  }
}

export class ApprovalRequiredError extends AjnasRuntimeError {
  constructor(toolName: string, reason: string) {
    super("AJNAS_APPROVAL_REQUIRED", `Tool call ${toolName} requires approval: ${reason}`, { toolName, reason });
  }
}

export class ApprovalRejectedError extends AjnasRuntimeError {
  constructor(toolName: string, approverId: string, comment?: string) {
    super("AJNAS_APPROVAL_REJECTED", `Approval rejected for tool call ${toolName}`, {
      toolName,
      approverId,
      comment
    });
  }
}

export class ApprovalBindingError extends AjnasRuntimeError {
  constructor(toolName: string) {
    super(
      "AJNAS_APPROVAL_BINDING_INVALID",
      `Approval response is not bound to the current tool call: ${toolName}`,
      { toolName }
    );
  }
}

export class RunIdCollisionError extends AjnasRuntimeError {
  constructor(runId: string) {
    super("AJNAS_RUN_ID_COLLISION", `Run ID is already active: ${runId}`, { runId });
  }
}

export class InvalidRunIdError extends AjnasRuntimeError {
  constructor() {
    super(
      "AJNAS_RUN_ID_INVALID",
      "Run ID must start with a letter or number, use at most 128 path-safe characters, and not be a reserved device name"
    );
  }
}
