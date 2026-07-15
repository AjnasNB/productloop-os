import { stableJson, toJsonObject, toJsonValue } from "./stable-json.js";
import type { AgentRunArtifact, EvalAssertion, EvalAssertionResult, JsonObject, JsonValue } from "./types.js";

export function evaluateAssertion(assertion: EvalAssertion, artifact: AgentRunArtifact): EvalAssertionResult {
  if (assertion.kind === "run.status") {
    return buildResult(
      assertion,
      artifact.status === assertion.status,
      `run status is ${artifact.status}`,
      assertion.status ?? null,
      artifact.status
    );
  }

  if (assertion.kind === "json.path") {
    const actual = readPath(artifact, assertion.path ?? "");
    const expected = hasOwn(assertion, "equals") ? assertion.equals : assertion.includes;
    const passed = hasOwn(assertion, "equals")
      ? actual.found && sameJson(actual.value, assertion.equals)
      : actual.found && includesJson(actual.value, assertion.includes);
    return buildResult(
      assertion,
      passed,
      actual.found ? `path ${assertion.path} resolved` : `path ${assertion.path} was not found`,
      expected ?? null,
      actual.found ? actual.value : null
    );
  }

  if (assertion.kind === "event.type.count") {
    const count = (artifact.events ?? []).filter((event) => event.type === assertion.eventType).length;
    const passed = numberExpectationPasses(count, assertion);
    return buildResult(assertion, passed, `${count} event(s) matched ${assertion.eventType}`, countExpectation(assertion), count);
  }

  if (assertion.kind === "policy.decision") {
    const match = (artifact.policyDecisions ?? []).find(
      (decision) =>
        decision.decision === assertion.decision &&
        (assertion.toolName === undefined || decision.toolName === assertion.toolName)
    );
    return buildResult(
      assertion,
      Boolean(match),
      match ? `policy decision ${match.decision} matched` : "no matching policy decision found",
      toJsonObject({ toolName: assertion.toolName ?? null, decision: assertion.decision ?? null }),
      match ?? null
    );
  }

  if (assertion.kind === "approval.status") {
    const match = (artifact.approvals ?? []).find(
      (approval) =>
        approval.status === assertion.status && (assertion.toolName === undefined || approval.toolName === assertion.toolName)
    );
    return buildResult(
      assertion,
      Boolean(match),
      match ? `approval status ${match.status} matched` : "no matching approval record found",
      toJsonObject({ toolName: assertion.toolName ?? null, status: assertion.status ?? null }),
      match ?? null
    );
  }

  if (assertion.kind === "provenance.valid") {
    const actual = artifact.provenance?.valid ?? false;
    return buildResult(assertion, actual === assertion.valid, `provenance valid is ${String(actual)}`, assertion.valid ?? null, actual);
  }

  if (assertion.kind === "connector.trust") {
    const match = (artifact.connectorCalls ?? []).find(
      (call) => call.connectorId === assertion.connectorId && call.trustTier === assertion.trustTier
    );
    return buildResult(
      assertion,
      Boolean(match),
      match ? `connector ${match.connectorId} trust tier matched` : "no matching connector trust evidence found",
      toJsonObject({ connectorId: assertion.connectorId ?? null, trustTier: assertion.trustTier ?? null }),
      match ?? null
    );
  }

  const match = (artifact.browserSteps ?? []).find((step) => {
    const hostMatches = assertion.urlHost === undefined || hostMatchesExpected(step.url, assertion.urlHost);
    const statusMatches = assertion.status === undefined || step.status === assertion.status;
    return step.type === assertion.stepType && statusMatches && hostMatches;
  });
  return buildResult(
    assertion,
    Boolean(match),
    match ? `browser step ${match.stepId} matched` : "no matching browser step found",
    toJsonObject({
      stepType: assertion.stepType ?? null,
      status: assertion.status ?? null,
      urlHost: assertion.urlHost ?? null
    }),
    match ?? null
  );
}

export function evaluateAssertions(assertions: EvalAssertion[], artifact: AgentRunArtifact): EvalAssertionResult[] {
  return assertions.map((assertion) => evaluateAssertion(assertion, artifact));
}

function buildResult(
  assertion: EvalAssertion,
  passed: boolean,
  message: string,
  expected: unknown,
  actual: unknown
): EvalAssertionResult {
  return {
    assertionId: assertion.id,
    kind: assertion.kind,
    status: passed ? "passed" : "failed",
    message,
    expected: toJsonValue(expected),
    actual: toJsonValue(actual)
  };
}

function readPath(root: unknown, path: string): { found: boolean; value: unknown } {
  if (!path) {
    return { found: true, value: root };
  }

  let current = root;
  for (const segment of path.split(".")) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      const index = Number(segment);
      if (index >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object" || !hasOwn(current, segment)) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return { found: true, value: current };
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function includesJson(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.includes(expected);
  }

  if (Array.isArray(actual)) {
    const expectedJson = stableJson(expected);
    return actual.some((item) => stableJson(item) === expectedJson);
  }

  if (actual !== null && typeof actual === "object" && expected !== null && typeof expected === "object") {
    const actualObject = actual as JsonObject;
    return Object.entries(expected as JsonObject).every(([key, value]) => hasOwn(actualObject, key) && sameJson(actualObject[key], value));
  }

  return sameJson(actual, expected);
}

function numberExpectationPasses(actual: number, assertion: EvalAssertion): boolean {
  if (typeof assertion.equals === "number" && actual !== assertion.equals) {
    return false;
  }
  if (typeof assertion.min === "number" && actual < assertion.min) {
    return false;
  }
  if (typeof assertion.max === "number" && actual > assertion.max) {
    return false;
  }
  return true;
}

function countExpectation(assertion: EvalAssertion): JsonValue {
  const output: JsonObject = {};
  if (typeof assertion.equals === "number") {
    output.equals = assertion.equals;
  }
  if (typeof assertion.min === "number") {
    output.min = assertion.min;
  }
  if (typeof assertion.max === "number") {
    output.max = assertion.max;
  }
  return output;
}

function hostMatchesExpected(url: string | undefined, expectedHost: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const host = new URL(url).hostname;
    return host === expectedHost || host.endsWith(`.${expectedHost}`);
  } catch {
    return false;
  }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
