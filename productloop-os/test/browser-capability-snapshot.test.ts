import { describe, expect, it } from "vitest";
import {
  COCKROACH_BROWSER_CAPABILITY_SNAPSHOT_SCHEMA,
  adaptCockroachBrowserCapabilitySnapshot,
  adapters
} from "../src/index.js";

function publishedSnapshot(): Record<string, unknown> {
  return {
    schemaVersion: "cockroach.productloop-capability-snapshot.v1",
    id: "cockroach-browser",
    displayName: "Cockroach Browser",
    description:
      "Authorized browser sessions, structural observations, evidence, and optional Maqam-governed actions.",
    kind: "browser-capability-snapshot",
    scope: "structural-only",
    transports: ["sdk", "http", "mcp"],
    authority: {
      lifecycle: "host",
      governance: "maqam-when-routed",
      rawRuntime: "host-policy"
    },
    capabilities: [
      "sessions.authorized",
      "page.snapshot",
      "security.approvals",
      "integration.productloop"
    ]
  };
}

describe("Cockroach Browser ProductLoop capability snapshot", () => {
  it("accepts the exact published structural contract and returns a detached frozen view", () => {
    const source = publishedSnapshot();
    const snapshot = adaptCockroachBrowserCapabilitySnapshot(source);

    expect(snapshot).toEqual(source);
    expect(snapshot).not.toBe(source);
    expect(snapshot.schemaVersion).toBe(
      COCKROACH_BROWSER_CAPABILITY_SNAPSHOT_SCHEMA
    );
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.authority)).toBe(true);
    expect(Object.isFrozen(snapshot.transports)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);

    (source.capabilities as string[]).push("page.javascript");
    (source.authority as Record<string, string>).lifecycle = "changed";
    expect(snapshot.capabilities).not.toContain("page.javascript");
    expect(snapshot.authority.lifecycle).toBe("host");
  });

  it("rejects version drift until ProductLoop reviews a new contract", () => {
    const source = publishedSnapshot();
    source.schemaVersion = "cockroach.productloop-capability-snapshot.v2";

    expect(() => adaptCockroachBrowserCapabilitySnapshot(source)).toThrow(
      'snapshot.schemaVersion must equal "cockroach.productloop-capability-snapshot.v1"'
    );
  });

  it("rejects unknown top-level and authority fields instead of treating them as grants", () => {
    const topLevel = publishedSnapshot();
    topLevel.registerTools = true;
    expect(() => adaptCockroachBrowserCapabilitySnapshot(topLevel)).toThrow(
      'snapshot contains unknown field "registerTools"'
    );

    const nested = publishedSnapshot();
    (nested.authority as Record<string, unknown>).execute = true;
    expect(() => adaptCockroachBrowserCapabilitySnapshot(nested)).toThrow(
      'snapshot.authority contains unknown field "execute"'
    );

    const hidden = publishedSnapshot();
    Object.defineProperty(hidden, "execute", {
      value: true,
      enumerable: false
    });
    expect(() => adaptCockroachBrowserCapabilitySnapshot(hidden)).toThrow(
      'snapshot contains unknown field "execute"'
    );
  });

  it("rejects authority changes, transport changes, and duplicate capability identifiers", () => {
    const authority = publishedSnapshot();
    (authority.authority as Record<string, unknown>).rawRuntime = "productloop";
    expect(() => adaptCockroachBrowserCapabilitySnapshot(authority)).toThrow(
      'snapshot.authority.rawRuntime must equal "host-policy"'
    );

    const transports = publishedSnapshot();
    transports.transports = ["sdk", "mcp", "http"];
    expect(() => adaptCockroachBrowserCapabilitySnapshot(transports)).toThrow(
      "snapshot.transports must be the exact tuple"
    );

    const capabilities = publishedSnapshot();
    capabilities.capabilities = ["page.snapshot", "page.snapshot"];
    expect(() => adaptCockroachBrowserCapabilitySnapshot(capabilities)).toThrow(
      'snapshot.capabilities contains duplicate "page.snapshot"'
    );
  });

  it("rejects accessors without invoking them", () => {
    let invoked = false;
    const topLevel = publishedSnapshot();
    Object.defineProperty(topLevel, "description", {
      enumerable: true,
      get() {
        invoked = true;
        return "forged";
      }
    });
    expect(() => adaptCockroachBrowserCapabilitySnapshot(topLevel)).toThrow(
      "snapshot.description must be an own data value"
    );
    expect(invoked).toBe(false);

    const nested = publishedSnapshot();
    Object.defineProperty(nested.authority, "governance", {
      enumerable: true,
      get() {
        invoked = true;
        return "maqam-when-routed";
      }
    });
    expect(() => adaptCockroachBrowserCapabilitySnapshot(nested)).toThrow(
      "snapshot.authority.governance must be an own data value"
    );
    expect(invoked).toBe(false);

    const arrayValue = publishedSnapshot();
    Object.defineProperty(arrayValue.capabilities, "0", {
      enumerable: true,
      get() {
        invoked = true;
        return "page.snapshot";
      }
    });
    expect(() => adaptCockroachBrowserCapabilitySnapshot(arrayValue)).toThrow(
      "snapshot.capabilities[0] must be an own data value"
    );
    expect(invoked).toBe(false);
  });

  it("does not expose a registration or execution surface", () => {
    const snapshot = adaptCockroachBrowserCapabilitySnapshot(publishedSnapshot());

    expect(Object.keys(snapshot).sort()).toEqual([
      "authority",
      "capabilities",
      "description",
      "displayName",
      "id",
      "kind",
      "schemaVersion",
      "scope",
      "transports"
    ]);
    expect("register" in snapshot).toBe(false);
    expect("execute" in snapshot).toBe(false);
    expect("runtime" in snapshot).toBe(false);
    expect(adapters.cockroachBrowserCapabilitySnapshot).toBe(
      adaptCockroachBrowserCapabilitySnapshot
    );
  });
});
