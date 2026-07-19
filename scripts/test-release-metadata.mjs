import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const engineRequirement = "^22.0.0 || ^24.0.0 || ^26.0.0";
const selected = Object.freeze([
  Object.freeze({ name: "ajnas-runtime", directory: "ajnas-runtime", version: "0.2.2", peers: {} }),
  Object.freeze({ name: "ajnas-skills-registry", directory: "ajnas-skills-registry", version: "0.2.2", peers: { "ajnas-runtime": "^0.2.2" } }),
  Object.freeze({ name: "ajnas-provenance", directory: "ajnas-provenance", version: "0.1.4", peers: { "ajnas-runtime": "^0.2.2", "ajnas-skills-registry": "^0.2.2" } }),
  Object.freeze({ name: "ajnas-policy", directory: "ajnas-policy", version: "0.1.3", peers: { "ajnas-provenance": "^0.1.4", "ajnas-runtime": "^0.2.2" } }),
  Object.freeze({ name: "ajnas-evals", directory: "ajnas-evals", version: "0.1.3", peers: { "ajnas-policy": "^0.1.3", "ajnas-provenance": "^0.1.4", "ajnas-runtime": "^0.2.2" } }),
  Object.freeze({ name: "ajnas-connectors", directory: "ajnas-connectors", version: "0.1.3", peers: { "ajnas-policy": "^0.1.3", "ajnas-provenance": "^0.1.4", "ajnas-runtime": "^0.2.2" } }),
  Object.freeze({ name: "ajnas-approvals", directory: "ajnas-approvals", version: "0.1.3", peers: { "ajnas-connectors": "^0.1.3", "ajnas-policy": "^0.1.3", "ajnas-provenance": "^0.1.4", "ajnas-runtime": "^0.2.2" } }),
  Object.freeze({ name: "ajnas-browser-research", directory: "ajnas-browser-research", version: "0.1.4", peers: { "ajnas-approvals": "^0.1.3", "ajnas-connectors": "^0.1.3", "ajnas-policy": "^0.1.3", "ajnas-provenance": "^0.1.4", "ajnas-runtime": "^0.2.2" } }),
  Object.freeze({
    name: "productloop-os",
    directory: "productloop-os",
    version: "0.2.3",
    peers: {},
    dependencies: {
      maqam: "^0.2.4 || ^0.3.1",
      "ajnas-runtime": "^0.2.2",
      "ajnas-skills-registry": "^0.2.2",
      "ajnas-provenance": "^0.1.4",
      "ajnas-policy": "^0.1.3",
      "ajnas-evals": "^0.1.3",
      "ajnas-connectors": "^0.1.3",
      "ajnas-approvals": "^0.1.3",
      "ajnas-browser-research": "^0.1.4",
    },
  }),
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

function firstPartyEntries(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name.startsWith("ajnas-") || name === "maqam"));
}

const rootManifest = await readJson("package.json");
const lock = await readJson("package-lock.json");
const npmConfig = await readFile(join(repoRoot, ".npmrc"), "utf8");

assert.equal(rootManifest.private, true);
assert.equal(rootManifest.version, "0.2.3");
assert.equal(rootManifest.engines?.node, engineRequirement);
assert.deepEqual(rootManifest.allowScripts, { esbuild: true });
assert.match(npmConfig, /^strict-allow-scripts=true\r?\n?$/);
assert.deepEqual(rootManifest.workspaces, selected.map(({ directory }) => directory));
assert.equal(lock.packages?.[""]?.version, rootManifest.version);
assert.equal(lock.packages?.[""]?.engines?.node, engineRequirement);

for (const entry of selected) {
  const manifest = await readJson(`${entry.directory}/package.json`);
  const lockedWorkspace = lock.packages?.[entry.directory];

  assert.equal(manifest.name, entry.name, `${entry.directory} package name drifted`);
  assert.equal(manifest.version, entry.version, `${entry.name} selected version drifted`);
  assert.equal(manifest.engines?.node, engineRequirement, `${entry.name} engine requirement drifted`);
  assert.deepEqual(firstPartyEntries(manifest.peerDependencies), entry.peers, `${entry.name} peer floors drifted`);
  assert.deepEqual(firstPartyEntries(manifest.dependencies), entry.dependencies ?? {}, `${entry.name} dependency floors drifted`);

  assert.equal(lockedWorkspace?.version, entry.version, `${entry.name} lockfile version drifted`);
  assert.equal(lockedWorkspace?.engines?.node, engineRequirement, `${entry.name} lockfile engine requirement drifted`);
  assert.deepEqual(firstPartyEntries(lockedWorkspace?.peerDependencies), entry.peers, `${entry.name} lockfile peer floors drifted`);
  assert.deepEqual(firstPartyEntries(lockedWorkspace?.dependencies), entry.dependencies ?? {}, `${entry.name} lockfile dependency floors drifted`);
}

assert.equal(lock.packages?.["node_modules/maqam"]?.version, "0.3.1", "canonical lock must resolve maqam@0.3.1");
assert.match(lock.packages?.["node_modules/maqam"]?.resolved ?? "", /\/maqam-0\.3\.1\.tgz$/);
assert.match(lock.packages?.["node_modules/maqam"]?.integrity ?? "", /^sha512-/);

console.log("Release metadata is coordinated for Node 22/24/26, Maqam 0.3.1, and all nine selected package versions.");
