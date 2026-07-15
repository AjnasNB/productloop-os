import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  createMaqamCrawlerTool,
  createProductLoopOS,
  inspectModules,
  runDeterministicDemo
} from "../src/index.js";

describe("productloop-os", () => {
  it("loads Maqam and every Ajnas package namespace", () => {
    const modules = inspectModules();
    expect(modules).toHaveLength(9);
    expect(modules.every((module) => module.loaded)).toBe(true);
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
    const crawler = createMaqamCrawlerTool({
      defaults: { obeyRobots: true, maxPages: 2 }
    });
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
      const crawler = createMaqamCrawlerTool({
        defaults: {
          allowPrivateNetworks: true,
          includeSitemaps: false,
          maxPages: 1,
          obeyRobots: true
        }
      });
      const pages = await crawler.execute({
        runId: "run_crawler_bridge",
        stepId: "crawl",
        toolName: crawler.name,
        input: { seeds: [`http://127.0.0.1:${address.port}/`] },
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
