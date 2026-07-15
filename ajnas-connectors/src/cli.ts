import { readFile } from "node:fs/promises";
import { ConnectorRegistry } from "./registry.js";
import { computeConnectorDigest, validateConnectorManifest } from "./validation.js";
import { createConnectorPolicyRequest, evaluateConnectorTrust } from "./policy.js";
import type { CliIo, ConnectorInvocationRequest, ConnectorManifest } from "./types.js";

const DEFAULT_IO: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line)
};

export async function runCli(argv = process.argv.slice(2), io: CliIo = DEFAULT_IO): Promise<number> {
  const [command, ...args] = argv;

  try {
    if (command === "validate") {
      const [manifestPath] = args;
      if (!manifestPath) {
        throw new Error("Usage: ajnas-connectors validate <connector-manifest.json>");
      }
      const manifest = await readJson<ConnectorManifest>(manifestPath);
      const result = validateConnectorManifest(manifest);
      io.stdout(`valid: ${String(result.valid)}`);
      if (result.valid) {
        io.stdout(`digest: ${computeConnectorDigest(manifest)}`);
      } else {
        for (const issue of result.issues) {
          io.stdout(`${issue.code} ${issue.path}: ${issue.message}`);
        }
      }
      return result.valid ? 0 : 1;
    }

    if (command === "digest") {
      const [manifestPath] = args;
      if (!manifestPath) {
        throw new Error("Usage: ajnas-connectors digest <connector-manifest.json>");
      }
      const manifest = await readJson<ConnectorManifest>(manifestPath);
      io.stdout(computeConnectorDigest(manifest));
      return 0;
    }

    if (command === "trust") {
      const [manifestPath] = args;
      if (!manifestPath) {
        throw new Error("Usage: ajnas-connectors trust <connector-manifest.json>");
      }
      const manifest = await readJson<ConnectorManifest>(manifestPath);
      io.stdout(JSON.stringify(evaluateConnectorTrust(manifest), null, 2));
      return 0;
    }

    if (command === "policy-context") {
      const [manifestPath, invocationPath] = args;
      if (!manifestPath || !invocationPath) {
        throw new Error("Usage: ajnas-connectors policy-context <connector-manifest.json> <invocation.json>");
      }
      const manifest = await readJson<ConnectorManifest>(manifestPath);
      const invocation = await readJson<ConnectorInvocationRequest>(invocationPath);
      io.stdout(JSON.stringify(createConnectorPolicyRequest(manifest, invocation), null, 2));
      return 0;
    }

    if (command === "registry-summary") {
      const manifestPaths = args;
      if (manifestPaths.length === 0) {
        throw new Error("Usage: ajnas-connectors registry-summary <connector-manifest.json> [...manifest]");
      }
      const registry = new ConnectorRegistry();
      for (const manifestPath of manifestPaths) {
        registry.register(await readJson<ConnectorManifest>(manifestPath));
      }
      io.stdout(
        JSON.stringify(
          registry.list().map((manifest) => ({
            id: manifest.id,
            version: manifest.version,
            kind: manifest.kind,
            capabilities: manifest.capabilities.map((capability) => capability.id)
          })),
          null,
          2
        )
      );
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
    const buffer = await readFile(filePath);
    const text = decodeText(buffer);
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON from ${filePath}: ${message}`);
  }
}

function decodeText(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    throw new Error("UTF-16BE JSON files are not supported.");
  }
  const sampleLength = Math.min(buffer.length, 64);
  let nullBytes = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) {
      nullBytes += 1;
    }
  }
  if (sampleLength > 0 && nullBytes / sampleLength > 0.2) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function helpText(): string {
  return [
    "Usage: ajnas-connectors <command>",
    "",
    "Commands:",
    "  validate <connector-manifest.json>",
    "  digest <connector-manifest.json>",
    "  trust <connector-manifest.json>",
    "  policy-context <connector-manifest.json> <invocation.json>",
    "  registry-summary <connector-manifest.json> [...manifest]"
  ].join("\n");
}
