import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultRegistryMaqamVersion = "0.3.1";
const maqamPackageDirectory = process.env.MAQAM_PACKAGE_DIR
  ? resolve(process.env.MAQAM_PACKAGE_DIR)
  : undefined;
const localPackageNames = [
  "ajnas-runtime",
  "ajnas-skills-registry",
  "ajnas-provenance",
  "ajnas-policy",
  "ajnas-evals",
  "ajnas-connectors",
  "ajnas-approvals",
  "ajnas-browser-research",
  "productloop-os",
];
const expectedLocalVersions = new Map([
  ["ajnas-runtime", "0.2.2"],
  ["ajnas-skills-registry", "0.2.2"],
  ["ajnas-provenance", "0.1.4"],
  ["ajnas-policy", "0.1.3"],
  ["ajnas-evals", "0.1.3"],
  ["ajnas-connectors", "0.1.3"],
  ["ajnas-approvals", "0.1.3"],
  ["ajnas-browser-research", "0.1.4"],
  ["productloop-os", "0.2.2"],
]);
const packageNames = maqamPackageDirectory ? ["maqam", ...localPackageNames] : localPackageNames;

function parseRegistryMaqamVersion(argv) {
  let version = defaultRegistryMaqamVersion;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--maqam-version") throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("--maqam-version requires an exact stable version.");
    version = value;
    index += 1;
  }
  if (!isSupportedMaqamVersion(version)) {
    throw new Error(`Maqam ${version} is outside the supported ^0.2.4 || ^0.3.1 range.`);
  }
  return version;
}

function isSupportedMaqamVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  return major === 0 && (
    (minor === 2 && patch >= 4) ||
    (minor === 3 && patch >= 1)
  );
}

async function findNpmCli() {
  const executableDirectory = dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    join(executableDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    join(executableDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installation layout.
    }
  }

  return undefined;
}

async function run(command, args, cwd) {
  const environment = {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };
  delete environment.NODE_PATH;

  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: environment,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    return result.stdout;
  } catch (error) {
    if (error.stdout) {
      process.stdout.write(error.stdout);
    }
    if (error.stderr) {
      process.stderr.write(error.stderr);
    }
    throw error;
  }
}

async function runNpm(args, cwd) {
  const npmCli = await findNpmCli();
  if (npmCli) {
    return run(process.execPath, [npmCli, ...args], cwd);
  }

  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(npmExecutable, args, cwd);
}

function parsePackResults(output) {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`npm pack did not return valid JSON:\n${trimmed}`, { cause: error });
  }
}

function assertOutsideRepo(directory) {
  const pathFromRepo = relative(resolve(repoRoot), resolve(directory));
  const isInsideRepo =
    pathFromRepo === "" ||
    (!pathFromRepo.startsWith(`..${sep}`) && pathFromRepo !== ".." && !isAbsolute(pathFromRepo));
  if (isInsideRepo) {
    throw new Error(`Temporary consumer must be outside the repository: ${directory}`);
  }
}

async function main() {
  const registryMaqamVersion = parseRegistryMaqamVersion(process.argv.slice(2));
  if (maqamPackageDirectory && registryMaqamVersion !== defaultRegistryMaqamVersion) {
    throw new Error("--maqam-version cannot be combined with MAQAM_PACKAGE_DIR.");
  }
  const temporaryRoot = await mkdtemp(join(tmpdir(), "productloop-clean-consumer-"));
  assertOutsideRepo(temporaryRoot);

  try {
    const packDirectory = join(temporaryRoot, "packs");
    const consumerDirectory = join(temporaryRoot, "consumer");
    await Promise.all([mkdir(packDirectory), mkdir(consumerDirectory)]);

    const packageDirectories = packageNames.map((name) => name === "maqam" ? maqamPackageDirectory : join(repoRoot, name));
    const packOutput = await runNpm(
      ["pack", "--json", "--pack-destination", packDirectory, ...packageDirectories],
      repoRoot,
    );
    const packResults = parsePackResults(packOutput);

    if (!Array.isArray(packResults) || packResults.length !== packageNames.length) {
      const actualCount = Array.isArray(packResults) ? packResults.length : 0;
      throw new Error(`Expected ${packageNames.length} packed packages, received ${actualCount}`);
    }

    const packedByName = new Map(packResults.map((entry) => [entry.name, entry]));
    for (const [name, version] of expectedLocalVersions) {
      if (packedByName.get(name)?.version !== version) {
        throw new Error(`Expected ${name}@${version}; received ${String(packedByName.get(name)?.version)}`);
      }
    }
    const localMaqamVersion = packedByName.get("maqam")?.version;
    if (maqamPackageDirectory && (
      typeof localMaqamVersion !== "string" ||
      !isSupportedMaqamVersion(localMaqamVersion)
    )) {
      throw new Error(`MAQAM_PACKAGE_DIR must contain a stable version covered by ^0.2.4 || ^0.3.1; received ${String(localMaqamVersion)}`);
    }
    const expectedMaqamVersion = localMaqamVersion ?? registryMaqamVersion;
    const tarballs = packageNames.map((name) => {
      const entry = packedByName.get(name);
      if (!entry || typeof entry.filename !== "string") {
        throw new Error(`npm pack did not produce a tarball for ${name}`);
      }
      return join(packDirectory, basename(entry.filename));
    });

    const consumerManifestPath = join(consumerDirectory, "package.json");
    await writeFile(
      consumerManifestPath,
      `${JSON.stringify({ name: "productloop-clean-type-consumer", private: true, type: "module" }, null, 2)}\n`,
      "utf8",
    );

    await runNpm(
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        "--no-save",
        "--omit=dev",
        ...tarballs,
        ...(maqamPackageDirectory ? [] : [`maqam@${registryMaqamVersion}`]),
      ],
      consumerDirectory,
    );

    const consumerManifest = JSON.parse(await readFile(consumerManifestPath, "utf8"));
    for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      if (consumerManifest[section]?.["@types/node"]) {
        throw new Error("The clean consumer must not declare @types/node directly");
      }
    }

    await writeFile(
      join(consumerDirectory, "consumer.ts"),
      [
        'import type { KeyMaterial as RegistryKeyMaterial } from "ajnas-skills-registry";',
        'import type { KeyMaterial as ProvenanceKeyMaterial } from "ajnas-provenance";',
        'import type { PolicyToolDefinition } from "ajnas-runtime";',
        'import type { PolicyBundle } from "ajnas-policy";',
        'import type { EvalSuite } from "ajnas-evals";',
        'import type { ConnectorApprovalResolution } from "ajnas-connectors";',
        'import type { ApprovalReviewInput } from "ajnas-approvals";',
        'import type { SignResearchProvenanceOptions } from "ajnas-browser-research";',
        'import type { CrawlOptions } from "maqam";',
        'import { PRODUCTLOOP_OS_VERSION } from "productloop-os";',
        "",
        'export const registryKey: RegistryKeyMaterial = "registry-public-key";',
        'export const provenanceKey: ProvenanceKeyMaterial = "provenance-public-key";',
        'export const policyTool: PolicyToolDefinition = { name: "read", description: "read", risk: "low" };',
        'export const policyBundle: Pick<PolicyBundle, "defaultEffect"> = { defaultEffect: "deny" };',
        'export const evalSuite: Pick<EvalSuite, "schemaVersion"> = { schemaVersion: "ajnas.eval.suite.v1" };',
        'export const connectorResolution: ConnectorApprovalResolution = { approved: false, approverId: "owner" };',
        'export const approvalReview: ApprovalReviewInput = { reviewerId: "owner", decision: "reject" };',
        'export const crawlOptions: CrawlOptions = { seeds: ["https://example.com"] };',
        "export const browserSigningOptions: Pick<SignResearchProvenanceOptions, \"privateKey\"> = {",
        '  privateKey: "browser-private-key",',
        "};",
        'export const productLoopVersion: "0.2.2" = PRODUCTLOOP_OS_VERSION;',
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      join(consumerDirectory, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2022"],
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            exactOptionalPropertyTypes: true,
            noUncheckedIndexedAccess: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ["consumer.ts"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const typescriptCli = join(repoRoot, "node_modules", "typescript", "lib", "tsc.js");
    await access(typescriptCli);
    await run(process.execPath, [typescriptCli, "--project", "tsconfig.json", "--pretty", "false"], consumerDirectory);

    await writeFile(
      join(consumerDirectory, "consumer.mjs"),
      [
        'import { createRequire } from "node:module";',
        'import { dirname, join } from "node:path";',
        'import { fileURLToPath } from "node:url";',
        'import { createProductLoopOS, maqam } from "productloop-os";',
        "",
        'const productLoopEntry = fileURLToPath(import.meta.resolve("productloop-os"));',
        "const require = createRequire(productLoopEntry);",
        'const maqamEntry = require.resolve("maqam");',
        'const maqamPackage = require(join(dirname(maqamEntry), "..", "package.json"));',
        `if (maqamPackage.version !== ${JSON.stringify(expectedMaqamVersion)}) {`,
        `  throw new Error(\`Expected maqam@${expectedMaqamVersion}; received \${String(maqamPackage.version)}\`);`,
        "}",
        "const invocations = [];",
        "const adapter = maqam.defineToolAdapter({",
        '  name: "function.productloop.compatibility",',
        '  transport: "function",',
        '  description: "Exercise the offline ProductLoop compatibility contract.",',
        "  effects: [],",
        '  risk: "low",',
        "  async invoke(input) {",
        "    invocations.push(input.value);",
        "    return { slug: input.value.toLowerCase().replaceAll(\" \", \"-\") };",
        "  },",
        "});",
        "const os = createProductLoopOS({ maqamPolicy: { allowedTools: [adapter.name] } });",
        "maqam.registerToolAdapter(os.maqamGateway, adapter);",
        "const result = await os.maqamGateway.call(",
        "  adapter.name,",
        '  { value: "ProductLoop Maqam" },',
        '  { runId: "run_clean_consumer_compatibility" },',
        ");",
        'if (result.slug !== "productloop-maqam" || invocations.join(",") !== "ProductLoop Maqam") {',
        '  throw new Error("Maqam gateway compatibility fixture returned an unexpected result.");',
        "}",
        "const conformance = await maqam.runToolAdapterConformance(adapter, {",
        '  input: { value: "Offline Contract" },',
        '  verifyOutput: (output) => output.slug === "offline-contract",',
        "});",
        'if (!conformance.passed) throw new Error("Maqam adapter conformance failed.");',
        `console.log("Offline Maqam ${expectedMaqamVersion} runtime compatibility passed.");`,
        "",
      ].join("\n"),
      "utf8",
    );
    await run(process.execPath, ["consumer.mjs"], consumerDirectory);

    console.log(`Clean external TypeScript and runtime consumer passed for all nine workspace packages using maqam@${expectedMaqamVersion}.`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

await main();
