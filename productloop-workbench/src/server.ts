import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { seedWorkbenchDemo } from "./demo.js";
import { WorkbenchStore } from "./store.js";
import type { CreateRunInput, ReviewApprovalInput } from "./types.js";
import { renderWorkbenchHtml } from "./ui.js";

export interface WorkbenchServerOptions {
  store: WorkbenchStore;
  port?: number;
  host?: "127.0.0.1";
  token?: string;
}

export interface RunningWorkbenchServer {
  url: string;
  token: string;
  close(): Promise<void>;
}

export async function startWorkbenchServer(options: WorkbenchServerOptions): Promise<RunningWorkbenchServer> {
  const host = options.host ?? "127.0.0.1";
  const token = options.token ?? randomBytes(32).toString("hex");
  let expectedAuthority = "";
  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, options.store, token, expectedAuthority);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Workbench request failed." });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 43120, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  expectedAuthority = `${host}:${address.port}`;
  const url = `http://${host}:${address.port}`;
  return {
    url,
    token,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: WorkbenchStore,
  token: string,
  expectedAuthority: string
): Promise<void> {
  const method = request.method ?? "GET";
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  setSecurityHeaders(response);
  requireAuthority(request, expectedAuthority);

  if (method === "GET" && requestUrl.pathname === "/") {
    const nonce = randomBytes(18).toString("base64url");
    response.setHeader("content-security-policy", `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(renderWorkbenchHtml(token, nonce));
    return;
  }
  if (method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { ok: store.verify().valid, version: "0.1.0" });
    return;
  }
  requireToken(request, token);
  requireSameOrigin(request);

  if (method === "GET" && requestUrl.pathname === "/api/snapshot") {
    sendJson(response, 200, store.snapshot());
    return;
  }
  if (method === "POST" && requestUrl.pathname === "/api/demo") {
    sendJson(response, 201, await seedWorkbenchDemo(store));
    return;
  }
  if (method === "POST" && requestUrl.pathname === "/api/runs") {
    const body = await readJsonBody<CreateRunInput>(request);
    sendJson(response, 201, store.createRun(body));
    return;
  }
  const approvalMatch = /^\/api\/approvals\/([A-Za-z0-9_.-]+)\/decision$/u.exec(requestUrl.pathname);
  if (method === "POST" && approvalMatch?.[1]) {
    const body = await readJsonBody<ReviewApprovalInput>(request);
    sendJson(response, 200, store.reviewApproval(approvalMatch[1], body));
    return;
  }
  const resumeMatch = /^\/api\/runs\/([A-Za-z0-9_.-]+)\/resume$/u.exec(requestUrl.pathname);
  if (method === "POST" && resumeMatch?.[1]) {
    await readJsonBody<Record<string, never>>(request);
    sendJson(response, 200, store.resumeRun(resumeMatch[1]));
    return;
  }
  const exportMatch = /^\/api\/runs\/([A-Za-z0-9_.-]+)\/export$/u.exec(requestUrl.pathname);
  if (method === "GET" && exportMatch?.[1]) {
    sendJson(response, 200, store.exportRun(exportMatch[1]));
    return;
  }
  sendJson(response, 404, { error: "Workbench route not found." });
}

function requireToken(request: IncomingMessage, token: string): void {
  if (request.headers["x-productloop-token"] !== token) throw new Error("Workbench API token is missing or invalid.");
}

function requireAuthority(request: IncomingMessage, expectedAuthority: string): void {
  if (!expectedAuthority || request.headers.host !== expectedAuthority) {
    throw new Error("Workbench Host header is not the active loopback authority.");
  }
}

function requireSameOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  if (origin === undefined) return;
  const host = request.headers.host;
  if (!host || origin !== `http://${host}`) throw new Error("Cross-origin Workbench requests are denied.");
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new Error("Workbench mutation requests require application/json.");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 64 * 1024) throw new Error("Workbench request body exceeds 64 KiB.");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {} as T;
  const value = JSON.parse(raw) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Workbench request body must be a JSON object.");
  return value as T;
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("cross-origin-resource-policy", "same-origin");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}
