export const COCKROACH_BROWSER_CAPABILITY_SNAPSHOT_SCHEMA =
  "cockroach.productloop-capability-snapshot.v1" as const;

export interface CockroachBrowserCapabilitySnapshot {
  schemaVersion: typeof COCKROACH_BROWSER_CAPABILITY_SNAPSHOT_SCHEMA;
  id: "cockroach-browser";
  displayName: "Cockroach Browser";
  description: string;
  kind: "browser-capability-snapshot";
  scope: "structural-only";
  transports: readonly ["sdk", "http", "mcp"];
  authority: {
    readonly lifecycle: "host";
    readonly governance: "maqam-when-routed";
    readonly rawRuntime: "host-policy";
  };
  capabilities: readonly string[];
}

const SNAPSHOT_FIELDS = Object.freeze([
  "schemaVersion",
  "id",
  "displayName",
  "description",
  "kind",
  "scope",
  "transports",
  "authority",
  "capabilities"
] as const);

const AUTHORITY_FIELDS = Object.freeze([
  "lifecycle",
  "governance",
  "rawRuntime"
] as const);

/**
 * Validate and detach Cockroach Browser's published ProductLoop snapshot.
 *
 * This function consumes structural metadata only. It does not import the
 * Cockroach Browser runtime, register a tool, grant a permission, or create
 * an execution path.
 */
export function adaptCockroachBrowserCapabilitySnapshot(
  input: unknown
): CockroachBrowserCapabilitySnapshot {
  const snapshot = requireRecord(input, "snapshot");
  requireExactFields(snapshot, SNAPSHOT_FIELDS, "snapshot");

  requireLiteral(
    readOwnDataField(snapshot, "schemaVersion", "snapshot"),
    COCKROACH_BROWSER_CAPABILITY_SNAPSHOT_SCHEMA,
    "snapshot.schemaVersion"
  );
  requireLiteral(
    readOwnDataField(snapshot, "id", "snapshot"),
    "cockroach-browser",
    "snapshot.id"
  );
  requireLiteral(
    readOwnDataField(snapshot, "displayName", "snapshot"),
    "Cockroach Browser",
    "snapshot.displayName"
  );
  const description = requireNonEmptyString(
    readOwnDataField(snapshot, "description", "snapshot"),
    "snapshot.description"
  );
  requireLiteral(
    readOwnDataField(snapshot, "kind", "snapshot"),
    "browser-capability-snapshot",
    "snapshot.kind"
  );
  requireLiteral(
    readOwnDataField(snapshot, "scope", "snapshot"),
    "structural-only",
    "snapshot.scope"
  );

  const transports = readDenseDataArray(
    readOwnDataField(snapshot, "transports", "snapshot"),
    "snapshot.transports"
  );
  if (
    transports.length !== 3 ||
    transports[0] !== "sdk" ||
    transports[1] !== "http" ||
    transports[2] !== "mcp"
  ) {
    throw new TypeError(
      'snapshot.transports must be the exact tuple ["sdk", "http", "mcp"]'
    );
  }

  const authority = requireRecord(
    readOwnDataField(snapshot, "authority", "snapshot"),
    "snapshot.authority"
  );
  requireExactFields(authority, AUTHORITY_FIELDS, "snapshot.authority");
  requireLiteral(
    readOwnDataField(authority, "lifecycle", "snapshot.authority"),
    "host",
    "snapshot.authority.lifecycle"
  );
  requireLiteral(
    readOwnDataField(authority, "governance", "snapshot.authority"),
    "maqam-when-routed",
    "snapshot.authority.governance"
  );
  requireLiteral(
    readOwnDataField(authority, "rawRuntime", "snapshot.authority"),
    "host-policy",
    "snapshot.authority.rawRuntime"
  );

  const capabilityValues = readDenseDataArray(
    readOwnDataField(snapshot, "capabilities", "snapshot"),
    "snapshot.capabilities"
  );
  const capabilities: string[] = [];
  const seenCapabilities = new Set<string>();
  for (const [index, value] of capabilityValues.entries()) {
    const capability = requireNonEmptyString(
      value,
      `snapshot.capabilities[${index}]`
    );
    if (seenCapabilities.has(capability)) {
      throw new TypeError(`snapshot.capabilities contains duplicate "${capability}"`);
    }
    seenCapabilities.add(capability);
    capabilities.push(capability);
  }

  return Object.freeze({
    schemaVersion: COCKROACH_BROWSER_CAPABILITY_SNAPSHOT_SCHEMA,
    id: "cockroach-browser",
    displayName: "Cockroach Browser",
    description,
    kind: "browser-capability-snapshot",
    scope: "structural-only",
    transports: Object.freeze(["sdk", "http", "mcp"]) as readonly [
      "sdk",
      "http",
      "mcp"
    ],
    authority: Object.freeze({
      lifecycle: "host",
      governance: "maqam-when-routed",
      rawRuntime: "host-policy"
    }),
    capabilities: Object.freeze(capabilities)
  });
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must be a plain object`);
  }
  return value as Record<string, unknown>;
}

function readDenseDataArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !lengthDescriptor ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new TypeError(`${path} must have a safe data length`);
  }
  const length = lengthDescriptor.value;
  const allowedKeys = new Set<PropertyKey>(["length"]);
  const entries: unknown[] = [];
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

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${path} must be a non-empty, trimmed string`);
  }
  return value;
}

function requireLiteral<T extends string>(
  value: unknown,
  expected: T,
  path: string
): asserts value is T {
  if (value !== expected) {
    throw new TypeError(`${path} must equal "${expected}"`);
  }
}

function requireExactFields(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string
): void {
  const expectedFields = new Set(expected);
  for (const field of Reflect.ownKeys(value)) {
    if (typeof field !== "string" || !expectedFields.has(field)) {
      throw new TypeError(`${path} contains unknown field "${String(field)}"`);
    }
  }
  for (const field of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor) {
      throw new TypeError(`${path} is missing required field "${field}"`);
    }
    if (!("value" in descriptor)) {
      throw new TypeError(`${path}.${field} must be an own data value`);
    }
  }
}

function readOwnDataField(
  value: Record<string, unknown>,
  field: string,
  path: string
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (!descriptor) {
    throw new TypeError(`${path} is missing required field "${field}"`);
  }
  if (!("value" in descriptor)) {
    throw new TypeError(`${path}.${field} must be an own data value`);
  }
  return descriptor.value;
}
