import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { JsonObject, JsonValue } from "./types.js";

const MAX_DEPTH = 64;
const MAX_NODES = 100_000;
const MAX_UTF8_BYTES = 8 * 1024 * 1024;

interface NormalizeState {
  readonly seen: WeakSet<object>;
  nodes: number;
  bytes: number;
}

export function stableJson(value: unknown): string {
  const serialized = JSON.stringify(normalizeJson(value));
  if (Buffer.byteLength(serialized, "utf8") > MAX_UTF8_BYTES) {
    throw new RangeError("Canonical JSON exceeds the 8 MiB limit");
  }
  return serialized;
}

export function sha256Digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function toJsonValue(value: unknown): JsonValue {
  return normalizeJson(value);
}

export function toJsonObject(value: unknown): JsonObject {
  const normalized = normalizeJson(value);
  if (normalized !== null && typeof normalized === "object" && !Array.isArray(normalized)) {
    return normalized;
  }
  return createObject([["value", normalized]]);
}

export function normalizeJson(value: unknown): JsonValue {
  return normalize(value, { seen: new WeakSet(), nodes: 0, bytes: 0 }, 0);
}

function normalize(value: unknown, state: NormalizeState, depth: number): JsonValue {
  if (depth > MAX_DEPTH) throw new RangeError("JSON value exceeds the maximum depth of 64");
  state.nodes += 1;
  if (state.nodes > MAX_NODES) throw new RangeError("JSON value exceeds the 100000-node limit");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") { accountBytes(state, value); return value; }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("JSON numbers must be finite and must not be negative zero");
    return value;
  }
  if (typeof value !== "object") throw new TypeError(`Cannot serialize non-JSON value of type ${typeof value}`);
  if (state.seen.has(value)) throw new TypeError("Cannot serialize cyclic or repeated object references");
  state.seen.add(value);
  if (Array.isArray(value)) {
    assertDenseDataArray(value);
    return value.map((item) => normalize(item, state, depth + 1));
  }
  assertPlainObject(value);
  const entries: Array<[string, JsonValue]> = [];
  for (const key of Reflect.ownKeys(value).sort(comparePropertyKeys)) {
    if (typeof key !== "string") throw new TypeError("JSON objects must not contain symbol properties");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("JSON objects must contain only enumerable data properties");
    accountBytes(state, key);
    entries.push([key, normalize(descriptor.value, state, depth + 1)]);
  }
  return createObject(entries);
}

function assertPlainObject(value: object): void {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Only plain objects are valid JSON objects");
}

function assertDenseDataArray(value: unknown[]): void {
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes("length")) throw new TypeError("JSON arrays must be dense and must not contain extra properties");
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("JSON arrays must contain only enumerable data elements");
  }
}

function createObject(entries: Array<[string, JsonValue]>): JsonObject {
  const output = Object.create(null) as JsonObject;
  for (const [key, value] of entries) Object.defineProperty(output, key, { value, enumerable: true, configurable: true, writable: true });
  return output;
}

function accountBytes(state: NormalizeState, value: string): void {
  state.bytes += Buffer.byteLength(value, "utf8");
  if (state.bytes > MAX_UTF8_BYTES) throw new RangeError("JSON string and key data exceeds the 8 MiB limit");
}

function comparePropertyKeys(left: PropertyKey, right: PropertyKey): number {
  if (typeof left === "symbol") return 1;
  if (typeof right === "symbol") return -1;
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}
