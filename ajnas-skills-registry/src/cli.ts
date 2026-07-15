import { readFile } from "node:fs/promises";
import { computeSkillDigest } from "./signature.js";
import type { SkillManifest, ValidationIssue } from "./types.js";
import { validateSkillManifest } from "./validation.js";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

const defaultIo: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line)
};

export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number> {
  const [command, file] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.stdout(helpText());
    return 0;
  }

  if (!file) {
    io.stderr("Missing manifest path.");
    io.stderr(helpText());
    return 2;
  }

  let manifest: unknown;
  try {
    manifest = await readJson(file);
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (command === "validate") {
    const result = validateSkillManifest(manifest);
    io.stdout(`valid: ${result.valid}`);
    if (result.valid) {
      io.stdout(`digest: ${computeSkillDigest(manifest as SkillManifest)}`);
      return 0;
    }
    for (const issue of result.issues) {
      io.stdout(formatIssue(issue));
    }
    return 1;
  }

  if (command === "digest") {
    const result = validateSkillManifest(manifest);
    if (!result.valid) {
      for (const issue of result.issues) {
        io.stderr(formatIssue(issue));
      }
      return 1;
    }
    io.stdout(computeSkillDigest(manifest as SkillManifest));
    return 0;
  }

  io.stderr(`Unknown command: ${command}`);
  io.stderr(helpText());
  return 2;
}

function helpText(): string {
  return [
    "Usage: ajnas-skills <command> <manifest.json>",
    "",
    "Commands:",
    "  validate  Validate a skill manifest and print its deterministic digest.",
    "  digest    Print the deterministic manifest digest."
  ].join("\n");
}

async function readJson(file: string): Promise<unknown> {
  const text = await readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Could not parse JSON from ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatIssue(issue: ValidationIssue): string {
  return `${issue.severity} ${issue.code} at ${issue.path}: ${issue.message}`;
}
