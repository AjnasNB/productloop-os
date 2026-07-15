import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const packageNames = [
  "ajnas-skills-registry",
  "ajnas-provenance",
  "ajnas-browser-research",
  "productloop-os",
];

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
  const temporaryRoot = await mkdtemp(join(tmpdir(), "productloop-clean-consumer-"));
  assertOutsideRepo(temporaryRoot);

  try {
    const packDirectory = join(temporaryRoot, "packs");
    const consumerDirectory = join(temporaryRoot, "consumer");
    await Promise.all([mkdir(packDirectory), mkdir(consumerDirectory)]);

    const packageDirectories = packageNames.map((name) => join(repoRoot, name));
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
        'import type { SignResearchProvenanceOptions } from "ajnas-browser-research";',
        'import { PRODUCTLOOP_OS_VERSION } from "productloop-os";',
        "",
        'export const registryKey: RegistryKeyMaterial = "registry-public-key";',
        'export const provenanceKey: ProvenanceKeyMaterial = "provenance-public-key";',
        "export const browserSigningOptions: Pick<SignResearchProvenanceOptions, \"privateKey\"> = {",
        '  privateKey: "browser-private-key",',
        "};",
        "export const productLoopVersion: string = PRODUCTLOOP_OS_VERSION;",
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

    console.log("Clean external TypeScript consumer passed for the fixed packages and ProductLoop OS umbrella.");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

await main();
