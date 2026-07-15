import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  ApprovalRejectedError,
  InMemoryProvenanceSink,
  PolicyDeniedError,
  ToolRegistry
} from "../src/index.js";

const fixedClock = () => new Date("2026-07-05T01:45:00.000Z");

describe("AgentRuntime", () => {
  it("runs workflow steps through policy-gated tools and records chained provenance receipts", async () => {
    const tools = new ToolRegistry().register({
      name: "research.search",
      description: "Searches trusted public sources.",
      inputSchema: { type: "object", required: ["query"] },
      risk: "low",
      execute: async ({ input }) => ({ summary: `result for ${input.query}` })
    });
    const provenance = new InMemoryProvenanceSink({ clock: fixedClock });
    const runtime = new AgentRuntime({
      tools,
      provenance,
      runIdFactory: () => "run_receipts",
      clock: fixedClock,
      policy: {
        evaluate: async () => ({
          decision: "allow",
          reason: "low-risk research tool"
        })
      }
    });

    const result = await runtime.run({
      name: "research-workflow",
      input: { topic: "agent provenance" },
      steps: [
        {
          id: "search",
          run: async (context) =>
            context.callTool("research.search", { query: context.input.topic }, { purpose: "collect public sources" })
        }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.search).toEqual({ summary: "result for agent provenance" });
    expect(provenance.events.map((event) => event.type)).toEqual([
      "run.started",
      "step.started",
      "tool.requested",
      "policy.evaluated",
      "tool.completed",
      "step.completed",
      "run.completed"
    ]);
    expect(provenance.events[0]?.receipt.previousHash).toBeNull();
    for (const event of provenance.events) {
      expect(event.receipt.eventHash).toMatch(/^[a-f0-9]{64}$/);
      expect(event.runId).toBe("run_receipts");
    }
    for (let index = 1; index < provenance.events.length; index += 1) {
      expect(provenance.events[index]?.receipt.previousHash).toBe(provenance.events[index - 1]?.receipt.eventHash);
      expect(provenance.events[index]?.sequence).toBe(index + 1);
    }
  });

  it("blocks denied tool calls before execution and emits an auditable failure trail", async () => {
    let executed = false;
    const tools = new ToolRegistry().register({
      name: "external.publish",
      description: "Publishes a package externally.",
      risk: "critical",
      execute: async () => {
        executed = true;
        return { published: true };
      }
    });
    const provenance = new InMemoryProvenanceSink({ clock: fixedClock });
    const runtime = new AgentRuntime({
      tools,
      provenance,
      runIdFactory: () => "run_denied",
      clock: fixedClock,
      policy: {
        evaluate: async ({ tool }) => ({
          decision: "deny",
          reason: `${tool.name} requires release approval`
        })
      }
    });

    await expect(
      runtime.run({
        name: "publish-workflow",
        steps: [
          {
            id: "publish",
            run: async (context) => context.callTool("external.publish", { packageName: "ajnas-runtime" })
          }
        ]
      })
    ).rejects.toBeInstanceOf(PolicyDeniedError);

    expect(executed).toBe(false);
    expect(provenance.events.map((event) => event.type)).toEqual([
      "run.started",
      "step.started",
      "tool.requested",
      "policy.evaluated",
      "policy.denied",
      "step.failed",
      "run.failed"
    ]);
  });

  it("requires human approval for high-risk tools and records the approver decision", async () => {
    const tools = new ToolRegistry().register({
      name: "connector.github.write",
      description: "Writes to a GitHub repository.",
      risk: "high",
      execute: async ({ input, approval }) => ({
        action: "branch-created",
        branch: input.branch,
        approvedBy: approval?.approverId
      })
    });
    const provenance = new InMemoryProvenanceSink({ clock: fixedClock });
    const runtime = new AgentRuntime({
      tools,
      provenance,
      runIdFactory: () => "run_approved",
      clock: fixedClock,
      policy: {
        evaluate: async () => ({
          decision: "require_approval",
          reason: "repository write needs human approval",
          approvalPrompt: "Approve branch creation?"
        })
      },
      approver: {
        requestApproval: async (request) => ({
          approved: true,
          approverId: "user-123",
          comment: `approved ${request.toolName}`,
          bindingDigest: request.bindingDigest
        })
      }
    });

    const result = await runtime.run({
      name: "github-write",
      steps: [
        {
          id: "create-branch",
          run: async (context) =>
            context.callTool("connector.github.write", { branch: "release/ajnas-runtime-0.1.0" })
        }
      ]
    });

    expect(result.outputs["create-branch"]).toEqual({
      action: "branch-created",
      branch: "release/ajnas-runtime-0.1.0",
      approvedBy: "user-123"
    });
    expect(provenance.events.map((event) => event.type)).toContain("approval.requested");
    expect(provenance.events.map((event) => event.type)).toContain("approval.resolved");
    expect(provenance.events.find((event) => event.type === "approval.resolved")?.data).toMatchObject({
      approved: true,
      approverId: "user-123"
    });
  });

  it("stops execution when a required approval is rejected", async () => {
    const tools = new ToolRegistry().register({
      name: "npm.publish",
      description: "Publishes to npm.",
      risk: "critical",
      execute: async () => ({ published: true })
    });
    const runtime = new AgentRuntime({
      tools,
      runIdFactory: () => "run_rejected",
      clock: fixedClock,
      policy: {
        evaluate: async () => ({
          decision: "require_approval",
          reason: "external publish requires approval"
        })
      },
      approver: {
        requestApproval: async (request) => ({
          approved: false,
          approverId: "owner",
          comment: "wait for release review",
          bindingDigest: request.bindingDigest
        })
      }
    });

    await expect(
      runtime.run({
        name: "release",
        steps: [
          {
            id: "publish",
            run: async (context) => context.callTool("npm.publish", { packageName: "ajnas-runtime" })
          }
        ]
      })
    ).rejects.toBeInstanceOf(ApprovalRejectedError);
  });
});
