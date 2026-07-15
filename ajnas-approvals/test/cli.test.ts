import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";

describe("ajnas-approvals CLI", () => {
  test("validates, digests, creates, reviews, and inspects approval tickets", async () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const io = {
      stdout: (line: string) => lines.push(line),
      stderr: (line: string) => errors.push(line)
    };

    await expect(runCli(["validate", "fixtures/release-approval.workflow.json"], io)).resolves.toBe(0);
    expect(lines.join("\n")).toContain("valid: true");
    lines.length = 0;

    await expect(runCli(["digest", "fixtures/release-approval.workflow.json"], io)).resolves.toBe(0);
    expect(lines[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
    lines.length = 0;

    await expect(runCli(["request", "fixtures/release-approval.workflow.json", "fixtures/release-approval-request.json"], io)).resolves.toBe(0);
    const ticket = JSON.parse(lines.join("\n"));
    expect(ticket.status).toBe("pending");
    lines.length = 0;

    const tempDir = mkdtempSync(join(tmpdir(), "ajnas-approvals-"));
    try {
      const ticketPath = join(tempDir, "ticket.json");
      writeFileSync(ticketPath, JSON.stringify(ticket, null, 2), "utf8");
      await expect(
        runCli(["review", "fixtures/release-approval.workflow.json", ticketPath, "approve", "security-lead", "security ok"], io)
      ).resolves.toBe(0);
      const reviewed = JSON.parse(lines.join("\n"));
      expect(reviewed.stageId).toBe("release-owner-review");
      lines.length = 0;

      writeFileSync(ticketPath, JSON.stringify(reviewed, null, 2), "utf8");
      await expect(runCli(["inspect", ticketPath], io)).resolves.toBe(0);
      const summary = JSON.parse(lines.join("\n"));
      expect(summary.status).toBe("pending");
      expect(summary.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }

    expect(errors).toEqual([]);
  });

  test("reads UTF-16LE JSON emitted by Windows PowerShell redirection", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ajnas-approvals-utf16-"));
    try {
      const workflowText = readFileSync("fixtures/release-approval.workflow.json", "utf8");
      const workflowPath = join(tempDir, "workflow.json");
      writeFileSync(workflowPath, `\uFEFF${workflowText}`, "utf16le");
      const lines: string[] = [];
      const code = await runCli(["validate", workflowPath], {
        stdout: (line) => lines.push(line),
        stderr: () => undefined
      });
      expect(code).toBe(0);
      expect(lines[0]).toBe("valid: true");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
