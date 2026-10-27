/**
 * Cursor sessionStart hook body: inject Click overview memories as additional_context.
 * Launched by inject-overviews.mjs. Fail-open on errors.
 */
import { closeAll, getDb } from "../src/db.js";
import { buildMemoryInjectBlock } from "../src/inject.js";

interface HookPayload {
	cwd?: string;
	workspace_roots?: string[];
}

function resolveCwd(payload: HookPayload): string {
	const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
	if (typeof roots[0] === "string" && roots[0].length > 0) return roots[0];
	if (typeof payload.cwd === "string" && payload.cwd.length > 0) return payload.cwd;
	if (process.env.CLICK_CWD) return process.env.CLICK_CWD;
	return process.cwd();
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
	try {
		const raw = await readStdin();
		const payload = (raw.trim() ? JSON.parse(raw) : {}) as HookPayload;
		const cwd = resolveCwd(payload);
		process.env.CLICK_CWD = cwd;

		const db = getDb();
		const block = buildMemoryInjectBlock(db, cwd);
		closeAll();

		if (!block) {
			process.stdout.write("{}\n");
			return;
		}

		process.stdout.write(
			`${JSON.stringify({
				additional_context: `## click_memories\n\n${block}`,
			})}\n`,
		);
	} catch (err) {
		console.error(`[click inject-overviews] ${err instanceof Error ? err.message : err}`);
		process.stdout.write("{}\n");
	}
}

await main();
