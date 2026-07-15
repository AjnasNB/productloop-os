import { readFile } from "node:fs/promises";
import { computePolicyBundleDigest, evaluatePolicyBundle } from "./evaluator.js";
import { validatePolicyBundle } from "./validation.js";
import type { CliIo, PolicyBundle, RuntimePolicyRequest } from "./types.js";

const DEFAULT_IO: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line)
};

export async function runCli(argv = process.argv.slice(2), io: CliIo = DEFAULT_IO): Promise<number> {
  const [command, ...args] = argv;

  try {
    if (command === "validate") {
      const [bundlePath] = args;
      if (!bundlePath) {
        throw new Error("Usage: ajnas-policy validate <policy-bundle.json>");
      }
      const bundle = await readJson<PolicyBundle>(bundlePath);
      const result = validatePolicyBundle(bundle);
      io.stdout(`valid: ${String(result.valid)}`);
      if (result.valid) {
        io.stdout(`digest: ${computePolicyBundleDigest(bundle)}`);
      } else {
        for (const issue of result.issues) {
          io.stdout(`${issue.code} ${issue.path}: ${issue.message}`);
        }
      }
      return result.valid ? 0 : 1;
    }

    if (command === "digest") {
      const [bundlePath] = args;
      if (!bundlePath) {
        throw new Error("Usage: ajnas-policy digest <policy-bundle.json>");
      }
      const bundle = await readJson<PolicyBundle>(bundlePath);
      io.stdout(computePolicyBundleDigest(bundle));
      return 0;
    }

    if (command === "evaluate") {
      const [bundlePath, requestPath] = args;
      if (!bundlePath || !requestPath) {
        throw new Error("Usage: ajnas-policy evaluate <policy-bundle.json> <runtime-request.json>");
      }
      const bundle = await readJson<PolicyBundle>(bundlePath);
      const request = await readJson<RuntimePolicyRequest>(requestPath);
      io.stdout(JSON.stringify(evaluatePolicyBundle(bundle, request), null, 2));
      return 0;
    }

    io.stderr(helpText());
    return 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON from ${filePath}: ${message}`);
  }
}

function helpText(): string {
  return [
    "Usage: ajnas-policy <command>",
    "",
    "Commands:",
    "  validate <policy-bundle.json>",
    "  digest <policy-bundle.json>",
    "  evaluate <policy-bundle.json> <runtime-request.json>"
  ].join("\n");
}
