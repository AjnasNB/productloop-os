import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { AgentRuntime, FileRunStore, InMemoryProvenanceSink, ToolRegistry } from "../src/index.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("FileRunStore", () => {
  it("rejects run IDs that could alias or escape the storage path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ajnas-runtime-"));
    createdDirs.push(dir);
    const store = new FileRunStore({ directory: dir });

    await expect(store.load("../escape")).rejects.toThrow(/Run ID must/);
    await expect(store.load("a/b")).rejects.toThrow(/Run ID must/);
    await expect(store.load("CON")).rejects.toThrow(/Run ID must/);
  });

  it("persists final run snapshots with outputs, status, and provenance events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ajnas-runtime-"));
    createdDirs.push(dir);
    const store = new FileRunStore({ directory: dir });
    const provenance = new InMemoryProvenanceSink();
    const tools = new ToolRegistry().register({
      name: "math.double",
      description: "Doubles a number.",
      risk: "low",
      execute: async ({ input }) => ({ value: input.value * 2 })
    });
    const runtime = new AgentRuntime({
      tools,
      store,
      provenance,
      runIdFactory: () => "run_store",
      policy: {
        evaluate: async () => ({ decision: "allow", reason: "deterministic local tool" })
      }
    });

    const result = await runtime.run({
      name: "persisted-workflow",
      input: { value: 21 },
      steps: [
        {
          id: "double",
          run: async (context) => context.callTool("math.double", { value: context.input.value })
        }
      ]
    });
    const loaded = await store.load("run_store");
    const raw = JSON.parse(await readFile(join(dir, "run_store.json"), "utf8"));

    expect(result.status).toBe("completed");
    expect(loaded?.status).toBe("completed");
    expect(loaded?.outputs.double).toEqual({ value: 42 });
    expect(loaded?.events.length).toBe(provenance.events.length);
    expect(raw.runId).toBe("run_store");
  });
});
