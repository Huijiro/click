#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "src/mcp/server.ts");
const require = createRequire(join(root, "package.json"));

let tsxLoader;
try {
	tsxLoader = require.resolve("tsx");
} catch {
	console.error("click-mcp: tsx is required. Run npm install in the Click package root.");
	process.exit(1);
}

const child = spawn(process.execPath, ["--import", tsxLoader, entry], {
	stdio: "inherit",
	env: process.env,
	// Keep Cursor/workspace cwd for project-scoped memories; only pin module resolution via absolute --import.
	cwd: process.env.CLICK_CWD ?? process.cwd(),
});

child.on("error", (err) => {
	console.error(`click-mcp: failed to start: ${err.message}`);
	process.exit(1);
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 1);
});
