import type {
  JsonObject,
  ProvenanceExportPolicyOptions,
  RuntimePolicyDecision,
  RuntimePolicyEngine,
  RuntimePolicyRequest
} from "./types.js";

export function createProvenanceExportPolicy(options: ProvenanceExportPolicyOptions = {}): RuntimePolicyEngine {
  const toolName = options.toolName ?? "provenance.export";
  const blockedDestinations = new Set(options.blockedDestinations ?? []);
  const approvalDestinations = new Set(options.approvalDestinations ?? []);
  const sensitiveDataClasses = new Set(options.sensitiveDataClasses ?? []);

  return {
    evaluate(request: RuntimePolicyRequest): RuntimePolicyDecision {
      if (request.tool.name !== toolName) {
        return {
          decision: "allow",
          reason: "Policy does not apply to this tool"
        };
      }

      const input = normalizeExportInput(request.input);
      if (blockedDestinations.has(input.destination)) {
        return {
          decision: "deny",
          reason: `Provenance export destination ${input.destination} is blocked`,
          metadata: {
            destination: input.destination,
            dataClasses: input.dataClasses
          }
        };
      }

      const sensitiveMatches = input.dataClasses.filter((dataClass) => sensitiveDataClasses.has(dataClass));
      if (approvalDestinations.has(input.destination) && sensitiveMatches.length > 0) {
        return {
          decision: "require_approval",
          reason: `Provenance export to ${input.destination} includes sensitive data classes: ${sensitiveMatches.join(", ")}`,
          approvalPrompt: `Review provenance export to ${input.destination}. Sensitive classes: ${sensitiveMatches.join(", ")}.`,
          metadata: {
            destination: input.destination,
            sensitiveDataClasses: sensitiveMatches
          }
        };
      }

      return {
        decision: "allow",
        reason: "Provenance export is allowed",
        metadata: {
          destination: input.destination,
          dataClasses: input.dataClasses
        }
      };
    }
  };
}

function normalizeExportInput(input: unknown): { destination: string; dataClasses: string[] } {
  if (input === null || typeof input !== "object") {
    return {
      destination: "unknown",
      dataClasses: []
    };
  }
  const record = input as Record<string, unknown>;
  return {
    destination: typeof record.destination === "string" ? record.destination : "unknown",
    dataClasses: Array.isArray(record.dataClasses)
      ? record.dataClasses.filter((value): value is string => typeof value === "string")
      : []
  };
}
