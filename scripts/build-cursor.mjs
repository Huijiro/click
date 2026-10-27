#!/usr/bin/env node
/**
 * Bundle Click MCP + sessionStart inject for Cursor marketplace installs.
 * Marketplace cache is a git checkout without node_modules, so runtime must be plain node.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist");
mkdirSync(outdir, { recursive: true });

const shared = {
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: false,
	logLevel: "info",
	// Keep Node builtins external; bundle npm deps into the outfile.
	packages: "bundle",
};

await Promise.all([
	esbuild.build({
		...shared,
		entryPoints: [join(root, "src/mcp/server.ts")],
		outfile: join(outdir, "mcp-server.mjs"),
	}),
	esbuild.build({
		...shared,
		entryPoints: [join(root, "scripts/inject-overviews-impl.ts")],
		outfile: join(outdir, "inject-overviews.mjs"),
	}),
]);

console.log("Built dist/mcp-server.mjs and dist/inject-overviews.mjs");
