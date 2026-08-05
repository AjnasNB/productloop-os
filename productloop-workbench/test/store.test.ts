import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { digestJson } from "../src/stable-json.js";
import { WorkbenchStore } from "../src/store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("WorkbenchStore", () => {
  it("persists a run and consumes an exact approval once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "productloop-workbench-store-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "workbench.sqlite");
    const store = new WorkbenchStore(path);
    const run = store.createRun({
      id: "run_test",
      title: "Review write",
      purpose: "Verify one-use approval semantics",
      risk: "high"
    });
    const approval = store.requestApproval({
      id: "apr_test",
      runId: run.id,
      toolName: " fixture.write ",
      effect: " write ",
      risk: "high",
      reason: "Writes require exact review.",
      requestedBy: "requester",
      input: { path: "fixture.txt", contentDigest: digestJson("fixture") }
    });
    expect(approval.status).toBe("pending");
    expect(approval.toolName).toBe("fixture.write");
    expect(approval.effect).toBe("write");
    expect(approval.inputDigest).toBe(digestJson({
      runId: run.id,
      toolName: "fixture.write",
      effect: "write",
      risk: "high",
      input: { path: "fixture.txt", contentDigest: digestJson("fixture") }
    }));
    expect(store.requireRun(run.id).status).toBe("awaiting_approval");

    expect(store.reviewApproval(approval.id, {
      reviewerId: "reviewer",
      decision: "approve",
      comment: "Exact input reviewed."
    }).status).toBe("approved");
    expect(store.resumeRun(run.id).status).toBe("running");
    expect(store.requireApproval(approval.id).status).toBe("consumed");
    expect(() => store.resumeRun(run.id)).toThrow(/not waiting for approval/u);
    expect(store.verify()).toMatchObject({ valid: true, eventCount: 4 });
    store.close();

    const reopened = new WorkbenchStore(path);
    expect(reopened.requireRun(run.id).status).toBe("running");
    expect(reopened.requireApproval(approval.id).status).toBe("consumed");
    expect(reopened.verify().valid).toBe(true);
    reopened.close();
  });

  it("exports linked evidence and memory in a digest-bound proof bundle", async () => {
    const directory = await mkdtemp(join(tmpdir(), "productloop-workbench-proof-"));
    temporaryDirectories.push(directory);
    const store = new WorkbenchStore(join(directory, "workbench.sqlite"));
    const run = store.createRun({ title: "Proof", purpose: "Export evidence", risk: "low" });
    store.addEvidence({
      runId: run.id,
      sourceType: "local",
      source: "fixture",
      title: "Fixture evidence",
      excerpt: "Bounded evidence"
    });
    store.addMemoryLink({
      runId: run.id,
      provider: "qarinah",
      eventId: "evt_fixture",
      eventHash: digestJson({ fixture: true }),
      relationship: "context",
      summary: "Cited context"
    });
    const bundle = store.exportRun(run.id);
    expect(bundle.evidence).toHaveLength(1);
    expect(bundle.memory).toHaveLength(1);
    expect(bundle.bundleDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(bundle.integrity.valid).toBe(true);
    store.close();
  });

  it("rejects malformed enum values and accessor-backed JSON without invoking getters", async () => {
    const directory = await mkdtemp(join(tmpdir(), "productloop-workbench-hostile-"));
    temporaryDirectories.push(directory);
    const store = new WorkbenchStore(join(directory, "workbench.sqlite"));
    expect(() => store.createRun({
      title: "Invalid risk",
      purpose: "Fail closed",
      risk: "urgent" as never
    })).toThrow(/risk must be one of/u);

    let invoked = false;
    const context = {};
    Object.defineProperty(context, "secret", {
      enumerable: true,
      get() {
        invoked = true;
        return "must-not-run";
      }
    });
    expect(() => store.createRun({
      title: "Accessor context",
      purpose: "Fail closed",
      context: context as never
    })).toThrow(/data property/u);
    expect(invoked).toBe(false);
    expect(store.listRuns()).toHaveLength(0);
    store.close();
  });
});
