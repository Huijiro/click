#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundled = join(root, "dist/mcp-server.mjs");
const entry = join(root, "src/mcp/server.ts");
const require = createRequire(join(root, "package.json"));

function run(command, args) {
	const child = spawn(command, args, {
		stdio: "inherit",
		env: process.env,
		// Keep Cursor/workspace cwd for project-scoped memories.
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
}

if (existsSync(bundled)) {
	run(process.execPath, [bundled]);
} else {
	let tsxLoader;
	try {
		tsxLoader = require.resolve("tsx");
	} catch {
		console.error(
			"click-mcp: missing dist/mcp-server.mjs and tsx. Run `npm run build` (or `npm install`) in the Click package root.",
		);
		process.exit(1);
	}
	run(process.execPath, ["--import", tsxLoader, entry]);
}
