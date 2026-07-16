import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { JsonObject, JsonValue } from "./types.js";

const MAX_DEPTH = 64;
const MAX_NODES = 100_000;
const MAX_UTF8_BYTES = 8 * 1024 * 1024;
const DEFAULT_REDACTION_KEYS = new Set([
  "apikey", "authorization", "cookie", "credential", "password", "privatekey", "secret", "session", "token"
]);

interface NormalizeState { readonly seen: WeakSet<object>; nodes: number; bytes: number; }

export function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(normalize(value, state(), 0));
  if (Buffer.byteLength(serialized, "utf8") > MAX_UTF8_BYTES) throw new RangeError("Canonical JSON exceeds the 8 MiB limit");
  return serialized;
}

export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export function sanitizeJson(value: unknown, redactionKeys: string[] = []): JsonValue {
  const keys = new Set(DEFAULT_REDACTION_KEYS);
  for (const key of redactionKeys) keys.add(normalizeKey(key));
  return normalize(value, state(), 0, keys);
}

export function sanitizeJsonObject(value: unknown, redactionKeys: string[] = []): JsonObject {
  const sanitized = sanitizeJson(value, redactionKeys);
  if (sanitized !== null && typeof sanitized === "object" && !Array.isArray(sanitized)) return sanitized;
  const output = Object.create(null) as JsonObject;
  Object.defineProperty(output, "value", { value: sanitized, enumerable: true, configurable: true, writable: true });
  return output;
}

function state(): NormalizeState { return { seen: new WeakSet(), nodes: 0, bytes: 0 }; }

function normalize(value: unknown, current: NormalizeState, depth: number, redactionKeys?: Set<string>): JsonValue {
  if (depth > MAX_DEPTH) throw new RangeError("JSON value exceeds the maximum depth of 64");
  if (++current.nodes > MAX_NODES) throw new RangeError("JSON value exceeds the 100000-node limit");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") { accountBytes(current, value); return value; }
  if (typeof value === "number") { if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("JSON numbers must be finite and must not be negative zero"); return value; }
  if (typeof value !== "object") throw new TypeError(`Cannot serialize non-JSON value of type ${typeof value}`);
  if (current.seen.has(value)) throw new TypeError("Cannot serialize cyclic or repeated object references");
  current.seen.add(value);
  if (Array.isArray(value)) { assertDenseDataArray(value); return value.map((item) => normalize(item, current, depth + 1, redactionKeys)); }
  assertPlainObject(value);
  const output = Object.create(null) as JsonObject;
  for (const key of Reflect.ownKeys(value).sort(comparePropertyKeys)) {
    if (typeof key !== "string") throw new TypeError("JSON objects must not contain symbol properties");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!isEnumerableDataDescriptor(descriptor)) throw new TypeError("JSON objects must contain only enumerable data properties");
    accountBytes(current, key);
    const child = redactionKeys && shouldRedact(key, redactionKeys)
      ? "[redacted]"
      : normalize(descriptor.value, current, depth + 1, redactionKeys);
    Object.defineProperty(output, key, { value: child, enumerable: true, configurable: true, writable: true });
  }
  return output;
}

function shouldRedact(key: string, redactionKeys: Set<string>): boolean {
  const normalized = normalizeKey(key);
  if (redactionKeys.has(normalized)) return true;
  return /(?:apikey|authorization|cookie|credential|password|privatekey|secret|session|token)/u.test(normalized);
}
function normalizeKey(key: string): string { return key.toLowerCase().replace(/[^a-z0-9]/gu, ""); }
function assertPlainObject(value: object): void { const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Only plain objects are valid JSON objects"); }
function assertDenseDataArray(value: unknown[]): void { const keys = Reflect.ownKeys(value); if (keys.length !== value.length + 1 || !keys.includes("length")) throw new TypeError("JSON arrays must be dense and must not contain extra properties"); for (let index = 0; index < value.length; index += 1) { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!isEnumerableDataDescriptor(descriptor)) throw new TypeError("JSON arrays must contain only enumerable data elements"); } }
function isEnumerableDataDescriptor(descriptor: PropertyDescriptor | undefined): descriptor is PropertyDescriptor & { enumerable: true; value: unknown } { return descriptor !== undefined && Object.hasOwn(descriptor, "enumerable") && descriptor.enumerable === true && Object.hasOwn(descriptor, "value"); }
function accountBytes(current: NormalizeState, value: string): void { current.bytes += Buffer.byteLength(value, "utf8"); if (current.bytes > MAX_UTF8_BYTES) throw new RangeError("JSON string and key data exceeds the 8 MiB limit"); }
function comparePropertyKeys(left: PropertyKey, right: PropertyKey): number { if (typeof left === "symbol") return 1; if (typeof right === "symbol") return -1; return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0; }
