import { readFile } from "node:fs/promises";
import { artifactMapFromJson, runEvalSuite, verifyEvalReport } from "./runner.js";
import { computeEvalSuiteDigest, validateEvalSuite } from "./validation.js";
import type { AgentRunArtifact, CliIo, EvalSuite } from "./types.js";

const DEFAULT_IO: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line)
};

export async function runCli(argv = process.argv.slice(2), io: CliIo = DEFAULT_IO): Promise<number> {
  const [command, ...args] = argv;

  try {
    if (command === "validate") {
      const [suitePath] = args;
      if (!suitePath) {
        throw new Error("Usage: ajnas-evals validate <eval-suite.json>");
      }
      const suite = await readJson<EvalSuite>(suitePath);
      const result = validateEvalSuite(suite);
      io.stdout(`valid: ${String(result.valid)}`);
      if (result.valid) {
        io.stdout(`digest: ${computeEvalSuiteDigest(suite)}`);
      } else {
        for (const issue of result.issues) {
          io.stdout(`${issue.code} ${issue.path}: ${issue.message}`);
        }
      }
      return result.valid ? 0 : 1;
    }

    if (command === "digest") {
      const [suitePath] = args;
      if (!suitePath) {
        throw new Error("Usage: ajnas-evals digest <eval-suite.json>");
      }
      const suite = await readJson<EvalSuite>(suitePath);
      io.stdout(computeEvalSuiteDigest(suite));
      return 0;
    }

    if (command === "run") {
      const [suitePath, artifactsPath] = args;
      if (!suitePath || !artifactsPath) {
        throw new Error("Usage: ajnas-evals run <eval-suite.json> <run-artifacts.json>");
      }
      const suite = await readJson<EvalSuite>(suitePath);
      const artifactBundle = await readJson<Record<string, unknown>>(artifactsPath);
      const artifacts = artifactMapFromJson(artifactBundle);
      const report = await runEvalSuite(
        suite,
        (testCase): AgentRunArtifact => {
          const artifact = artifacts[testCase.id];
          if (!artifact) {
            throw new Error(`No run artifact supplied for case ${testCase.id}`);
          }
          return artifact;
        },
        {
          generatedAt: typeof artifactBundle.generatedAt === "string" ? artifactBundle.generatedAt : undefined,
          generatedBy: typeof artifactBundle.generatedBy === "string" ? artifactBundle.generatedBy : "ajnas-evals-cli"
        }
      );
      io.stdout(JSON.stringify(report, null, 2));
      return report.summary.failedCases === 0 ? 0 : 2;
    }

    if (command === "verify-report") {
      const [reportPath] = args;
      if (!reportPath) {
        throw new Error("Usage: ajnas-evals verify-report <eval-report.json>");
      }
      const report = await readJson<Parameters<typeof verifyEvalReport>[0]>(reportPath);
      const result = verifyEvalReport(report);
      io.stdout(`valid: ${String(result.valid)}`);
      for (const issue of result.issues) {
        io.stdout(issue);
      }
      return result.valid ? 0 : 1;
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
    return JSON.parse(decodeJson(await readFile(filePath))) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON from ${filePath}: ${message}`);
  }
}

function decodeJson(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  if (looksLikeUtf16Le(buffer)) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function looksLikeUtf16Le(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  let nulOddBytes = 0;
  const sampleLength = Math.min(buffer.length, 64);
  for (let index = 1; index < sampleLength; index += 2) {
    if (buffer[index] === 0) {
      nulOddBytes += 1;
    }
  }
  return nulOddBytes >= Math.floor(sampleLength / 4);
}

function helpText(): string {
  return [
    "Usage: ajnas-evals <command>",
    "",
    "Commands:",
    "  validate <eval-suite.json>",
    "  digest <eval-suite.json>",
    "  run <eval-suite.json> <run-artifacts.json>",
    "  verify-report <eval-report.json>"
  ].join("\n");
}
