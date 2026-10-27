#!/usr/bin/env node
/**
 * Cursor sessionStart hook launcher.
 * Resolves tsx from the plugin package root so it works even when cwd is the workspace.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "scripts/inject-overviews-impl.ts");
const require = createRequire(join(root, "package.json"));

let tsxLoader;
try {
	tsxLoader = require.resolve("tsx");
} catch {
	console.error("[click inject-overviews] tsx is required. Run npm install in the Click package root.");
	process.stdout.write("{}\n");
	process.exit(0);
}

const child = spawn(process.execPath, ["--import", tsxLoader, entry], {
	stdio: "inherit",
	env: process.env,
	cwd: process.cwd(),
});

child.on("error", (err) => {
	console.error(`[click inject-overviews] failed to start: ${err.message}`);
	process.stdout.write("{}\n");
	process.exit(0);
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	// Fail-open for hooks: non-zero child still exits 0 so Cursor does not treat this as hard failure.
	if (code && code !== 0) {
		process.exit(0);
		return;
	}
	process.exit(code ?? 0);
});
