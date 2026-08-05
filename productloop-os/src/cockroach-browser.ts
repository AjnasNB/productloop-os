import { browserResearch } from "./namespaces.js";

export const COCKROACH_BROWSER_CONNECTION_SCHEMA =
  "productloop.cockroach-browser-connection.v1" as const;

const OPTION_FIELDS = Object.freeze([
  "client",
  "allowedOrigins",
  "mode",
  "maxDurationMs",
  "maxSnapshotChars",
  "allowPrivateNetwork"
] as const);
const MAX_ALLOWED_ORIGINS = 64;
const DEFAULT_MAX_DURATION_MS = 120_000;
const MAX_DURATION_MS = 15 * 60_000;
const DEFAULT_MAX_SNAPSHOT_CHARS = 50_000;
const MAX_SNAPSHOT_CHARS = 120_000;
const MAX_CITATION_CHARS = 500;
const MAX_CLAIMS = 32;
const MAX_CLAIM_CHARS = 2_000;

export interface CockroachBrowserSessionCreateInput {
  mode: "headless" | "headed";
  startUrl: string;
  purpose: string;
  actor: "productloop-os";
  policy: {
    allowedOrigins: string[];
    allowedActions: ["snapshot"];
    allowedEffects: ["read"];
    allowPrivateNetwork: boolean;
    requireApprovalFor: [];
    budget: {
      maxActions: number;
      maxDurationMs: number;
      maxTabs: number;
      maxDownloadBytes: number;
      maxUploadBytes: number;
      maxSnapshotChars: number;
      maxEvidenceBytes: number;
      maxHistoryEntries: number;
      maxNetworkEntries: number;
      maxClipboardBytes: number;
      maxSavedStates: number;
      maxNetworkRules: number;
      maxRouteFulfillBytes: number;
      maxInterceptedBytes: number;
    };
  };
}

/**
 * Structural subset of `cockroach-browser/client` used by ProductLoop.
 *
 * The host owns the concrete client and its bearer token. Keeping this as a
 * structural contract lets `productloop-os` remain MIT licensed without
 * bundling or starting the separately installed AGPL browser runtime.
 */
export interface CockroachBrowserClientLike {
  health(): Promise<unknown>;
  capabilities(): Promise<unknown>;
  createSession(input: CockroachBrowserSessionCreateInput): Promise<unknown>;
  snapshot(sessionId: string, tabId?: string): Promise<unknown>;
  closeSession(sessionId: string): Promise<unknown>;
}

export interface CockroachBrowserResearchAdapterOptions {
  client: CockroachBrowserClientLike;
  /** Exact HTTP(S) origins owned by the deployment. Wildcards are rejected. */
  allowedOrigins: readonly string[];
  mode?: "headless" | "headed";
  maxDurationMs?: number;
  maxSnapshotChars?: number;
  /** Explicit opt-in for loopback or private-network research targets. */
  allowPrivateNetwork?: boolean;
}

export interface CockroachBrowserConnectionReport {
  schema: typeof COCKROACH_BROWSER_CONNECTION_SCHEMA;
  ready: true;
  service: "cockroach-browser";
  transport: "authenticated-http-client";
  version: string;
  sessions: number;
  capabilityIds: readonly string[];
  health: browserResearch.JsonObject;
}

interface BoundCockroachBrowserClient {
  health: () => Promise<unknown>;
  capabilities: () => Promise<unknown>;
  createSession: (input: CockroachBrowserSessionCreateInput) => Promise<unknown>;
  snapshot: (sessionId: string, tabId?: string) => Promise<unknown>;
  closeSession: (sessionId: string) => Promise<unknown>;
}

interface NormalizedAdapterOptions {
  client: BoundCockroachBrowserClient;
  allowedOrigins: readonly string[];
  mode: "headless" | "headed";
  maxDurationMs: number;
  maxSnapshotChars: number;
  allowPrivateNetwork: boolean;
}

interface BrowserSnapshot {
  sessionId: string;
  tabId: string;
  url: string;
  title: string;
  capturedAt: string;
  text: string;
  digest: string;
  truncated: boolean;
  refs: readonly browserResearch.JsonValue[];
  challenge?: browserResearch.JsonObject;
}

/** Verify authentication and the live Cockroach Browser daemon contract. */
export async function checkCockroachBrowserConnection(
  clientInput: CockroachBrowserClientLike
): Promise<CockroachBrowserConnectionReport> {
  const client = bindClient(clientInput);
  const health = browserResearch.toJsonObject(await client.health());
  const ok = readJsonDataField(health, "ok", "health");
  const name = readJsonDataField(health, "name", "health");
  if (ok !== true || name !== "cockroach-browser") {
    throw new TypeError(
      'Cockroach Browser health must report { ok: true, name: "cockroach-browser" }'
    );
  }

  const version = requireNonEmptyString(
    readJsonDataField(health, "version", "health"),
    "health.version"
  );
  const sessions = requireNonNegativeSafeInteger(
    readJsonDataField(health, "sessions", "health"),
    "health.sessions"
  );
  const capabilities = browserResearch.toJsonValue(await client.capabilities());
  if (!Array.isArray(capabilities)) {
    throw new TypeError("capabilities must be an array");
  }

  const capabilityIds: string[] = [];
  const seen = new Set<string>();
  for (const [index, capabilityValue] of capabilities.entries()) {
    const capability = requireJsonObject(capabilityValue, `capabilities[${index}]`);
    const id = requireNonEmptyString(
      readJsonDataField(capability, "id", `capabilities[${index}]`),
      `capabilities[${index}].id`
    );
    if (seen.has(id)) {
      throw new TypeError(`capabilities contains duplicate id "${id}"`);
    }
    seen.add(id);
    capabilityIds.push(id);
  }

  return deepFreeze({
    schema: COCKROACH_BROWSER_CONNECTION_SCHEMA,
    ready: true,
    service: "cockroach-browser",
    transport: "authenticated-http-client",
    version,
    sessions,
    capabilityIds,
    health
  });
}

/**
 * Create a live read-only adapter for ProductLoop's governed browser harness.
 * Each open or extract step gets a fresh session which is closed in all paths.
 */
export function createCockroachBrowserResearchAdapter(
  optionsInput: CockroachBrowserResearchAdapterOptions
): browserResearch.BrowserResearchAdapter {
  const options = normalizeOptions(optionsInput);

  const observe = async (
    input: browserResearch.BrowserResearchAdapterInput
  ): Promise<BrowserSnapshot> => {
    if (input.step.selector !== undefined) {
      throw new TypeError(
        "Cockroach Browser semantic snapshots do not support selector-scoped extraction"
      );
    }
    const requestedUrl = requireStepUrl(input.step.url);
    assertAllowedUrl(requestedUrl, options.allowedOrigins);

    const sessionValue = await options.client.createSession(
      createSessionInput(options, requestedUrl, input)
    );
    const session = browserResearch.toJsonObject(sessionValue);
    const sessionId = requireNonEmptyString(
      readJsonDataField(session, "id", "session"),
      "session.id"
    );

    let snapshot: BrowserSnapshot | undefined;
    let operationError: unknown;
    try {
      snapshot = normalizeSnapshot(
        await options.client.snapshot(sessionId),
        sessionId,
        options.allowedOrigins
      );
    } catch (error) {
      operationError = error;
    }

    try {
      await options.client.closeSession(sessionId);
    } catch (closeError) {
      if (operationError !== undefined) {
        throw new AggregateError(
          [operationError, closeError],
          `Cockroach Browser observation and session close both failed for ${sessionId}`
        );
      }
      throw closeError;
    }

    if (operationError !== undefined) throw operationError;
    if (!snapshot) throw new Error("Cockroach Browser returned no snapshot");
    return snapshot;
  };

  return Object.freeze({
    async open(
      input: browserResearch.BrowserResearchAdapterInput
    ): Promise<browserResearch.OpenAdapterOutput> {
      const snapshot = await observe(input);
      return {
        url: snapshot.url,
        finalUrl: snapshot.url,
        title: snapshot.title,
        text: snapshot.text,
        citations: [citationFromSnapshot(snapshot)],
        metadata: metadataFromSnapshot(snapshot)
      };
    },
    async extract(
      input: browserResearch.BrowserResearchAdapterInput
    ): Promise<browserResearch.ExtractAdapterOutput> {
      const snapshot = await observe(input);
      const claims = claimsFromSnapshot(snapshot);
      return {
        url: snapshot.url,
        title: snapshot.title,
        claims,
        citations: [citationFromSnapshot(snapshot)],
        metadata: metadataFromSnapshot(snapshot)
      };
    }
  });
}

function normalizeOptions(
  input: CockroachBrowserResearchAdapterOptions
): NormalizedAdapterOptions {
  const options = requirePlainRecord(input, "options");
  requireOnlyFields(options, OPTION_FIELDS, "options");

  const clientValue = readOwnDataField(options, "client", "options");
  const allowedOriginsValue = readOwnDataField(options, "allowedOrigins", "options");
  const allowedOrigins = normalizeAllowedOrigins(allowedOriginsValue);
  const modeValue = readOptionalOwnDataField(options, "mode", "options") ?? "headless";
  if (modeValue !== "headless" && modeValue !== "headed") {
    throw new TypeError('options.mode must equal "headless" or "headed"');
  }
  const maxDurationMs = requireBoundedPositiveSafeInteger(
    readOptionalOwnDataField(options, "maxDurationMs", "options")
      ?? DEFAULT_MAX_DURATION_MS,
    "options.maxDurationMs",
    MAX_DURATION_MS
  );
  const maxSnapshotChars = requireBoundedPositiveSafeInteger(
    readOptionalOwnDataField(options, "maxSnapshotChars", "options")
      ?? DEFAULT_MAX_SNAPSHOT_CHARS,
    "options.maxSnapshotChars",
    MAX_SNAPSHOT_CHARS
  );
  const allowPrivateNetworkValue =
    readOptionalOwnDataField(options, "allowPrivateNetwork", "options") ?? false;
  if (typeof allowPrivateNetworkValue !== "boolean") {
    throw new TypeError("options.allowPrivateNetwork must be a boolean");
  }

  return Object.freeze({
    client: bindClient(clientValue as CockroachBrowserClientLike),
    allowedOrigins,
    mode: modeValue,
    maxDurationMs,
    maxSnapshotChars,
    allowPrivateNetwork: allowPrivateNetworkValue
  });
}

function bindClient(input: CockroachBrowserClientLike): BoundCockroachBrowserClient {
  if ((typeof input !== "object" && typeof input !== "function") || input === null) {
    throw new TypeError("client must be an object");
  }
  return Object.freeze({
    health: readMethod(input, "health") as BoundCockroachBrowserClient["health"],
    capabilities: readMethod(
      input,
      "capabilities"
    ) as BoundCockroachBrowserClient["capabilities"],
    createSession: readMethod(
      input,
      "createSession"
    ) as BoundCockroachBrowserClient["createSession"],
    snapshot: readMethod(input, "snapshot") as BoundCockroachBrowserClient["snapshot"],
    closeSession: readMethod(
      input,
      "closeSession"
    ) as BoundCockroachBrowserClient["closeSession"]
  });
}

function readMethod(input: object, name: string): (...args: unknown[]) => Promise<unknown> {
  let current: object | null = input;
  while (current !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor) {
      if (!("value" in descriptor) || typeof descriptor.value !== "function") {
        throw new TypeError(`client.${name} must be a data method`);
      }
      return descriptor.value.bind(input) as (...args: unknown[]) => Promise<unknown>;
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  throw new TypeError(`client.${name} must be a function`);
}

function normalizeAllowedOrigins(value: unknown): readonly string[] {
  const entries = readDenseDataArray(value, "options.allowedOrigins");
  if (entries.length === 0 || entries.length > MAX_ALLOWED_ORIGINS) {
    throw new RangeError(
      `options.allowedOrigins must contain between 1 and ${MAX_ALLOWED_ORIGINS} origins`
    );
  }
  const origins: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const raw = requireNonEmptyString(entry, `options.allowedOrigins[${index}]`);
    const origin = parseHttpUrl(raw, `options.allowedOrigins[${index}]`).origin.toLowerCase();
    if (raw.toLowerCase() !== origin) {
      throw new TypeError(
        `options.allowedOrigins[${index}] must be an exact origin without a path, query, or trailing slash`
      );
    }
    if (seen.has(origin)) {
      throw new TypeError(`options.allowedOrigins contains duplicate origin "${origin}"`);
    }
    seen.add(origin);
    origins.push(origin);
  }
  return Object.freeze(origins);
}

function createSessionInput(
  options: NormalizedAdapterOptions,
  startUrl: string,
  input: browserResearch.BrowserResearchAdapterInput
): CockroachBrowserSessionCreateInput {
  const purpose = [
    "ProductLoop browser research",
    `${input.runId}/${input.step.id}`,
    input.step.purpose
  ].join(": ").slice(0, 500);
  return {
    mode: options.mode,
    startUrl,
    purpose,
    actor: "productloop-os",
    policy: {
      allowedOrigins: [...options.allowedOrigins],
      allowedActions: ["snapshot"],
      allowedEffects: ["read"],
      allowPrivateNetwork: options.allowPrivateNetwork,
      requireApprovalFor: [],
      budget: {
        maxActions: 4,
        maxDurationMs: options.maxDurationMs,
        maxTabs: 1,
        maxDownloadBytes: 1,
        maxUploadBytes: 1,
        maxSnapshotChars: options.maxSnapshotChars,
        maxEvidenceBytes: 8 * 1024 * 1024,
        maxHistoryEntries: 4,
        maxNetworkEntries: 1,
        maxClipboardBytes: 1,
        maxSavedStates: 1,
        maxNetworkRules: 1,
        maxRouteFulfillBytes: 1,
        maxInterceptedBytes: 1
      }
    }
  };
}

function normalizeSnapshot(
  value: unknown,
  expectedSessionId: string,
  allowedOrigins: readonly string[]
): BrowserSnapshot {
  const snapshot = browserResearch.toJsonObject(value);
  const sessionId = requireNonEmptyString(
    readJsonDataField(snapshot, "sessionId", "snapshot"),
    "snapshot.sessionId"
  );
  if (sessionId !== expectedSessionId) {
    throw new TypeError("snapshot.sessionId does not match the created session");
  }
  const url = requireNonEmptyString(
    readJsonDataField(snapshot, "url", "snapshot"),
    "snapshot.url"
  );
  assertAllowedUrl(url, allowedOrigins);
  const refs = readJsonDataField(snapshot, "refs", "snapshot");
  if (!Array.isArray(refs)) throw new TypeError("snapshot.refs must be an array");
  const challengeValue = readOptionalJsonDataField(snapshot, "challenge", "snapshot");

  return deepFreeze({
    sessionId,
    tabId: requireNonEmptyString(
      readJsonDataField(snapshot, "tabId", "snapshot"),
      "snapshot.tabId"
    ),
    url,
    title: requireString(readJsonDataField(snapshot, "title", "snapshot"), "snapshot.title"),
    capturedAt: requireIsoTimestamp(
      readJsonDataField(snapshot, "capturedAt", "snapshot"),
      "snapshot.capturedAt"
    ),
    text: requireString(readJsonDataField(snapshot, "text", "snapshot"), "snapshot.text"),
    digest: requireNonEmptyString(
      readJsonDataField(snapshot, "digest", "snapshot"),
      "snapshot.digest"
    ),
    truncated: requireBoolean(
      readJsonDataField(snapshot, "truncated", "snapshot"),
      "snapshot.truncated"
    ),
    refs,
    ...(challengeValue === undefined
      ? {}
      : { challenge: requireJsonObject(challengeValue, "snapshot.challenge") })
  });
}

function citationFromSnapshot(
  snapshot: BrowserSnapshot,
  locator = `semantic-snapshot:${snapshot.digest}`,
  quote = excerpt(snapshot.text, MAX_CITATION_CHARS)
): browserResearch.ResearchCitationInput {
  return {
    url: snapshot.url,
    title: snapshot.title,
    locator,
    ...(quote.length === 0 ? {} : { quote }),
    capturedAt: snapshot.capturedAt,
    metadata: {
      browser: "cockroach-browser",
      snapshotDigest: snapshot.digest
    }
  };
}

function claimsFromSnapshot(
  snapshot: BrowserSnapshot
): browserResearch.ExtractionClaim[] {
  const paragraphs = snapshot.text
    .split(/\n\s*\n/u)
    .map((value) => value.replace(/\s+/gu, " ").trim())
    .filter((value) => value.length > 0)
    .slice(0, MAX_CLAIMS);

  return paragraphs.map((paragraph, index) => {
    const text = excerpt(paragraph, MAX_CLAIM_CHARS);
    return {
      text,
      citation: citationFromSnapshot(
        snapshot,
        `semantic-snapshot:${snapshot.digest}#claim:${index + 1}`,
        excerpt(text, MAX_CITATION_CHARS)
      ),
      metadata: { source: "cockroach-browser-semantic-snapshot" }
    };
  });
}

function metadataFromSnapshot(snapshot: BrowserSnapshot): browserResearch.JsonObject {
  const challengeDetected = snapshot.challenge === undefined
    ? false
    : readOptionalJsonDataField(snapshot.challenge, "detected", "snapshot.challenge") === true;
  return {
    browser: "cockroach-browser",
    transport: "authenticated-http-client",
    sessionLifecycle: "short-lived",
    snapshotDigest: snapshot.digest,
    tabId: snapshot.tabId,
    refs: snapshot.refs.length,
    truncated: snapshot.truncated,
    challengeDetected
  };
}

function requireStepUrl(value: unknown): string {
  return requireNonEmptyString(value, "step.url");
}

function assertAllowedUrl(value: string, allowedOrigins: readonly string[]): URL {
  const url = parseHttpUrl(value, "step.url");
  const origin = url.origin.toLowerCase();
  if (!allowedOrigins.includes(origin)) {
    throw new TypeError(`Origin ${origin} is outside the ProductLoop browser allowlist`);
  }
  return url;
}

function parseHttpUrl(value: string, path: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${path} must be a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(`${path} must use HTTP or HTTPS`);
  }
  if (url.username || url.password) {
    throw new TypeError(`${path} cannot contain embedded credentials`);
  }
  return url;
}

function excerpt(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit);
}

function requirePlainRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must be a plain object`);
  }
  return value as Record<string, unknown>;
}

function requireOnlyFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string
): void {
  const fields = new Set(allowed);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !fields.has(key)) {
      throw new TypeError(`${path} contains unknown field "${String(key)}"`);
    }
  }
}

function readOwnDataField(
  value: Record<string, unknown>,
  field: string,
  path: string
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor) throw new TypeError(`${path} is missing required field "${field}"`);
  if (!("value" in descriptor)) {
    throw new TypeError(`${path}.${field} must be an own data value`);
  }
  return descriptor.value;
}

function readOptionalOwnDataField(
  value: Record<string, unknown>,
  field: string,
  path: string
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) {
    throw new TypeError(`${path}.${field} must be an own data value`);
  }
  return descriptor.value;
}

function readDenseDataArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !lengthDescriptor
    || !("value" in lengthDescriptor)
    || !Number.isSafeInteger(lengthDescriptor.value)
    || lengthDescriptor.value < 0
  ) {
    throw new TypeError(`${path} must have a safe data length`);
  }
  const length = lengthDescriptor.value as number;
  const entries: unknown[] = [];
  const allowedKeys = new Set<PropertyKey>(["length"]);
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new TypeError(`${path}[${index}] must be an own data value`);
    }
    entries.push(descriptor.value);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`${path} contains unknown field "${String(key)}"`);
    }
  }
  return entries;
}

function readJsonDataField(
  value: browserResearch.JsonObject,
  field: string,
  path: string
): browserResearch.JsonValue {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor || !("value" in descriptor)) {
    throw new TypeError(`${path} is missing data field "${field}"`);
  }
  return descriptor.value as browserResearch.JsonValue;
}

function readOptionalJsonDataField(
  value: browserResearch.JsonObject,
  field: string,
  path: string
): browserResearch.JsonValue | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) {
    throw new TypeError(`${path}.${field} must be a data value`);
  }
  return descriptor.value as browserResearch.JsonValue;
}

function requireJsonObject(value: unknown, path: string): browserResearch.JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return value as browserResearch.JsonObject;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new TypeError(`${path} must be a string`);
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${path} must be a non-empty, trimmed string`);
  }
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${path} must be a boolean`);
  return value;
}

function requireIsoTimestamp(value: unknown, path: string): string {
  const timestamp = requireNonEmptyString(value, path);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError(`${path} must be an ISO timestamp`);
  }
  return timestamp;
}

function requireNonNegativeSafeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer`);
  }
  return value as number;
}

function requireBoundedPositiveSafeInteger(
  value: unknown,
  path: string,
  maximum: number
): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > maximum) {
    throw new RangeError(`${path} must be a positive safe integer no greater than ${maximum}`);
  }
  return value as number;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) deepFreeze(descriptor.value);
  }
  return Object.freeze(value);
}
