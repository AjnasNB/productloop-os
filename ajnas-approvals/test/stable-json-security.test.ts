import { describe, expect, test } from "vitest";
import { ApprovalQueue, computeApprovalSubjectDigest, type ApprovalSubject, type ApprovalWorkflow } from "../src/index.js";
import { normalizeJson, stableJson } from "../src/stable-json.js";

const workflow: ApprovalWorkflow = {
  schemaVersion: "ajnas.approval.workflow.v1",
  id: "security-review",
  version: "1.0.0",
  name: "Security review",
  owner: "security",
  stages: [{ id: "review", name: "Review", reviewers: [{ id: "owner", kind: "role" }], quorum: { strategy: "any" } }]
};

const subject: ApprovalSubject = {
  id: "release-example",
  kind: "package-release",
  title: "Release example",
  summary: "Review the exact artifact.",
  risk: "critical",
  requestedAction: "package.publish",
  metadata: { packageName: "example", version: "1.0.0" }
};

describe("strict canonical JSON", () => {
  test("sorts keys without locale-dependent comparison", () => {
    expect(stableJson({ z: 1, a: 2, A: 3 })).toBe('{"A":3,"a":2,"z":1}');
  });

  test.each([
    ["undefined", { value: undefined }],
    ["non-finite", { value: Number.NaN }],
    ["negative zero", { value: -0 }],
    ["Date", new Date("2026-01-01T00:00:00.000Z")],
    ["URL", new URL("https://example.com")],
    ["Map", new Map([["key", "value"]])]
  ])("rejects unsupported %s values instead of collapsing digests", (_name, value) => {
    expect(() => stableJson(value)).toThrow();
  });

  test("rejects cycles, repeated references, sparse arrays, symbols, and hidden properties", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const shared = { value: 1 };
    const sparse = new Array(2);
    sparse[1] = "value";
    const symbolValue = { value: 1, [Symbol("hidden")]: 2 };
    const hidden = { value: 1 };
    Object.defineProperty(hidden, "hidden", { value: 2 });

    expect(() => stableJson(cyclic)).toThrow(/cyclic or repeated/);
    expect(() => stableJson({ left: shared, right: shared })).toThrow(/cyclic or repeated/);
    expect(() => stableJson(sparse)).toThrow(/dense/);
    expect(() => stableJson(symbolValue)).toThrow(/symbol/);
    expect(() => stableJson(hidden)).toThrow(/enumerable data/);
  });

  test("rejects accessors without invoking them and enforces the depth budget", () => {
    let invoked = false;
    const accessor = {};
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get() {
        invoked = true;
        return "should-not-run";
      }
    });
    let deep: Record<string, unknown> = {};
    for (let index = 0; index < 66; index += 1) deep = { child: deep };

    expect(() => stableJson(accessor)).toThrow(/data properties/);
    expect(invoked).toBe(false);
    expect(() => stableJson(deep)).toThrow(/maximum depth/);
  });

  test("uses null-prototype output so __proto__ remains inert data", () => {
    const normalized = normalizeJson(JSON.parse('{"__proto__":{"polluted":true}}')) as Record<string, unknown>;
    expect(Object.getPrototypeOf(normalized)).toBeNull();
    expect((normalized.__proto__ as { polluted: boolean }).polluted).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe("approval immutability", () => {
  test("does not permit undefined-to-null approval substitution", () => {
    expect(computeApprovalSubjectDigest(subject)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(() => computeApprovalSubjectDigest({
      ...subject,
      metadata: { packageName: "example", version: undefined as never }
    })).toThrow(/undefined/);
  });

  test("clones request inputs and every value returned by the queue", () => {
    const queue = new ApprovalQueue({ clock: () => new Date("2026-07-15T10:00:00.000Z") });
    const mutableSubject = structuredClone(subject);
    const ticket = queue.request({ workflow, subject: mutableSubject, requestedBy: "bot", reason: "release" });

    mutableSubject.metadata!.version = "9.9.9";
    ticket.subject.metadata!.version = "8.8.8";
    const firstRead = queue.get(ticket.id)!;
    expect(firstRead.subject.metadata?.version).toBe("1.0.0");

    firstRead.subject.metadata!.version = "7.7.7";
    expect(queue.get(ticket.id)?.subject.metadata?.version).toBe("1.0.0");
  });
});
