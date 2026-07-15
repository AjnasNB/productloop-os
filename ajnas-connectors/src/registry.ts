import { HashChainedConnectorAuditLedger } from "./audit.js";
import { createConnectorPolicyRequest, evaluateConnectorTrust } from "./policy.js";
import { computeConnectorDigest, validateConnectorManifest } from "./validation.js";
import { normalizeJson } from "./stable-json.js";
import type {
  ConnectorAuditLedger,
  ConnectorInvocationRequest,
  ConnectorManifest,
  ConnectorRegisterOptions,
  ConnectorRegistryOptions,
  ConnectorRegistryQuery,
  ConnectorTrustEvaluation,
  ConnectorTrustEvaluationOptions,
  RuntimePolicyRequest
} from "./types.js";

export class ConnectorRegistry {
  private readonly connectors = new Map<string, ConnectorManifest>();
  private readonly audit?: ConnectorAuditLedger;

  constructor(options: ConnectorRegistryOptions = {}) {
    this.audit = options.audit;
  }

  static withAudit(clock?: () => Date): { registry: ConnectorRegistry; audit: ConnectorAuditLedger } {
    const audit = new HashChainedConnectorAuditLedger({ clock });
    return { registry: new ConnectorRegistry({ audit }), audit };
  }

  register(manifest: ConnectorManifest, options: ConnectorRegisterOptions = {}): ConnectorManifest {
    const validation = validateConnectorManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Connector manifest ${manifest.id ?? "<unknown>"} is invalid: ${validation.issues.map((issue) => issue.code).join(", ")}`);
    }
    if (this.connectors.has(manifest.id)) {
      throw new Error(`Connector ${manifest.id} is already registered.`);
    }
    const stored = cloneManifest(manifest);
    this.connectors.set(stored.id, stored);
    this.audit?.record({
      eventType: "connector.registered",
      connectorId: manifest.id,
      connectorVersion: manifest.version,
      actorId: options.actorId ?? "system",
      manifest: cloneManifest(stored),
      reason: "Connector manifest registered.",
      metadata: {
        digest: computeConnectorDigest(stored)
      }
    });
    return cloneManifest(stored);
  }

  get(id: string): ConnectorManifest | undefined {
    const manifest = this.connectors.get(id);
    return manifest ? cloneManifest(manifest) : undefined;
  }

  require(id: string): ConnectorManifest {
    const manifest = this.get(id);
    if (!manifest) {
      throw new Error(`Connector ${id} was not found.`);
    }
    return manifest;
  }

  list(query: ConnectorRegistryQuery = {}): ConnectorManifest[] {
    const { kind, operation, capabilityId, destination, dataClass } = query;
    return [...this.connectors.values()]
      .filter((manifest) => {
        if (kind && manifest.kind !== kind) {
          return false;
        }
        if (capabilityId && !manifest.capabilities.some((capability) => capability.id === capabilityId)) {
          return false;
        }
        if (operation && !manifest.capabilities.some((capability) => capability.operations.includes(operation))) {
          return false;
        }
        if (destination && !manifest.capabilities.some((capability) => capability.destinations.includes(destination))) {
          return false;
        }
        if (dataClass && !manifest.capabilities.some((capability) => capability.dataClasses.includes(dataClass))) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneManifest);
  }

  createPolicyRequest(invocation: ConnectorInvocationRequest): RuntimePolicyRequest {
    const manifest = this.require(invocation.connectorId);
    const policyRequest = createConnectorPolicyRequest(manifest, invocation);
    this.audit?.record({
      eventType: "connector.invocation_requested",
      connectorId: manifest.id,
      connectorVersion: manifest.version,
      actorId: invocation.requestedBy ?? "system",
      manifest,
      request: invocation,
      reason: `Connector invocation requested for ${invocation.capabilityId}.`,
      metadata: {
        toolName: policyRequest.tool.name
      }
    });
    return normalizeJson(policyRequest) as unknown as RuntimePolicyRequest;
  }

  evaluateTrust(connectorId: string, options: ConnectorTrustEvaluationOptions = {}): ConnectorTrustEvaluation {
    const manifest = this.require(connectorId);
    const evaluation = evaluateConnectorTrust(manifest, options);
    this.audit?.record({
      eventType: "connector.trust_evaluated",
      connectorId: manifest.id,
      connectorVersion: manifest.version,
      actorId: options.request?.requestedBy ?? "system",
      manifest,
      request: options.request,
      decision: evaluation.decision,
      reason: evaluation.reasons.join(" "),
      metadata: {
        operation: evaluation.operation ?? null,
        capabilityId: evaluation.capabilityId ?? null,
        risk: evaluation.risk
      }
    });
    return normalizeJson(evaluation) as unknown as ConnectorTrustEvaluation;
  }
}

function cloneManifest(manifest: ConnectorManifest): ConnectorManifest {
  return normalizeJson(manifest) as unknown as ConnectorManifest;
}
