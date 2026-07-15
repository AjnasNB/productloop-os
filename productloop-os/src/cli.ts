import { runDeterministicDemo } from "./demo.js";
import { inspectModules } from "./namespaces.js";

const VERSION = "0.1.1";

export interface ProductLoopCliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

const consoleIo: ProductLoopCliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message)
};

export async function runCli(
  args: string[] = process.argv.slice(2),
  io: ProductLoopCliIo = consoleIo
): Promise<number> {
  const command = args.find((argument) => !argument.startsWith("-")) ?? "help";
  const json = args.includes("--json");

  if (args.includes("--version") || command === "version") {
    io.stdout(VERSION);
    return 0;
  }

  if (command === "doctor") {
    const modules = inspectModules();
    const nodeSupported = supportsNode(process.versions.node);
    const report = {
      ok: nodeSupported && modules.every((module) => module.loaded),
      version: VERSION,
      node: {
        version: process.versions.node,
        supported: nodeSupported,
        requirement: ">=20.18.1"
      },
      modules,
      externalCapabilities: {
        checked: false,
        note: "Credentials, model providers, live browsers, networks, and connector services are deployment-specific and were not probed."
      }
    };
    if (json) {
      io.stdout(JSON.stringify(report, null, 2));
    } else {
      io.stdout(`ProductLoop OS ${VERSION} doctor: ${report.ok ? "ok" : "failed"}`);
      io.stdout(`Node ${report.node.version}: ${report.node.supported ? "supported" : "requires >=20.18.1"}`);
      for (const module of modules) {
        io.stdout(`${module.loaded ? "ok" : "missing"} ${module.packageName} (${module.anchor})`);
      }
      io.stdout(report.externalCapabilities.note);
    }
    return report.ok ? 0 : 1;
  }

  if (command === "info") {
    const info = {
      name: "ProductLoop OS",
      version: VERSION,
      purpose: "Composable governance and evidence primitives for agent workflows.",
      namespaces: inspectModules().map((module) => module.namespace),
      limitations: [
        "No model or hosted control plane is bundled.",
        "Browser research needs an explicit adapter; replay is deterministic and not live browsing.",
        "Maqam crawling and CLI-agent tools perform real side effects and require deployment controls."
      ]
    };
    io.stdout(json ? JSON.stringify(info, null, 2) : [
      `${info.name} ${info.version}`,
      info.purpose,
      `Namespaces: ${info.namespaces.join(", ")}`,
      ...info.limitations.map((limitation) => `- ${limitation}`)
    ].join("\n"));
    return 0;
  }

  if (command === "demo") {
    const result = await runDeterministicDemo();
    io.stdout(json ? JSON.stringify(result, null, 2) : [
      `Runtime: ${result.runtimeStatus}`,
      `Browser replay: ${result.browserStatus}`,
      `Evaluations: ${result.evalStatus}`,
      `Maqam: ${result.maqamStatus}`,
      `Trace valid: ${String(result.traceValid)}`
    ].join("\n"));
    return result.evalStatus === "passed" && result.traceValid ? 0 : 1;
  }

  if (command !== "help") {
    io.stderr(`Unknown command: ${command}`);
  }
  io.stdout([
    "Usage: productloop-os <command> [--json]",
    "",
    "Commands:",
    "  doctor   Verify Node and all packaged module imports",
    "  info     Describe modules and honest capability boundaries",
    "  demo     Run the deterministic cross-package example",
    "  version  Print the package version",
    "  help     Show this help"
  ].join("\n"));
  return command === "help" ? 0 : 1;
}

function supportsNode(version: string): boolean {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  return major > 20 || (major === 20 && (minor > 18 || (minor === 18 && patch >= 1)));
}
