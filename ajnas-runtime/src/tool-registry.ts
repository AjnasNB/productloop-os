import { DuplicateToolError, UnknownToolError } from "./errors.js";
import { normalizeJson } from "./stable-json.js";
import type { ToolDefinition } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  static from(definitions: ToolDefinition[]): ToolRegistry {
    const registry = new ToolRegistry();
    for (const definition of definitions) {
      registry.register(definition);
    }
    return registry;
  }

  register(definition: ToolDefinition): this {
    if (this.tools.has(definition.name)) {
      throw new DuplicateToolError(definition.name);
    }
    const stored: ToolDefinition = Object.freeze({
      ...definition,
      ...(definition.inputSchema === undefined
        ? {}
        : { inputSchema: freezeJson(normalizeJson(definition.inputSchema)) as ToolDefinition["inputSchema"] })
    });
    this.tools.set(stored.name, stored);
    return this;
  }

  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new UnknownToolError(name);
    }
    return tool;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }
}

function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}
