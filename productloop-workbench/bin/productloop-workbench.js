#!/usr/bin/env node

import { runWorkbenchCli } from "../dist/cli.js";

process.exitCode = await runWorkbenchCli(process.argv.slice(2));
