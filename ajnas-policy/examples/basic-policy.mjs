import { readFile } from "node:fs/promises";
import {
  PolicyDecisionLedger,
  computePolicyBundleDigest,
  createDeclarativePolicyEngine,
  validatePolicyBundle
} from "../dist/index.js";

const bundle = JSON.parse(await readFile(new URL("../fixtures/enterprise-release-policy.json", import.meta.url), "utf8"));
const request = JSON.parse(await readFile(new URL("../fixtures/publish-request.json", import.meta.url), "utf8"));
const ledger = new PolicyDecisionLedger({
  clock: () => new Date("2026-07-07T06:45:00.000Z")
});
const engine = createDeclarativePolicyEngine({ bundle, audit: ledger });
const validation = validatePolicyBundle(bundle);
const decision = await engine.evaluate(request);

console.log(
  JSON.stringify(
    {
      valid: validation.valid,
      digest: computePolicyBundleDigest(bundle),
      decision: decision.decision,
      reason: decision.reason,
      approvalPrompt: decision.decision === "require_approval" ? decision.approvalPrompt : null,
      auditValid: ledger.verify().valid,
      auditEvents: ledger.events.length
    },
    null,
    2
  )
);
