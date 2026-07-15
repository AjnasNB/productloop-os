import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunSnapshot, RunStore } from "./types.js";

export interface FileRunStoreOptions {
  directory: string;
}

export class FileRunStore implements RunStore {
  readonly directory: string;

  constructor(options: FileRunStoreOptions) {
    this.directory = options.directory;
  }

  async save(snapshot: RunSnapshot): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const path = this.pathFor(snapshot.runId);
    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(tempPath, path);
  }

  async load(runId: string): Promise<RunSnapshot | null> {
    try {
      return JSON.parse(await readFile(this.pathFor(runId), "utf8")) as RunSnapshot;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private pathFor(runId: string): string {
    if (!isValidRunId(runId)) {
      throw new TypeError("Run ID must start with a letter or number, use at most 128 path-safe characters, and not be a reserved device name");
    }
    return join(this.directory, `${runId}.json`);
  }
}

function isValidRunId(runId: string): boolean {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(runId)) return false;
  return !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(runId);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
