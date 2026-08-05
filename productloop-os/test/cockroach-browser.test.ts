import { describe, expect, it } from "vitest";
import {
  COCKROACH_BROWSER_CONNECTION_SCHEMA,
  adapters,
  checkCockroachBrowserConnection,
  createCockroachBrowserResearchAdapter,
  createProductLoopOS,
  type CockroachBrowserSessionCreateInput
} from "../src/index.js";

class FakeBrowserClient {
  readonly created: CockroachBrowserSessionCreateInput[] = [];
  readonly closed: string[] = [];
  snapshotError: Error | undefined;

  async health(): Promise<Record<string, unknown>> {
    return {
      ok: true,
      name: "cockroach-browser",
      version: "0.2.1",
      sessions: 0,
      evidence: { valid: true }
    };
  }

  async capabilities(): Promise<Array<Record<string, unknown>>> {
    return [
      { id: "sessions.authorized", status: "available" },
      { id: "page.snapshot", status: "available" }
    ];
  }

  async createSession(input: CockroachBrowserSessionCreateInput): Promise<{ id: string }> {
    this.created.push(input);
    return { id: `session-${this.created.length}` };
  }

  async snapshot(sessionId: string): Promise<Record<string, unknown>> {
    if (this.snapshotError) throw this.snapshotError;
    return {
      sessionId,
      tabId: "tab-1",
      url: "https://example.com/research",
      title: "Research source",
      capturedAt: "2026-08-05T10:00:00.000Z",
      text: "First observed claim.\n\nSecond observed claim.",
      refs: [{ ref: "r1", role: "link", name: "Source" }],
      digest: "sha256:snapshot",
      truncated: false
    };
  }

  async closeSession(sessionId: string): Promise<void> {
    this.closed.push(sessionId);
  }
}

function adapterInput(action: "open" | "extract") {
  return {
    runId: "run-live-browser",
    plan: {
      schema: "ajnas.browser.research.plan.v1" as const,
      id: "plan-live-browser",
      objective: "Read a reviewed source",
      policy: {
        allowedOrigins: ["https://example.com"],
        allowedActions: [action]
      },
      steps: [
        {
          id: `step-${action}`,
          action,
          purpose: "Capture source text",
          url: "https://example.com/research"
        }
      ]
    },
    step: {
      id: `step-${action}`,
      action,
      purpose: "Capture source text",
      url: "https://example.com/research"
    },
    inputDigest: "sha256:input"
  };
}

describe("Cockroach Browser live ProductLoop adapter", () => {
  it("verifies the authenticated daemon and returns detached capabilities", async () => {
    const client = new FakeBrowserClient();
    const report = await checkCockroachBrowserConnection(client);

    expect(report).toMatchObject({
      schema: COCKROACH_BROWSER_CONNECTION_SCHEMA,
      ready: true,
      service: "cockroach-browser",
      transport: "authenticated-http-client",
      version: "0.2.1",
      sessions: 0,
      capabilityIds: ["sessions.authorized", "page.snapshot"]
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.capabilityIds)).toBe(true);
    expect(adapters.cockroachBrowserConnection).toBe(checkCockroachBrowserConnection);
  });

  it("opens a real read-only session, captures a semantic snapshot, and closes it", async () => {
    const client = new FakeBrowserClient();
    const adapter = createCockroachBrowserResearchAdapter({
      client,
      allowedOrigins: ["https://example.com"]
    });

    const output = await adapter.open!(adapterInput("open"));

    expect(output).toMatchObject({
      url: "https://example.com/research",
      finalUrl: "https://example.com/research",
      title: "Research source",
      text: "First observed claim.\n\nSecond observed claim.",
      metadata: {
        browser: "cockroach-browser",
        transport: "authenticated-http-client",
        sessionLifecycle: "short-lived",
        snapshotDigest: "sha256:snapshot",
        refs: 1,
        truncated: false
      }
    });
    expect(output.citations).toHaveLength(1);
    expect(client.closed).toEqual(["session-1"]);
    expect(client.created).toHaveLength(1);
    expect(client.created[0]).toMatchObject({
      mode: "headless",
      startUrl: "https://example.com/research",
      actor: "productloop-os",
      policy: {
        allowedOrigins: ["https://example.com"],
        allowedActions: ["snapshot"],
        allowedEffects: ["read"],
        allowPrivateNetwork: false,
        requireApprovalFor: [],
        budget: {
          maxActions: 4,
          maxTabs: 1,
          maxSnapshotChars: 50_000
        }
      }
    });
    expect(adapters.cockroachBrowserResearch).toBe(createCockroachBrowserResearchAdapter);
  });

  it("feeds live snapshot claims and citations through the ProductLoop harness", async () => {
    const client = new FakeBrowserClient();
    const adapter = createCockroachBrowserResearchAdapter({
      client,
      allowedOrigins: ["https://example.com"]
    });
    const os = createProductLoopOS();
    const harness = os.createBrowserHarness(adapter, {
      runId: "run-live-browser",
      now: () => "2026-08-05T10:00:00.000Z"
    });

    const report = await harness.run(adapterInput("extract").plan);

    expect(report.status).toBe("passed");
    expect(report.summary.citationsCaptured).toBe(3);
    expect(report.steps[0]?.outputSummary).toMatchObject({
      kind: "extract",
      claimCount: 2,
      claims: ["First observed claim.", "Second observed claim."]
    });
    expect(client.closed).toEqual(["session-1"]);
  });

  it("fails closed before creating a session for unlisted origins or selectors", async () => {
    const client = new FakeBrowserClient();
    const adapter = createCockroachBrowserResearchAdapter({
      client,
      allowedOrigins: ["https://example.com"]
    });
    const disallowed = adapterInput("open");
    disallowed.step.url = "https://attacker.example/research";
    await expect(adapter.open!(disallowed)).rejects.toThrow(
      "outside the ProductLoop browser allowlist"
    );

    const selected = adapterInput("extract");
    Object.assign(selected.step, { selector: "#secret" });
    await expect(adapter.extract!(selected)).rejects.toThrow(
      "do not support selector-scoped extraction"
    );
    expect(client.created).toHaveLength(0);
  });

  it("always closes the short-lived session when snapshot capture fails", async () => {
    const client = new FakeBrowserClient();
    client.snapshotError = new Error("snapshot failed");
    const adapter = createCockroachBrowserResearchAdapter({
      client,
      allowedOrigins: ["https://example.com"]
    });

    await expect(adapter.open!(adapterInput("open"))).rejects.toThrow("snapshot failed");
    expect(client.closed).toEqual(["session-1"]);
  });

  it("rejects option and client accessors without invoking them", () => {
    let invoked = false;
    const client = new FakeBrowserClient();
    const options: Record<string, unknown> = {
      client,
      allowedOrigins: ["https://example.com"]
    };
    Object.defineProperty(options, "mode", {
      enumerable: true,
      get() {
        invoked = true;
        return "headed";
      }
    });

    expect(() => createCockroachBrowserResearchAdapter(options as never)).toThrow(
      "options.mode must be an own data value"
    );
    expect(invoked).toBe(false);

    const hostile = Object.create(client) as FakeBrowserClient;
    Object.defineProperty(hostile, "snapshot", {
      enumerable: true,
      get() {
        invoked = true;
        return client.snapshot.bind(client);
      }
    });
    expect(() =>
      createCockroachBrowserResearchAdapter({
        client: hostile,
        allowedOrigins: ["https://example.com"]
      })
    ).toThrow("client.snapshot must be a data method");
    expect(invoked).toBe(false);
  });
});
