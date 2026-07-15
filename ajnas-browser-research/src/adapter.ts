import type {
  BrowserAdapterOutput,
  BrowserResearchAction,
  BrowserResearchAdapter,
  BrowserResearchAdapterInput,
  CrawlAdapterOutput,
  ExtractAdapterOutput,
  NoteAdapterOutput,
  OpenAdapterOutput,
  ReplayBrowserAdapterRecord,
  SearchAdapterOutput
} from "./types.js";
import { normalizeJson } from "./stable-json.js";

function cloneOutput<T extends BrowserAdapterOutput>(value: T): T {
  return normalizeJson(value) as unknown as T;
}

export class ReplayBrowserAdapter implements BrowserResearchAdapter {
  private readonly records = new Map<string, BrowserAdapterOutput>();

  constructor(records: ReplayBrowserAdapterRecord[]) {
    for (const record of records) {
      this.records.set(this.key(record.stepId, record.action), record.output);
    }
  }

  search(input: BrowserResearchAdapterInput): SearchAdapterOutput {
    return cloneOutput(this.read<SearchAdapterOutput>(input, "search"));
  }

  open(input: BrowserResearchAdapterInput): OpenAdapterOutput {
    return cloneOutput(this.read<OpenAdapterOutput>(input, "open"));
  }

  extract(input: BrowserResearchAdapterInput): ExtractAdapterOutput {
    return cloneOutput(this.read<ExtractAdapterOutput>(input, "extract"));
  }

  crawl(input: BrowserResearchAdapterInput): CrawlAdapterOutput {
    return cloneOutput(this.read<CrawlAdapterOutput>(input, "crawl"));
  }

  note(input: BrowserResearchAdapterInput): NoteAdapterOutput {
    return cloneOutput(this.read<NoteAdapterOutput>(input, "note"));
  }

  private read<T extends BrowserAdapterOutput>(input: BrowserResearchAdapterInput, action: BrowserResearchAction): T {
    const output = this.records.get(this.key(input.step.id, action));
    if (!output) {
      throw new Error(`No replay adapter output for step ${input.step.id} (${action})`);
    }
    return output as T;
  }

  private key(stepId: string, action: BrowserResearchAction): string {
    return `${stepId}:${action}`;
  }
}
