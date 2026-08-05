import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedWorkbenchDemo } from "../src/demo.js";
import { WorkbenchStore } from "../src/store.js";

describe("Workbench no-key demo", () => {
  it("connects the deterministic public stack to durable operator records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "productloop-workbench-demo-"));
    try {
      const store = new WorkbenchStore(join(directory, "workbench.sqlite"));
      const result = await seedWorkbenchDemo(store);
      expect(result.coreProof).toMatchObject({
        runtimeStatus: "completed",
        traceValid: true,
        browserStatus: "passed",
        evalStatus: "passed",
        maqamStatus: "completed"
      });
      expect(store.requireRun(result.completedRunId).status).toBe("completed");
      expect(store.requireRun(result.pendingRunId).status).toBe("awaiting_approval");
      expect(store.requireApproval(result.pendingApprovalId).status).toBe("pending");
      expect(store.listEvidence(result.completedRunId)).toHaveLength(3);
      expect(store.listMemory(result.completedRunId)).toHaveLength(1);
      expect(store.verify().valid).toBe(true);
      const bundle = store.exportRun(result.completedRunId);
      expect(bundle.integrity.eventCount).toBe(bundle.events.length);
      expect(bundle.events[0]?.previousHash).toBeNull();
      const rerun = await seedWorkbenchDemo(store);
      expect(rerun.reused).toBe(true);
      store.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
