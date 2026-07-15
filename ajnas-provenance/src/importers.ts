import type { TraceLedger } from "./ledger.js";
import type { ImportOptions, RuntimeEventLike, SkillAuditEventLike } from "./types.js";

export function importRuntimeEvent(
  ledger: TraceLedger,
  event: RuntimeEventLike,
  options: ImportOptions = {}
) {
  return ledger.record({
    actor: options.actor ?? "ajnas-runtime",
    action: `runtime.${event.type}`,
    subject: {
      type: "runtime-event",
      id: `${event.runId}:${event.sequence}`
    },
    source: {
      system: "ajnas-runtime",
      id: event.runId
    },
    data: {
      runtimeEventType: event.type,
      runtimeSequence: event.sequence,
      runtimeTimestamp: event.timestamp,
      payload: event.data
    },
    links: [
      {
        rel: "source-receipt",
        href: `ajnas-runtime:${event.runId}:${event.sequence}`,
        digest: `sha256:${event.receipt.eventHash}`
      }
    ]
  });
}

export function importSkillAuditEvent(
  ledger: TraceLedger,
  event: SkillAuditEventLike,
  options: ImportOptions = {}
) {
  return ledger.record({
    actor: options.actor ?? event.actor,
    action: `skills-registry.${event.type}`,
    subject: {
      type: "skill",
      id: `${event.skillId}@${event.version}`
    },
    source: {
      system: "ajnas-skills-registry",
      id: event.skillId
    },
    data: {
      skillAuditType: event.type,
      skillSequence: event.sequence,
      skillTimestamp: event.timestamp,
      digest: event.digest,
      payload: event.data
    },
    links: [
      {
        rel: "source-receipt",
        href: `ajnas-skills-registry:${event.skillId}@${event.version}:${event.sequence}`,
        digest: `sha256:${event.receipt.eventHash}`
      }
    ]
  });
}
