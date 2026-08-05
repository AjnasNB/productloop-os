import { BrowserClient } from "cockroach-browser/client";
import {
  checkCockroachBrowserConnection,
  createCockroachBrowserResearchAdapter,
  createProductLoopOS
} from "productloop-os";

const targetUrl = process.argv[2];
if (!targetUrl) {
  throw new Error("Usage: node cockroach-browser.mjs https://allowed.example/page");
}
const token = process.env.COCKROACH_BROWSER_TOKEN;
if (!token) {
  throw new Error("COCKROACH_BROWSER_TOKEN is required");
}

const target = new URL(targetUrl);
const client = new BrowserClient({
  baseUrl: process.env.COCKROACH_BROWSER_URL,
  token
});
const connection = await checkCockroachBrowserConnection(client);
if (!connection.capabilityIds.includes("page.snapshot")) {
  throw new Error("The connected browser daemon does not expose page.snapshot");
}

const adapter = createCockroachBrowserResearchAdapter({
  client,
  allowedOrigins: [target.origin.toLowerCase()],
  allowPrivateNetwork:
    process.env.PRODUCTLOOP_BROWSER_ALLOW_PRIVATE_NETWORK === "true"
});
const os = createProductLoopOS();
const report = await os.createBrowserHarness(adapter).run({
  schema: "ajnas.browser.research.plan.v1",
  id: "cockroach-browser-example",
  objective: "Read one explicitly allowed page through real Chromium",
  policy: {
    allowedOrigins: [target.origin.toLowerCase()],
    allowedActions: ["extract"],
    citationRequired: true
  },
  steps: [
    {
      id: "read-page",
      action: "extract",
      purpose: "Capture the page's semantic text and source citation",
      url: target.href
    }
  ]
});

console.log(JSON.stringify({ connection, report }, null, 2));
