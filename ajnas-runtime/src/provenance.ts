import { normalizeJson, sha256, stableStringify } from "./stable-json.js";
import type { JsonObject, JsonValue, ProvenanceReceipt, ProvenanceSink, RuntimeEvent } from "./types.js";

export interface InMemoryProvenanceSinkOptions {
  clock?: () => Date;
}

export class InMemoryProvenanceSink implements ProvenanceSink {
  private readonly recordedEvents: RuntimeEvent[] = [];
  readonly clock: () => Date;

  constructor(options: InMemoryProvenanceSinkOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  record(event: RuntimeEvent): void {
    this.recordedEvents.push(cloneEvent(event));
  }

  get events(): RuntimeEvent[] {
    return this.recordedEvents.map(cloneEvent);
  }
}

export function createReceipt(eventWithoutReceipt: Omit<RuntimeEvent, "receipt">, previousHash: string | null): ProvenanceReceipt {
  const canonicalJson = stableStringify({
    ...eventWithoutReceipt,
    receipt: {
      previousHash
    }
  });
  return {
    eventHash: sha256(canonicalJson),
    previousHash,
    canonicalJson
  };
}

export function toJsonObject(value: unknown): JsonObject {
  const normalized = normalizeJson(value);
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
    return { value: normalized };
  }
  return normalized;
}

function cloneEvent(event: RuntimeEvent): RuntimeEvent {
  return normalizeJson(event) as unknown as RuntimeEvent;
}
