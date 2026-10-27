import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { closeAll, getDb, getTotalCount } from "./db.js";
import { buildMemoryInjectBlock } from "./inject.js";
import { registerForgetTool } from "./tools/forget.js";
import { registerListTool } from "./tools/list.js";
import { registerRecallTool } from "./tools/recall.js";
import { registerRememberTool } from "./tools/remember.js";
import { registerStatsTool } from "./tools/stats.js";
import { registerUpdateTool } from "./tools/update.js";

export default function (pi: ExtensionAPI) {
	// Register all memory tools
	registerRememberTool(pi);
	registerRecallTool(pi);
	registerUpdateTool(pi);
	registerForgetTool(pi);
	registerListTool(pi);
	registerStatsTool(pi);

	// Auto-inject relevant memories before each agent turn
	pi.on("before_agent_start", async (event, ctx) => {
		const db = getDb();
		const prompt = event.prompt;
		if (!prompt || prompt.trim().length === 0) {
			delete event.systemPromptOptions.sections.click_memories;
			return;
		}

		const block = buildMemoryInjectBlock(db, ctx.cwd, { prompt });
		if (!block) {
			delete event.systemPromptOptions.sections.click_memories;
			return;
		}

		event.systemPromptOptions.sections.click_memories = block;
	});

	// Clean up DB connections on shutdown
	pi.on("session_shutdown", async () => {
		closeAll();
	});

	pi.on("session_start", async (_event, ctx) => {
		const db = getDb();
		const cwd = ctx.cwd;
		const projectTotal = getTotalCount(db, "project", cwd);
		const userTotal = getTotalCount(db, "user", cwd);
		if (projectTotal > 0 || userTotal > 0) {
			ctx.ui.notify(`click: ${projectTotal} project + ${userTotal} user memories`, "info");
		} else {
			ctx.ui.notify("click memory loaded (empty)", "info");
		}
	});
}
