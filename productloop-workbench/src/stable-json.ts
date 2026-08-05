import { createHash } from "node:crypto";
import type { JsonValue } from "./types.js";

const MAX_JSON_BYTES = 64 * 1024;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 10_000;

export function normalizeJson(value: unknown): JsonValue {
  const state: NormalizeState = { seen: new WeakSet(), nodes: 0, textBytes: 0 };
  const normalized = normalizeValue(value, state, 0);
  if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > MAX_JSON_BYTES) {
    throw new TypeError(`Canonical JSON exceeds ${MAX_JSON_BYTES} bytes.`);
  }
  return normalized;
}

function normalizeValue(value: unknown, state: NormalizeState, depth: number): JsonValue {
  if (depth > MAX_JSON_DEPTH) throw new TypeError(`JSON exceeds ${MAX_JSON_DEPTH} levels.`);
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES) throw new TypeError(`JSON exceeds ${MAX_JSON_NODES} values.`);

  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    addTextBytes(state, value);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JSON numbers must be finite.");
    if (Object.is(value, -0)) throw new TypeError("JSON numbers must not use ambiguous negative zero.");
    return value;
  }
  if (typeof value === "object") {
    if (state.seen.has(value)) throw new TypeError("JSON must not contain cycles or repeated object references.");
    state.seen.add(value);
    if (Array.isArray(value)) return normalizeArray(value, state, depth);

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("JSON objects must use Object.prototype or a null prototype.");
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) throw new TypeError("JSON objects must not contain symbol keys.");
    const stringKeys = (keys as string[]).sort();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const output: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    for (const key of stringKeys) {
      addTextBytes(state, key);
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) throw new TypeError(`JSON property ${key} must be a data property.`);
      if (descriptor.value === undefined) throw new TypeError(`JSON property ${key} must not be undefined.`);
      Object.defineProperty(output, key, {
        value: normalizeValue(descriptor.value, state, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    return output;
  }
  throw new TypeError(`Unsupported JSON value: ${typeof value}`);
}

function normalizeArray(value: unknown[], state: NormalizeState, depth: number): JsonValue[] {
  if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError("JSON arrays must use Array.prototype.");
  if (value.length > MAX_JSON_NODES) throw new TypeError(`JSON arrays must not exceed ${MAX_JSON_NODES} entries.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const allowedKeys = new Set<string>(["length"]);
  const output: JsonValue[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor)) throw new TypeError("JSON arrays must be dense data arrays.");
    if (descriptor.value === undefined) throw new TypeError(`JSON array entry ${key} must not be undefined.`);
    output.push(normalizeValue(descriptor.value, state, depth + 1));
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol" || !allowedKeys.has(key)) throw new TypeError("JSON arrays must not contain custom properties.");
  }
  return output;
}

function addTextBytes(state: NormalizeState, value: string): void {
  state.textBytes += Buffer.byteLength(value, "utf8");
  if (state.textBytes > MAX_JSON_BYTES) throw new TypeError(`JSON text exceeds ${MAX_JSON_BYTES} bytes.`);
}

interface NormalizeState {
  seen: WeakSet<object>;
  nodes: number;
  textBytes: number;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function digestJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
