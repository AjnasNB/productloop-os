import {
  AgentRuntime,
  FileRunStore,
  InMemoryProvenanceSink,
  ToolRegistry
} from "../dist/index.js";

const tools = new ToolRegistry().register({
  name: "local.summarize",
  description: "Creates a deterministic local summary.",
  risk: "low",
  execute: async ({ input }) => ({
    summary: `Ajnas runtime package: ${input.topic}`
  })
});

const provenance = new InMemoryProvenanceSink();
const runtime = new AgentRuntime({
  tools,
  provenance,
  store: new FileRunStore({ directory: ".ajnas-runs" }),
  policy: {
    evaluate: async ({ tool }) => ({
      decision: tool.risk === "critical" ? "deny" : "allow",
      reason: "example policy allows non-critical local tools"
    })
  }
});

const result = await runtime.run({
  name: "basic-example",
  input: { topic: "policy, approvals, and provenance" },
  steps: [
    {
      id: "summarize",
      run: async (context) =>
        context.callTool("local.summarize", { topic: context.input.topic }, { purpose: "demo" })
    }
  ]
});

console.log(JSON.stringify({
  status: result.status,
  output: result.outputs.summarize,
  eventCount: provenance.events.length,
  finalReceipt: provenance.events.at(-1)?.receipt.eventHash
}, null, 2));
