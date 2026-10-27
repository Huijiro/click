#!/usr/bin/env node
/**
 * Cursor sessionStart hook launcher.
 * Prefers committed dist bundle so marketplace installs work without node_modules.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundled = join(root, "dist/inject-overviews.mjs");
const entry = join(root, "scripts/inject-overviews-impl.ts");
const require = createRequire(join(root, "package.json"));

function failOpen(message) {
	console.error(`[click inject-overviews] ${message}`);
	process.stdout.write("{}\n");
	process.exit(0);
}

function run(command, args) {
	const child = spawn(command, args, {
		stdio: "inherit",
		env: process.env,
		cwd: process.cwd(),
	});

	child.on("error", (err) => failOpen(`failed to start: ${err.message}`));

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		// Fail-open for hooks.
		process.exit(0);
	});
}

if (existsSync(bundled)) {
	run(process.execPath, [bundled]);
} else {
	let tsxLoader;
	try {
		tsxLoader = require.resolve("tsx");
	} catch {
		failOpen("missing dist/inject-overviews.mjs and tsx. Run `npm run build` in the Click package root.");
	}
	run(process.execPath, ["--import", tsxLoader, entry]);
}
