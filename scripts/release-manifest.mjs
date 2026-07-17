import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const integrityPattern = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

const releasePackages = Object.freeze([
  Object.freeze({ name: "ajnas-runtime", directory: "ajnas-runtime" }),
  Object.freeze({ name: "ajnas-skills-registry", directory: "ajnas-skills-registry" }),
  Object.freeze({ name: "ajnas-provenance", directory: "ajnas-provenance" }),
  Object.freeze({ name: "ajnas-policy", directory: "ajnas-policy" }),
  Object.freeze({ name: "ajnas-evals", directory: "ajnas-evals" }),
  Object.freeze({ name: "ajnas-connectors", directory: "ajnas-connectors" }),
  Object.freeze({ name: "ajnas-approvals", directory: "ajnas-approvals" }),
  Object.freeze({ name: "ajnas-browser-research", directory: "ajnas-browser-research" }),
  Object.freeze({ name: "productloop-os", directory: "productloop-os" })
]);

function parseArguments(argv) {
  const options = {
    compact: false,
    outputDirectory: undefined,
    verifyDirectory: undefined,
    verifyEnvironment: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--compact") {
      options.compact = true;
      continue;
    }
    if (argument === "--verify-env") {
      options.verifyEnvironment = true;
      continue;
    }
    if (argument === "--output" || argument === "--verify-directory") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a directory path.`);
      if (argument === "--output") options.outputDirectory = resolve(value);
      else options.verifyDirectory = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.outputDirectory && options.verifyDirectory) {
    throw new Error("--output and --verify-directory are mutually exclusive.");
  }
  if (options.verifyDirectory && !options.verifyEnvironment) {
    throw new Error("--verify-directory requires --verify-env.");
  }
  return options;
}

function canonicalManifest(manifest) {
  return Object.fromEntries(releasePackages.map(({ name }) => [name, manifest[name]]));
}

function normalizeExpectedManifest(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("RELEASE_MANIFEST must be valid JSON.", { cause: error });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("RELEASE_MANIFEST must be an object keyed by package name.");
  }

  const expectedNames = releasePackages.map(({ name }) => name);
  const actualNames = Object.keys(parsed);
  const missing = expectedNames.filter((name) => !Object.hasOwn(parsed, name));
  const extra = actualNames.filter((name) => !expectedNames.includes(name));
  if (missing.length || extra.length) {
    throw new Error(`RELEASE_MANIFEST package set mismatch; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}.`);
  }

  const normalized = Object.create(null);
  for (const name of expectedNames) {
    const entry = parsed[name];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`RELEASE_MANIFEST entry for ${name} must be an object.`);
    }
    const keys = Object.keys(entry).sort();
    const expectedKeys = ["integrity", "sha256", "version"];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`RELEASE_MANIFEST entry for ${name} must contain only version, sha256, and integrity.`);
    }
    if (typeof entry.version !== "string" || !versionPattern.test(entry.version)) {
      throw new Error(`Invalid version for ${name}.`);
    }
    if (typeof entry.sha256 !== "string" || !sha256Pattern.test(entry.sha256)) {
      throw new Error(`Invalid SHA-256 for ${name}.`);
    }
    if (typeof entry.integrity !== "string" || !integrityPattern.test(entry.integrity)) {
      throw new Error(`Invalid integrity for ${name}.`);
    }
    normalized[name] = Object.freeze({
      version: entry.version,
      sha256: entry.sha256,
      integrity: entry.integrity
    });
  }
  return canonicalManifest(normalized);
}

async function findNpmCli() {
  const executableDirectory = dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    join(executableDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    join(executableDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported npm installation layout.
    }
  }
  return undefined;
}

async function runNpm(args) {
  const environment = {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
  const npmCli = await findNpmCli();
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = await execFileAsync(command, commandArgs, {
    cwd: repoRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true
  });
  if (result.stderr) process.stderr.write(result.stderr);
  return result.stdout;
}

async function readPackageVersions() {
  const versions = Object.create(null);
  for (const { name, directory } of releasePackages) {
    const manifestPath = join(repoRoot, directory, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.name !== name) throw new Error(`${directory}/package.json declares unexpected name ${String(manifest.name)}.`);
    if (typeof manifest.version !== "string" || !versionPattern.test(manifest.version)) {
      throw new Error(`${name} has invalid version ${String(manifest.version)}.`);
    }
    await access(join(repoRoot, directory, "dist", "index.js"));
    await access(join(repoRoot, directory, "dist", "index.d.ts"));
    versions[name] = manifest.version;
  }
  return versions;
}

function artifactEntry(buffer, version) {
  return Object.freeze({
    version,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(buffer).digest("base64")}`
  });
}

async function manifestFromDirectory(directory, versions) {
  const expectedFiles = releasePackages.map(({ name }) => `${name}-${versions[name]}.tgz`);
  const actualFiles = (await readdir(directory)).filter((name) => name.endsWith(".tgz")).sort();
  const expectedSorted = [...expectedFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedSorted)) {
    throw new Error(`Tarball set mismatch in ${directory}; expected=${expectedSorted.join(",")}; actual=${actualFiles.join(",")}.`);
  }
  const manifest = Object.create(null);
  for (const { name } of releasePackages) {
    const version = versions[name];
    const buffer = await readFile(join(directory, `${name}-${version}.tgz`));
    manifest[name] = artifactEntry(buffer, version);
  }
  return canonicalManifest(manifest);
}

async function packRelease(directory) {
  const existing = (await readdir(directory)).filter((name) => name.endsWith(".tgz"));
  if (existing.length) throw new Error(`Refusing to mix release artifacts with existing tarballs in ${directory}.`);
  const versions = await readPackageVersions();
  const packageDirectories = releasePackages.map(({ directory: packageDirectory }) => join(repoRoot, packageDirectory));
  const output = await runNpm([
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    directory,
    ...packageDirectories
  ]);
  let results;
  try {
    results = JSON.parse(output.trim());
  } catch (error) {
    throw new Error("npm pack did not return valid JSON.", { cause: error });
  }
  if (!Array.isArray(results) || results.length !== releasePackages.length) {
    throw new Error(`Expected ${releasePackages.length} npm pack results; received ${Array.isArray(results) ? results.length : 0}.`);
  }
  for (const result of results) {
    if (!releasePackages.some(({ name }) => name === result.name)) {
      throw new Error(`npm pack returned unexpected package ${String(result.name)}.`);
    }
    const expectedVersion = versions[result.name];
    if (result.version !== expectedVersion || basename(result.filename) !== `${result.name}-${expectedVersion}.tgz`) {
      throw new Error(`npm pack identity mismatch for ${String(result.name)}.`);
    }
  }
  return manifestFromDirectory(directory, versions);
}

function assertMatchesExpected(actual, expected) {
  for (const { name } of releasePackages) {
    for (const field of ["version", "sha256", "integrity"]) {
      if (actual[name][field] !== expected[name][field]) {
        throw new Error(`${name} ${field} mismatch; actual=${actual[name][field]}; expected=${expected[name][field]}.`);
      }
    }
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const expected = options.verifyEnvironment
    ? normalizeExpectedManifest(process.env.RELEASE_MANIFEST || "")
    : undefined;
  let temporaryDirectory;
  let artifactDirectory = options.outputDirectory || options.verifyDirectory;
  if (!artifactDirectory) {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "productloop-release-pack-"));
    artifactDirectory = temporaryDirectory;
  } else {
    await mkdir(artifactDirectory, { recursive: true });
  }

  try {
    let actual;
    if (options.verifyDirectory) {
      const versions = Object.fromEntries(releasePackages.map(({ name }) => [name, expected[name].version]));
      actual = await manifestFromDirectory(options.verifyDirectory, versions);
    } else {
      actual = await packRelease(artifactDirectory);
    }
    if (expected) assertMatchesExpected(actual, expected);
    process.stdout.write(`${JSON.stringify(actual, null, options.compact ? 0 : 2)}\n`);
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
}

await main();
