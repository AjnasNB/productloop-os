import {
  BrowserResearchAuditLedger,
  ReplayBrowserAdapter,
  createResearchProvenanceBundle,
  runBrowserResearchPlan,
  verifyBrowserResearchReport
} from "../dist/index.js";
import { readFile } from "node:fs/promises";

const plan = JSON.parse(await readFile(new URL("../fixtures/release-browser-plan.json", import.meta.url), "utf8"));
const records = JSON.parse(await readFile(new URL("../fixtures/replay-adapter-records.json", import.meta.url), "utf8"));

const timestamps = [
  "2026-07-13T12:45:01.000Z",
  "2026-07-13T12:45:02.000Z",
  "2026-07-13T12:45:03.000Z",
  "2026-07-13T12:45:04.000Z",
  "2026-07-13T12:45:05.000Z",
  "2026-07-13T12:45:06.000Z",
  "2026-07-13T12:45:07.000Z",
  "2026-07-13T12:45:08.000Z",
  "2026-07-13T12:45:09.000Z",
  "2026-07-13T12:45:10.000Z",
  "2026-07-13T12:45:11.000Z",
  "2026-07-13T12:45:12.000Z"
];
const now = () => timestamps.shift() ?? "2026-07-13T12:45:59.000Z";

const report = await runBrowserResearchPlan(plan, {
  adapter: new ReplayBrowserAdapter(records),
  auditLedger: new BrowserResearchAuditLedger({ now }),
  now,
  runId: "run_release_browser_research_fixture"
});
const provenance = createResearchProvenanceBundle(report, {
  generatedAt: "2026-07-13T12:46:00.000Z"
});

console.log(
  JSON.stringify(
    {
      status: report.status,
      reportValid: verifyBrowserResearchReport(report).valid,
      stepsRun: report.summary.stepsRun,
      citationsCaptured: report.summary.citationsCaptured,
      reportDigest: report.digest,
      provenanceDigest: provenance.digest
    },
    null,
    2
  )
);
