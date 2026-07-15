import { evaluatePolicyBundle } from "./evaluator.js";
import type { DeclarativePolicyEngineOptions, RuntimePolicyDecision, RuntimePolicyEngine, RuntimePolicyRequest } from "./types.js";

export class DeclarativePolicyEngine implements RuntimePolicyEngine {
  constructor(private readonly options: DeclarativePolicyEngineOptions) {}

  async evaluate(request: RuntimePolicyRequest): Promise<RuntimePolicyDecision> {
    const decision = evaluatePolicyBundle(this.options.bundle, request);
    this.options.audit?.record({
      bundle: this.options.bundle,
      request,
      decision
    });
    return decision;
  }
}

export function createDeclarativePolicyEngine(options: DeclarativePolicyEngineOptions): RuntimePolicyEngine {
  return new DeclarativePolicyEngine(options);
}
