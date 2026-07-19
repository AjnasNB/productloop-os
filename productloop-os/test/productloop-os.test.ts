import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defineToolAdapter,
  registerToolAdapter,
  runToolAdapterConformance
} from "maqam";
import {
  PRODUCTLOOP_OS_VERSION,
  createMaqamCrawlerTool,
  createProductLoopOS,
  inspectModules,
  runDeterministicDemo
} from "../src/index.js";

const require = createRequire(import.meta.url);
const maqamEntry = require.resolve("maqam");
const maqamPackage = JSON.parse(
  readFileSync(join(dirname(maqamEntry), "..", "package.json"), "utf8")
) as { version: string };

describe("productloop-os", () => {
  it("exports the published package version", () => {
    expect(PRODUCTLOOP_OS_VERSION).toBe("0.2.3");
  });

  it("loads Maqam and every Ajnas package namespace", () => {
    const modules = inspectModules();
    expect(modules).toHaveLength(9);
    expect(modules.every((module) => module.loaded)).toBe(true);
  });

  it("uses the public Maqam 0.3.1 release baseline", () => {
    expect(maqamPackage.version).toBe("0.3.1");
  });

  it("routes a Maqam 0.3.1 adapter through the ProductLoop gateway", async () => {
    const invocations: string[] = [];
    const adapter = defineToolAdapter<{ value: string }, { slug: string }>({
      name: "function.productloop.slug",
      transport: "function",
      description: "Create a deterministic slug in an offline fixture.",
      effects: [],
      risk: "low",
      async invoke(input) {
        invocations.push(input.value);
        return { slug: input.value.toLowerCase().replaceAll(" ", "-") };
      }
    });
    const os = createProductLoopOS({
      maqamPolicy: { allowedTools: [adapter.name] }
    });

    registerToolAdapter(os.maqamGateway, adapter);
    await expect(os.maqamGateway.call(
      adapter.name,
      { value: "ProductLoop Maqam" },
      { runId: "run_maqam_0_3_1_adapter" }
    )).resolves.toEqual({ slug: "productloop-maqam" });
    expect(invocations).toEqual(["ProductLoop Maqam"]);

    const conformance = await runToolAdapterConformance(adapter, {
      input: { value: "Offline Contract" },
      verifyOutput: (output) => output.slug === "offline-contract"
    });
    expect(conformance.passed).toBe(true);
  });

  it("uses a deny-by-default runtime composition", async () => {
    const os = createProductLoopOS({
      clock: () => new Date("2026-07-15T12:00:00.000Z"),
      runIdFactory: () => "run_default_deny"
    });
    os.tools.register({
      name: "local.unapproved",
      description: "A tool with no explicit allow rule.",
      risk: "low",
      execute: () => "should not run"
    });

    await expect(os.runtime.run({
      name: "default-deny",
      steps: [
        {
          id: "blocked",
          run: (context) => context.callTool("local.unapproved", {})
        }
      ]
    })).rejects.toThrow("Policy denied tool call local.unapproved");

    expect(os.policyAudit.events.at(-1)?.decision).toBe("deny");
  });

  it("marks the Maqam live crawler bridge high risk without executing it", () => {
    const defaults = { obeyRobots: true, maxPages: 2 };
    const crawler = createMaqamCrawlerTool({ defaults });
    defaults.maxPages = 999;
    expect(crawler.name).toBe("maqam.crawl");
    expect(crawler.risk).toBe("high");
  });

  it("executes the Maqam crawler bridge against an explicitly trusted local fixture", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/robots.txt") {
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end("User-agent: *\nAllow: /\n");
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>ProductLoop crawler bridge</title><main><h1>Connected</h1><p>Local fixture.</p></main>");
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP test server address.");
      const deploymentDefaults = {
        allowPrivateNetworks: true,
        includeSitemaps: false,
        maxPages: 1,
        obeyRobots: true
      };
      const crawler = createMaqamCrawlerTool({ defaults: deploymentDefaults });
      deploymentDefaults.allowPrivateNetworks = false;
      deploymentDefaults.maxPages = 99;
      const pages = await crawler.execute({
        runId: "run_crawler_bridge",
        stepId: "crawl",
        toolName: crawler.name,
        input: {
          seeds: [`http://127.0.0.1:${address.port}/`],
          allowPrivateNetworks: false,
          maxPages: 99
        },
        metadata: {}
      });

      expect(pages).toHaveLength(1);
      expect(pages[0]).toMatchObject({ title: "ProductLoop crawler bridge" });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it("runs the deterministic end-to-end composition", async () => {
    const result = await runDeterministicDemo();
    expect(result).toMatchObject({
      runtimeStatus: "completed",
      skillRecords: 1,
      approvalStatus: "approved",
      traceValid: true,
      browserStatus: "passed",
      evalStatus: "passed",
      evalCases: 2,
      maqamStatus: "completed",
      maqamEvidence: 1
    });
    expect(result.policyDecisions).toBeGreaterThan(0);
    expect(result.traceEvents).toBeGreaterThan(0);
    expect(result.browserCitations).toBe(1);
  });
});
