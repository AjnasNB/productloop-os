import { describe, expect, test } from "vitest";
import {
  AgentRuntime,
  ApprovalBindingError,
  InvalidRunIdError,
  InvalidPolicyDecisionError,
  InMemoryProvenanceSink,
  PolicyDeniedError,
  RunIdCollisionError,
  ToolRegistry
} from "../src/index.js";

describe("runtime security defaults", () => {
  test("denies tool execution when no policy engine is configured", async () => {
    let executed = false;
    const runtime = new AgentRuntime({
      tools: [{ name: "external.write", description: "Write externally", risk: "high", execute: () => { executed = true; return { ok: true }; } }],
      runIdFactory: () => "run-default-deny"
    });

    await expect(runtime.run({ name: "deny", steps: [{ id: "write", run: (context) => context.callTool("external.write", {}) }] }))
      .rejects.toBeInstanceOf(PolicyDeniedError);
    expect(executed).toBe(false);
  });

  test("rejects an approval response that is not bound to the exact request", async () => {
    let executed = false;
    const runtime = new AgentRuntime({
      tools: [{ name: "npm.publish", description: "Publish", risk: "critical", execute: () => { executed = true; return { ok: true }; } }],
      policy: { evaluate: () => ({ decision: "require_approval", reason: "publish requires review" }) },
      approver: { requestApproval: () => ({ approved: true, approverId: "owner", bindingDigest: "sha256:unrelated" }) },
      runIdFactory: () => "run-binding"
    });

    await expect(runtime.run({ name: "publish", steps: [{ id: "publish", run: (context) => context.callTool("npm.publish", { version: "1.0.0" }) }] }))
      .rejects.toBeInstanceOf(ApprovalBindingError);
    expect(executed).toBe(false);
  });

  test("never exposes tool execution to policy code and rejects malformed policy decisions", async () => {
    let executed = false;
    let exposedExecute: unknown;
    const runtime = new AgentRuntime({
      tools: [{ name: "external.write", description: "Write", risk: "high", execute: () => { executed = true; return { ok: true }; } }],
      policy: {
        evaluate: (request) => {
          exposedExecute = (request.tool as unknown as { execute?: unknown }).execute;
          return { decision: "maybe", reason: "not a real decision" } as never;
        }
      },
      runIdFactory: () => "run-invalid-policy"
    });

    await expect(runtime.run({ name: "invalid-policy", steps: [{ id: "write", run: (context) => context.callTool("external.write", {}) }] }))
      .rejects.toBeInstanceOf(InvalidPolicyDecisionError);
    expect(exposedExecute).toBeUndefined();
    expect(executed).toBe(false);
  });

  test("rejects null policy decisions and malformed approval responses", async () => {
    let executed = false;
    const tool = { name: "external.write", description: "Write", risk: "low" as const, execute: () => { executed = true; return { ok: true }; } };
    const nullPolicy = new AgentRuntime({ tools: [tool], policy: { evaluate: () => null as never }, runIdFactory: () => "run-null-policy" });
    await expect(nullPolicy.run({ name: "null-policy", steps: [{ id: "write", run: (context) => context.callTool("external.write", {}) }] }))
      .rejects.toBeInstanceOf(InvalidPolicyDecisionError);

    const malformedApproval = new AgentRuntime({
      tools: [tool],
      policy: { evaluate: () => ({ decision: "require_approval", reason: "review" }) },
      approver: { requestApproval: (request) => ({ approved: "yes", approverId: "owner", bindingDigest: request.bindingDigest }) as never },
      runIdFactory: () => "run-malformed-approval"
    });
    await expect(malformedApproval.run({ name: "malformed-approval", steps: [{ id: "write", run: (context) => context.callTool("external.write", {}) }] }))
      .rejects.toBeInstanceOf(ApprovalBindingError);
    expect(executed).toBe(false);
  });

  test("sends the effective raised risk to the approver", async () => {
    let approvalRisk: unknown;
    const runtime = new AgentRuntime({
      tools: [{ name: "external.write", description: "Write", risk: "low", execute: () => ({ ok: true }) }],
      policy: { evaluate: () => ({ decision: "require_approval", reason: "review" }) },
      approver: {
        requestApproval: (request) => {
          approvalRisk = request.risk;
          return { approved: true, approverId: "owner", bindingDigest: request.bindingDigest };
        }
      },
      runIdFactory: () => "run-raised-risk"
    });
    await runtime.run({ name: "raised-risk", steps: [{ id: "write", run: (context) => context.callTool("external.write", {}, { risk: "critical" }) }] });
    expect(approvalRisk).toBe("critical");
  });

  test("rejects concurrent reuse of an active run ID", async () => {
    let release!: (value: { ok: true }) => void;
    const gate = new Promise<{ ok: true }>((resolve) => { release = resolve; });
    const runtime = new AgentRuntime({ runIdFactory: () => "run-collision" });
    const workflow = { name: "held", steps: [{ id: "hold", run: () => gate }] };

    const first = runtime.run(workflow);
    await expect(runtime.run(workflow)).rejects.toBeInstanceOf(RunIdCollisionError);
    release({ ok: true });
    await expect(first).resolves.toMatchObject({ status: "completed" });
    await expect(runtime.run(workflow)).rejects.toBeInstanceOf(RunIdCollisionError);
  });

  test("rejects invalid run IDs and never lets metadata lower declared tool risk", async () => {
    const invalid = new AgentRuntime({ runIdFactory: () => "../escape" });
    await expect(invalid.run({ name: "invalid", steps: [] })).rejects.toBeInstanceOf(InvalidRunIdError);

    let policyRisk: unknown;
    const runtime = new AgentRuntime({
      tools: [{
        name: "critical.action",
        description: "Critical action",
        risk: "critical",
        execute: ({ metadata }) => ({ risk: metadata.risk })
      }],
      policy: {
        evaluate: (request) => {
          policyRisk = request.metadata.risk;
          return { decision: "allow", reason: "observe effective risk" };
        }
      },
      runIdFactory: () => "run-risk-floor"
    });
    const result = await runtime.run({
      name: "risk-floor",
      steps: [{ id: "critical", run: (context) => context.callTool("critical.action", {}, { risk: "low" }) }]
    });

    expect(policyRisk).toBe("critical");
    expect(result.outputs.critical).toEqual({ risk: "critical" });
  });

  test("isolates policy, tool, registry, and provenance objects from caller mutation", async () => {
    const definition = {
      name: "math.read",
      description: "Read an amount",
      risk: "low" as const,
      inputSchema: { type: "object" },
      execute: ({ input }: { input: { amount: number } }) => {
        input.amount = 500;
        return { observed: input.amount };
      }
    };
    const tools = new ToolRegistry().register(definition);
    definition.name = "mutated.after.registration";
    definition.inputSchema.type = "string";
    const provenance = new InMemoryProvenanceSink();
    const originalInput = { amount: 1 };
    const runtime = new AgentRuntime({
      tools,
      provenance,
      policy: {
        evaluate: (request) => {
          (request.input as { amount: number }).amount = 999;
          return { decision: "allow", reason: "test" };
        }
      },
      runIdFactory: () => "run-isolation"
    });

    const result = await runtime.run({ name: "isolation", steps: [{ id: "read", run: (context) => context.callTool("math.read", originalInput) }] });
    expect(result.outputs.read).toEqual({ observed: 500 });
    expect(originalInput).toEqual({ amount: 1 });
    expect(tools.get("math.read").inputSchema).toEqual({ type: "object" });

    const exposed = provenance.events;
    exposed[0]!.data.name = "tampered";
    expect(provenance.events[0]?.data.name).toBe("isolation");
  });
});
