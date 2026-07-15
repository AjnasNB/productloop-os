import { readFile } from "node:fs/promises";
import { createApprovalTicket, reviewApprovalTicket, summarizeApprovalTicket } from "./workflow.js";
import { computeApprovalWorkflowDigest, validateApprovalWorkflow } from "./validation.js";
import type { ApprovalRequestDocument, ApprovalTicket, ApprovalWorkflow, CliIo } from "./types.js";

const DEFAULT_IO: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line)
};

export async function runCli(argv = process.argv.slice(2), io: CliIo = DEFAULT_IO): Promise<number> {
  const [command, ...args] = argv;

  try {
    if (command === "validate") {
      const [workflowPath] = args;
      if (!workflowPath) {
        throw new Error("Usage: ajnas-approvals validate <workflow.json>");
      }
      const workflow = await readJson<ApprovalWorkflow>(workflowPath);
      const result = validateApprovalWorkflow(workflow);
      io.stdout(`valid: ${String(result.valid)}`);
      if (result.valid) {
        io.stdout(`digest: ${computeApprovalWorkflowDigest(workflow)}`);
      } else {
        for (const issue of result.issues) {
          io.stdout(`${issue.code} ${issue.path}: ${issue.message}`);
        }
      }
      return result.valid ? 0 : 1;
    }

    if (command === "digest") {
      const [workflowPath] = args;
      if (!workflowPath) {
        throw new Error("Usage: ajnas-approvals digest <workflow.json>");
      }
      const workflow = await readJson<ApprovalWorkflow>(workflowPath);
      io.stdout(computeApprovalWorkflowDigest(workflow));
      return 0;
    }

    if (command === "request") {
      const [workflowPath, requestPath] = args;
      if (!workflowPath || !requestPath) {
        throw new Error("Usage: ajnas-approvals request <workflow.json> <approval-request.json>");
      }
      const workflow = await readJson<ApprovalWorkflow>(workflowPath);
      const request = await readJson<ApprovalRequestDocument>(requestPath);
      const ticket = createApprovalTicket({ workflow, ...request });
      io.stdout(JSON.stringify(ticket, null, 2));
      return 0;
    }

    if (command === "review") {
      const [workflowPath, ticketPath, decision, reviewerId, ...commentParts] = args;
      if (!workflowPath || !ticketPath || !decision || !reviewerId) {
        throw new Error("Usage: ajnas-approvals review <workflow.json> <ticket.json> <approve|reject> <reviewer-id> [comment]");
      }
      if (decision !== "approve" && decision !== "reject") {
        throw new Error("Decision must be approve or reject.");
      }
      const workflow = await readJson<ApprovalWorkflow>(workflowPath);
      const ticket = await readJson<ApprovalTicket>(ticketPath);
      const updated = reviewApprovalTicket(workflow, ticket, {
        reviewerId,
        decision,
        comment: commentParts.join(" ") || undefined
      });
      io.stdout(JSON.stringify(updated, null, 2));
      return 0;
    }

    if (command === "inspect") {
      const [ticketPath] = args;
      if (!ticketPath) {
        throw new Error("Usage: ajnas-approvals inspect <ticket.json>");
      }
      const ticket = await readJson<ApprovalTicket>(ticketPath);
      io.stdout(JSON.stringify(summarizeApprovalTicket(ticket), null, 2));
      return 0;
    }

    io.stderr(helpText());
    return 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  try {
    return JSON.parse(decodeJsonText(await readFile(filePath))) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON from ${filePath}: ${message}`);
  }
}

function decodeJsonText(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    throw new Error("UTF-16BE JSON is not supported.");
  }
  const nulCount = buffer.subarray(0, Math.min(buffer.length, 80)).filter((byte) => byte === 0).length;
  if (nulCount > 0) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function helpText(): string {
  return [
    "Usage: ajnas-approvals <command>",
    "",
    "Commands:",
    "  validate <workflow.json>",
    "  digest <workflow.json>",
    "  request <workflow.json> <approval-request.json>",
    "  review <workflow.json> <ticket.json> <approve|reject> <reviewer-id> [comment]",
    "  inspect <ticket.json>"
  ].join("\n");
}
