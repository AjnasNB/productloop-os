import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson, digestJson, normalizeJson, parseJson } from "./stable-json.js";
import type {
  AddEvidenceInput,
  AddMemoryLinkInput,
  CreateRunInput,
  JsonObject,
  JsonValue,
  RequestApprovalInput,
  ReviewApprovalInput,
  WorkbenchApproval,
  WorkbenchEvent,
  WorkbenchEvidence,
  WorkbenchIntegrityReport,
  WorkbenchMemoryLink,
  WorkbenchPolicySummary,
  WorkbenchProofBundle,
  WorkbenchRun,
  WorkbenchRunStatus,
  WorkbenchSnapshot
} from "./types.js";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  risk TEXT NOT NULL,
  status TEXT NOT NULL,
  policy_decision TEXT NOT NULL,
  policy_reason TEXT NOT NULL,
  current_step TEXT NOT NULL,
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  previous_hash TEXT,
  receipt_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  effect TEXT NOT NULL,
  risk TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  input_json TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  uri TEXT,
  content_digest TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_links (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  relationship TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data_json TEXT NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS approvals_run_status ON approvals(run_id, status);
CREATE INDEX IF NOT EXISTS events_run_sequence ON events(run_id, sequence);
CREATE INDEX IF NOT EXISTS evidence_run_created ON evidence(run_id, created_at);
CREATE INDEX IF NOT EXISTS memory_run_created ON memory_links(run_id, created_at);
`;

const STATUS_TRANSITIONS: Record<WorkbenchRunStatus, readonly WorkbenchRunStatus[]> = {
  planned: ["awaiting_approval", "running", "cancelled"],
  awaiting_approval: ["running", "failed", "cancelled"],
  running: ["awaiting_approval", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};
const WORKBENCH_RISKS = ["low", "medium", "high", "critical"] as const;
const RUN_STATUSES = ["planned", "awaiting_approval", "running", "completed", "failed", "cancelled"] as const;
const POLICY_DECISIONS = ["allow", "deny", "require_approval"] as const;
const REVIEW_DECISIONS = ["approve", "reject"] as const;
const EVIDENCE_SOURCE_TYPES = ["maqam", "cockroach-browser", "cockroach-crawler", "productloop", "local", "custom"] as const;
const MEMORY_PROVIDERS = ["qarinah", "custom"] as const;
const MEMORY_RELATIONSHIPS = ["context", "decision", "outcome", "supersedes"] as const;

export interface WorkbenchStoreOptions {
  clock?: () => Date;
}

export class WorkbenchStore {
  readonly path: string;
  readonly #database: DatabaseSync;
  readonly #clock: () => Date;

  constructor(path: string, options: WorkbenchStoreOptions = {}) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.#database = new DatabaseSync(this.path);
    this.#clock = options.clock ?? (() => new Date());
    this.#database.exec(SCHEMA);
    this.#database.prepare("INSERT OR IGNORE INTO metadata(key, value) VALUES (?, ?)")
      .run("schemaVersion", "productloop.workbench.sqlite.v1");
  }

  close(): void {
    this.#database.close();
  }

  createRun(input: CreateRunInput): WorkbenchRun {
    const id = normalizeId(input.id ?? `run_${randomUUID()}`, "run");
    const title = requireText(input.title, "title", 160);
    const purpose = requireText(input.purpose, "purpose", 2_000);
    const timestamp = this.#now();
    const context = (normalizeJson(input.context ?? {}) as JsonObject);
    const risk = requireEnum(input.risk ?? "medium", WORKBENCH_RISKS, "risk");
    const status = requireEnum(input.status ?? "planned", RUN_STATUSES, "status");
    const decision = requireEnum(input.policyDecision ?? "deny", POLICY_DECISIONS, "policyDecision");
    const reason = requireText(input.policyReason ?? "No policy has allowed execution yet.", "policyReason", 2_000);
    const currentStep = requireText(input.currentStep ?? "Plan", "currentStep", 160);

    return this.#transaction(() => {
      this.#database.prepare(`
        INSERT INTO runs(
          id, title, purpose, risk, status, policy_decision, policy_reason,
          current_step, context_json, created_at, updated_at, previous_hash, receipt_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
      `).run(
        id,
        title,
        purpose,
        risk,
        status,
        decision,
        reason,
        currentStep,
        canonicalJson(context),
        timestamp,
        timestamp,
        "sha256:pending"
      );
      const event = this.#appendEvent(id, "run.created", {
        title,
        purpose,
        risk,
        status,
        policyDecision: decision,
        policyReason: reason,
        currentStep,
        context
      }, timestamp);
      this.#database.prepare("UPDATE runs SET previous_hash = ?, receipt_hash = ? WHERE id = ?")
        .run(event.previousHash, event.eventHash, id);
      return this.requireRun(id);
    });
  }

  getRun(id: string): WorkbenchRun | undefined {
    const row = this.#database.prepare("SELECT * FROM runs WHERE id = ?").get(id);
    return row ? rowToRun(row as RunRow) : undefined;
  }

  requireRun(id: string): WorkbenchRun {
    const run = this.getRun(id);
    if (!run) throw new Error(`Workbench run ${id} was not found.`);
    return run;
  }

  listRuns(): WorkbenchRun[] {
    return (this.#database.prepare("SELECT * FROM runs ORDER BY updated_at DESC, id ASC").all() as RunRow[])
      .map(rowToRun);
  }

  transitionRun(id: string, status: WorkbenchRunStatus, currentStep: string): WorkbenchRun {
    const run = this.requireRun(id);
    const nextStatus = requireEnum(status, RUN_STATUSES, "status");
    if (!STATUS_TRANSITIONS[run.status].includes(nextStatus)) {
      throw new Error(`Run ${id} cannot transition from ${run.status} to ${nextStatus}.`);
    }
    const step = requireText(currentStep, "currentStep", 160);
    const timestamp = this.#now();
    return this.#transaction(() => {
      this.#database.prepare("UPDATE runs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?")
        .run(nextStatus, step, timestamp, id);
      const event = this.#appendEvent(id, "run.transitioned", {
        from: run.status,
        to: nextStatus,
        currentStep: step
      }, timestamp);
      this.#database.prepare("UPDATE runs SET previous_hash = ?, receipt_hash = ? WHERE id = ?")
        .run(event.previousHash, event.eventHash, id);
      return this.requireRun(id);
    });
  }

  requestApproval(input: RequestApprovalInput): WorkbenchApproval {
    const run = this.requireRun(input.runId);
    if (["completed", "failed", "cancelled"].includes(run.status)) {
      throw new Error(`Run ${run.id} cannot request approval after reaching ${run.status}.`);
    }
    const id = normalizeId(input.id ?? `apr_${randomUUID()}`, "approval");
    const timestamp = this.#now();
    const normalizedInput = normalizeJson(input.input);
    const toolName = requireText(input.toolName, "toolName", 200);
    const effect = requireText(input.effect, "effect", 80);
    const risk = requireEnum(input.risk, WORKBENCH_RISKS, "risk");
    const reason = requireText(input.reason, "reason", 2_000);
    const requestedBy = requireText(input.requestedBy, "requestedBy", 200);
    const inputDigest = digestJson({
      runId: run.id,
      toolName,
      effect,
      risk,
      input: normalizedInput
    });
    return this.#transaction(() => {
      this.#database.prepare(`
        INSERT INTO approvals(
          id, run_id, status, tool_name, effect, risk, reason, requested_by,
          input_json, input_digest, created_at, updated_at
        ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        run.id,
        toolName,
        effect,
        risk,
        reason,
        requestedBy,
        canonicalJson(normalizedInput),
        inputDigest,
        timestamp,
        timestamp
      );
      this.#database.prepare(`
        UPDATE runs
        SET status = 'awaiting_approval', policy_decision = 'require_approval',
            policy_reason = ?, current_step = 'Human review', updated_at = ?
        WHERE id = ?
      `).run(reason, timestamp, run.id);
      const event = this.#appendEvent(run.id, "approval.requested", {
        approvalId: id,
        toolName,
        effect,
        risk,
        reason,
        requestedBy,
        inputDigest
      }, timestamp);
      this.#database.prepare("UPDATE runs SET previous_hash = ?, receipt_hash = ? WHERE id = ?")
        .run(event.previousHash, event.eventHash, run.id);
      return this.requireApproval(id);
    });
  }

  reviewApproval(id: string, input: ReviewApprovalInput): WorkbenchApproval {
    const approval = this.requireApproval(id);
    if (approval.status !== "pending") throw new Error(`Approval ${id} is already ${approval.status}.`);
    const timestamp = this.#now();
    const decision = requireEnum(input.decision, REVIEW_DECISIONS, "decision");
    const reviewerId = requireText(input.reviewerId, "reviewerId", 200);
    const comment = input.comment === undefined ? undefined : requireText(input.comment, "comment", 2_000, true);
    const status = decision === "approve" ? "approved" : "rejected";
    return this.#transaction(() => {
      const result = this.#database.prepare(`
        UPDATE approvals
        SET status = ?, reviewer_id = ?, reviewer_comment = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(
        status,
        reviewerId,
        comment ?? null,
        timestamp,
        id
      );
      if (result.changes !== 1) throw new Error(`Approval ${id} changed before the decision was committed.`);
      const event = this.#appendEvent(approval.runId, "approval.reviewed", {
        approvalId: id,
        decision,
        reviewerId,
        comment: comment ?? null,
        inputDigest: approval.inputDigest
      }, timestamp);
      if (status === "rejected") {
        this.#database.prepare(`
          UPDATE runs SET status = 'failed', current_step = 'Approval rejected', updated_at = ?, previous_hash = ?, receipt_hash = ?
          WHERE id = ?
        `).run(timestamp, event.previousHash, event.eventHash, approval.runId);
      } else {
        this.#database.prepare("UPDATE runs SET updated_at = ?, previous_hash = ?, receipt_hash = ? WHERE id = ?")
          .run(timestamp, event.previousHash, event.eventHash, approval.runId);
      }
      return this.requireApproval(id);
    });
  }

  resumeRun(id: string): WorkbenchRun {
    const run = this.requireRun(id);
    if (run.status !== "awaiting_approval") throw new Error(`Run ${id} is not waiting for approval.`);
    const row = this.#database.prepare(`
      SELECT * FROM approvals WHERE run_id = ? AND status = 'approved'
      ORDER BY updated_at DESC, id ASC LIMIT 1
    `).get(id) as ApprovalRow | undefined;
    if (!row) throw new Error(`Run ${id} has no approved, unconsumed decision.`);
    const approval = rowToApproval(row);
    const timestamp = this.#now();
    return this.#transaction(() => {
      const result = this.#database.prepare(`
        UPDATE approvals SET status = 'consumed', consumed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'approved'
      `).run(timestamp, timestamp, approval.id);
      if (result.changes !== 1) throw new Error(`Approval ${approval.id} was already consumed.`);
      this.#database.prepare(`
        UPDATE runs SET status = 'running', current_step = 'Approved operation ready for governed dispatch', updated_at = ?
        WHERE id = ? AND status = 'awaiting_approval'
      `).run(timestamp, id);
      const event = this.#appendEvent(id, "approval.consumed", {
        approvalId: approval.id,
        inputDigest: approval.inputDigest,
        reviewerId: approval.reviewerId ?? null
      }, timestamp);
      this.#database.prepare("UPDATE runs SET previous_hash = ?, receipt_hash = ? WHERE id = ?")
        .run(event.previousHash, event.eventHash, id);
      return this.requireRun(id);
    });
  }

  listApprovals(runId?: string): WorkbenchApproval[] {
    const rows = runId
      ? this.#database.prepare("SELECT * FROM approvals WHERE run_id = ? ORDER BY created_at DESC, id ASC").all(runId)
      : this.#database.prepare("SELECT * FROM approvals ORDER BY created_at DESC, id ASC").all();
    return (rows as ApprovalRow[]).map(rowToApproval);
  }

  requireApproval(id: string): WorkbenchApproval {
    const row = this.#database.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as ApprovalRow | undefined;
    if (!row) throw new Error(`Workbench approval ${id} was not found.`);
    return rowToApproval(row);
  }

  addEvidence(input: AddEvidenceInput): WorkbenchEvidence {
    this.requireRun(input.runId);
    const id = normalizeId(input.id ?? `ev_${randomUUID()}`, "evidence");
    const timestamp = this.#now();
    const source = requireText(input.source, "source", 500);
    const title = requireText(input.title, "title", 300);
    const excerpt = requireText(input.excerpt, "excerpt", 20_000);
    const sourceType = requireEnum(input.sourceType, EVIDENCE_SOURCE_TYPES, "sourceType");
    const uri = input.uri === undefined ? undefined : normalizeUri(input.uri);
    const contentDigest = digestJson({ sourceType, source, title, excerpt, uri: uri ?? null });
    return this.#transaction(() => {
      this.#database.prepare(`
        INSERT INTO evidence(id, run_id, source_type, source, title, excerpt, uri, content_digest, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.runId, sourceType, source, title, excerpt, uri ?? null, contentDigest, timestamp);
      const event = this.#appendEvent(input.runId, "evidence.added", {
        evidenceId: id,
        sourceType,
        source,
        title,
        uri: uri ?? null,
        contentDigest
      }, timestamp);
      this.#database.prepare("UPDATE runs SET updated_at = ?, previous_hash = ?, receipt_hash = ? WHERE id = ?")
        .run(timestamp, event.previousHash, event.eventHash, input.runId);
      return this.listEvidence(input.runId).find((item) => item.id === id)!;
    });
  }

  listEvidence(runId?: string): WorkbenchEvidence[] {
    const rows = runId
      ? this.#database.prepare("SELECT * FROM evidence WHERE run_id = ? ORDER BY created_at DESC, id ASC").all(runId)
      : this.#database.prepare("SELECT * FROM evidence ORDER BY created_at DESC, id ASC").all();
    return (rows as EvidenceRow[]).map(rowToEvidence);
  }

  addMemoryLink(input: AddMemoryLinkInput): WorkbenchMemoryLink {
    this.requireRun(input.runId);
    const id = normalizeId(input.id ?? `mem_${randomUUID()}`, "memory link");
    const timestamp = this.#now();
    const provider = requireEnum(input.provider, MEMORY_PROVIDERS, "provider");
    const eventId = requireText(input.eventId, "eventId", 300);
    const eventHash = requireDigest(input.eventHash, "eventHash");
    const relationship = requireEnum(input.relationship, MEMORY_RELATIONSHIPS, "relationship");
    const summary = requireText(input.summary, "summary", 2_000);
    return this.#transaction(() => {
      this.#database.prepare(`
        INSERT INTO memory_links(id, run_id, provider, event_id, event_hash, relationship, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.runId,
        provider,
        eventId,
        eventHash,
        relationship,
        summary,
        timestamp
      );
      const event = this.#appendEvent(input.runId, "memory.linked", {
        memoryLinkId: id,
        provider,
        eventId,
        eventHash,
        relationship
      }, timestamp);
      this.#database.prepare("UPDATE runs SET updated_at = ?, previous_hash = ?, receipt_hash = ? WHERE id = ?")
        .run(timestamp, event.previousHash, event.eventHash, input.runId);
      return this.listMemory(input.runId).find((item) => item.id === id)!;
    });
  }

  listMemory(runId?: string): WorkbenchMemoryLink[] {
    const rows = runId
      ? this.#database.prepare("SELECT * FROM memory_links WHERE run_id = ? ORDER BY created_at DESC, id ASC").all(runId)
      : this.#database.prepare("SELECT * FROM memory_links ORDER BY created_at DESC, id ASC").all();
    return (rows as MemoryRow[]).map(rowToMemory);
  }

  listEvents(runId?: string): WorkbenchEvent[] {
    const rows = runId
      ? this.#database.prepare("SELECT * FROM events WHERE run_id = ? ORDER BY sequence ASC").all(runId)
      : this.#database.prepare("SELECT * FROM events ORDER BY sequence ASC").all();
    return (rows as EventRow[]).map(rowToEvent);
  }

  verify(runId?: string): WorkbenchIntegrityReport {
    const events = this.listEvents(runId);
    const issues: string[] = [];
    const heads = new Map<string, string | null>();
    for (const event of events) {
      const previousHash = heads.get(event.runId) ?? null;
      if (event.previousHash !== previousHash) issues.push(`Event ${event.id} does not extend the previous event hash.`);
      const expected = digestEvent({
        id: event.id,
        sequence: event.sequence,
        runId: event.runId,
        type: event.type,
        timestamp: event.timestamp,
        data: event.data,
        previousHash: event.previousHash
      });
      if (event.eventHash !== expected) issues.push(`Event ${event.id} hash does not match its canonical content.`);
      heads.set(event.runId, event.eventHash);
    }
    const sortedHeads = [...heads.entries()].sort(([left], [right]) => left.localeCompare(right));
    const headHash = sortedHeads.length === 0
      ? null
      : sortedHeads.length === 1
        ? sortedHeads[0]![1]
        : digestJson(Object.fromEntries(sortedHeads));
    return {
      valid: issues.length === 0,
      eventCount: events.length,
      headHash,
      issues
    };
  }

  snapshot(policies: WorkbenchPolicySummary[] = defaultPolicies()): WorkbenchSnapshot {
    return {
      schemaVersion: "productloop.workbench.snapshot.v1",
      generatedAt: this.#now(),
      runs: this.listRuns(),
      approvals: this.listApprovals(),
      evidence: this.listEvidence(),
      memory: this.listMemory(),
      policies,
      integrity: this.verify()
    };
  }

  exportRun(runId: string): WorkbenchProofBundle {
    const unsigned = {
      schemaVersion: "productloop.workbench.proof-bundle.v1" as const,
      exportedAt: this.#now(),
      run: this.requireRun(runId),
      approvals: this.listApprovals(runId),
      evidence: this.listEvidence(runId),
      memory: this.listMemory(runId),
      events: this.listEvents(runId),
      integrity: this.verify(runId)
    };
    return { ...unsigned, bundleDigest: digestJson(unsigned) };
  }

  #appendEvent(runId: string, type: string, data: JsonObject, timestamp: string): WorkbenchEvent {
    const head = this.#database.prepare("SELECT event_hash FROM events WHERE run_id = ? ORDER BY sequence DESC LIMIT 1").get(runId) as
      | { event_hash: string }
      | undefined;
    const previousHash = head?.event_hash ?? null;
    const id = `evt_${randomUUID()}`;
    const placeholder = `pending:${randomUUID()}`;
    const result = this.#database.prepare(`
      INSERT INTO events(id, run_id, type, timestamp, data_json, previous_hash, event_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, runId, requireText(type, "event type", 200), timestamp, canonicalJson(data), previousHash, placeholder);
    const sequence = Number(result.lastInsertRowid);
    const eventHash = digestEvent({ id, sequence, runId, type, timestamp, data, previousHash });
    this.#database.prepare("UPDATE events SET event_hash = ? WHERE sequence = ?").run(eventHash, sequence);
    return {
      schemaVersion: "productloop.workbench.event.v1",
      id,
      sequence,
      runId,
      type,
      timestamp,
      data,
      previousHash,
      eventHash
    };
  }

  #transaction<T>(operation: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  #now(): string {
    return this.#clock().toISOString();
  }
}

function digestEvent(input: Omit<WorkbenchEvent, "schemaVersion" | "eventHash">): string {
  return digestJson({ schemaVersion: "productloop.workbench.event.v1", ...input });
}

function normalizeId(value: string, label: string): string {
  const normalized = requireText(value, label, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(normalized)) throw new TypeError(`${label} id is not path-safe.`);
  return normalized;
}

function requireText(value: string, label: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new TypeError(`${label} must not be empty.`);
  if (normalized.length > maxLength) throw new TypeError(`${label} exceeds ${maxLength} characters.`);
  return normalized;
}

function requireDigest(value: string, label: string): string {
  const normalized = requireText(value, label, 100);
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) throw new TypeError(`${label} must be a SHA-256 digest.`);
  return normalized;
}

function requireEnum<const T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new TypeError(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function normalizeUri(value: string): string {
  const normalized = requireText(value, "uri", 2_000);
  const url = new URL(normalized);
  if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "file:") {
    throw new TypeError("Evidence URI must use https, http, or file.");
  }
  if (url.username || url.password) throw new TypeError("Evidence URI must not contain credentials.");
  return url.toString();
}

function defaultPolicies(): WorkbenchPolicySummary[] {
  return [
    {
      id: "default-deny",
      name: "Unregistered operations",
      effect: "deny",
      description: "Operations stay denied until a host supplies an explicit governed route.",
      scope: "ProductLoop runtime and Maqam gateway"
    },
    {
      id: "exact-approval",
      name: "Consequential effects",
      effect: "require_approval",
      description: "Write, publish, execute, upload, download, and credential effects require an exact bound approval.",
      scope: "Registered consequential tools"
    },
    {
      id: "bounded-read",
      name: "Bounded public evidence",
      effect: "allow",
      description: "Explicit public reads may run when origins, requests, bytes, and time are bounded by the selected adapter.",
      scope: "Cockroach Crawler, Browser, and reviewed source adapters"
    }
  ];
}

type RunRow = {
  id: string; title: string; purpose: string; risk: WorkbenchRun["risk"]; status: WorkbenchRun["status"];
  policy_decision: WorkbenchRun["policyDecision"]; policy_reason: string; current_step: string; context_json: string;
  created_at: string; updated_at: string; previous_hash: string | null; receipt_hash: string;
};
type ApprovalRow = {
  id: string; run_id: string; status: WorkbenchApproval["status"]; tool_name: string; effect: string;
  risk: WorkbenchApproval["risk"]; reason: string; requested_by: string; input_json: string; input_digest: string;
  reviewer_id: string | null; reviewer_comment: string | null; created_at: string; updated_at: string; consumed_at: string | null;
};
type EvidenceRow = {
  id: string; run_id: string; source_type: WorkbenchEvidence["sourceType"]; source: string; title: string;
  excerpt: string; uri: string | null; content_digest: string; created_at: string;
};
type MemoryRow = {
  id: string; run_id: string; provider: WorkbenchMemoryLink["provider"]; event_id: string; event_hash: string;
  relationship: WorkbenchMemoryLink["relationship"]; summary: string; created_at: string;
};
type EventRow = {
  sequence: number; id: string; run_id: string; type: string; timestamp: string; data_json: string;
  previous_hash: string | null; event_hash: string;
};

function rowToRun(row: RunRow): WorkbenchRun {
  return {
    schemaVersion: "productloop.workbench.run.v1",
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    risk: row.risk,
    status: row.status,
    policyDecision: row.policy_decision,
    policyReason: row.policy_reason,
    currentStep: row.current_step,
    context: parseJson<JsonObject>(row.context_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previousHash: row.previous_hash,
    receiptHash: row.receipt_hash
  };
}

function rowToApproval(row: ApprovalRow): WorkbenchApproval {
  return {
    schemaVersion: "productloop.workbench.approval.v1",
    id: row.id,
    runId: row.run_id,
    status: row.status,
    toolName: row.tool_name,
    effect: row.effect,
    risk: row.risk,
    reason: row.reason,
    requestedBy: row.requested_by,
    input: parseJson<JsonValue>(row.input_json),
    inputDigest: row.input_digest,
    ...(row.reviewer_id === null ? {} : { reviewerId: row.reviewer_id }),
    ...(row.reviewer_comment === null ? {} : { reviewerComment: row.reviewer_comment }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.consumed_at === null ? {} : { consumedAt: row.consumed_at })
  };
}

function rowToEvidence(row: EvidenceRow): WorkbenchEvidence {
  return {
    schemaVersion: "productloop.workbench.evidence.v1",
    id: row.id,
    runId: row.run_id,
    sourceType: row.source_type,
    source: row.source,
    title: row.title,
    excerpt: row.excerpt,
    ...(row.uri === null ? {} : { uri: row.uri }),
    contentDigest: row.content_digest,
    createdAt: row.created_at
  };
}

function rowToMemory(row: MemoryRow): WorkbenchMemoryLink {
  return {
    schemaVersion: "productloop.workbench.memory-link.v1",
    id: row.id,
    runId: row.run_id,
    provider: row.provider,
    eventId: row.event_id,
    eventHash: row.event_hash,
    relationship: row.relationship,
    summary: row.summary,
    createdAt: row.created_at
  };
}

function rowToEvent(row: EventRow): WorkbenchEvent {
  return {
    schemaVersion: "productloop.workbench.event.v1",
    id: row.id,
    sequence: row.sequence,
    runId: row.run_id,
    type: row.type,
    timestamp: row.timestamp,
    data: parseJson<JsonObject>(row.data_json),
    previousHash: row.previous_hash,
    eventHash: row.event_hash
  };
}
