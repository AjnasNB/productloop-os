import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  SkillAuditLedger,
  SkillRegistry,
  createSkillInstallPolicy,
  signSkillManifest,
  validateSkillManifest
} from "../dist/index.js";

const manifestUrl = new URL("../fixtures/research-brief.skill.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const validation = validateSkillManifest(manifest);

if (!validation.valid) {
  console.error(validation.issues);
  process.exitCode = 1;
} else {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signed = signSkillManifest(manifest, {
    algorithm: "ed25519",
    keyId: "ajnas-example-key",
    privateKey,
    signedAt: "2026-07-05T02:00:00.000Z"
  });
  const audit = new SkillAuditLedger({
    clock: () => new Date("2026-07-05T02:00:00.000Z")
  });
  const registry = new SkillRegistry({
    audit,
    keyResolver: (keyId) => (keyId === "ajnas-example-key" ? publicKey : null),
    clock: () => new Date("2026-07-05T02:00:00.000Z")
  });

  const record = registry.register(signed, {
    actor: "example",
    source: "fixtures/research-brief.skill.json"
  });

  const policy = createSkillInstallPolicy({
    trustedPublishers: ["ajnas"]
  });
  const decision = await policy.evaluate({
    runId: "example-run",
    stepId: "install",
    tool: {
      name: "skills.install",
      description: "Install a reviewed skill",
      risk: "high",
      execute: () => ({ ok: true })
    },
    input: manifest,
    metadata: {
      purpose: "example"
    }
  });

  console.log(JSON.stringify({
    registered: `${record.manifest.id}@${record.manifest.version}`,
    digest: record.digest,
    policyDecision: decision.decision,
    auditEvents: audit.events.length,
    finalAuditHash: audit.events.at(-1)?.receipt.eventHash
  }, null, 2));
}
