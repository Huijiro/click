import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeAll, getDb, insertMemory } from "../src/db.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "click-inject-"));
const dbPath = join(dir, "memories.db");
const project = join(dir, "project");

process.env.CLICK_DB_PATH = dbPath;
const db = getDb();
insertMemory(db, "user", project, "overview", "User overview", "Prefer short answers.");
insertMemory(db, "project", project, "overview", "Project overview", "Click dual-host memory.");
insertMemory(db, "project", project, "fact", "Hidden fact", "Must not appear in overview inject.");
closeAll();

const result = spawnSync(process.execPath, [join(root, "scripts/inject-overviews.mjs")], {
	input: JSON.stringify({
		session_id: "smoke",
		workspace_roots: [project],
		is_background_agent: false,
	}),
	env: { ...process.env, CLICK_DB_PATH: dbPath },
	encoding: "utf8",
});

if (result.status !== 0) {
	console.error(result.stderr);
	process.exit(result.status ?? 1);
}

const out = result.stdout.trim();
const parsed = JSON.parse(out) as { additional_context?: string };
const ctx = parsed.additional_context ?? "";
const ok = ctx.includes("User overview") && ctx.includes("Project overview") && !ctx.includes("Hidden fact");
console.log("inject ok:", ok);
if (!ok) {
	console.error(out);
	process.exit(1);
}

rmSync(dir, { recursive: true, force: true });
