import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startWorkbenchServer } from "../src/server.js";
import { WorkbenchStore } from "../src/store.js";

describe("Workbench local server", () => {
  it("serves the dashboard and protects the operator API", async () => {
    const directory = await mkdtemp(join(tmpdir(), "productloop-workbench-server-"));
    const store = new WorkbenchStore(join(directory, "workbench.sqlite"));
    const running = await startWorkbenchServer({ store, port: 0, token: "test-token" });
    try {
      const dashboard = await fetch(running.url);
      expect(dashboard.status).toBe(200);
      expect(await dashboard.text()).toContain("ProductLoop Workbench");
      expect(dashboard.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");

      const reboundStatus = await requestStatus(running.url, { host: "attacker.example" });
      expect(reboundStatus).toBe(400);

      const denied = await fetch(`${running.url}/api/snapshot`);
      expect(denied.status).toBe(400);

      const wrongContentType = await fetch(`${running.url}/api/runs`, {
        method: "POST",
        headers: {
          "x-productloop-token": running.token,
          origin: running.url
        },
        body: JSON.stringify({ title: "Wrong type", purpose: "Must fail" })
      });
      expect(wrongContentType.status).toBe(400);

      const invalidRisk = await fetch(`${running.url}/api/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-productloop-token": running.token,
          origin: running.url
        },
        body: JSON.stringify({ title: "Invalid risk", purpose: "Must fail", risk: "urgent" })
      });
      expect(invalidRisk.status).toBe(400);

      const created = await fetch(`${running.url}/api/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-productloop-token": running.token,
          origin: running.url
        },
        body: JSON.stringify({ title: "Server fixture", purpose: "Verify protected mutations", risk: "medium" })
      });
      expect(created.status).toBe(201);

      const snapshot = await fetch(`${running.url}/api/snapshot`, {
        headers: { "x-productloop-token": running.token }
      });
      expect(snapshot.status).toBe(200);
      const body = await snapshot.json() as { runs: unknown[]; integrity: { valid: boolean } };
      expect(body.runs).toHaveLength(1);
      expect(body.integrity.valid).toBe(true);
    } finally {
      await running.close();
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function requestStatus(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.once("error", reject);
    request.end();
  });
}
