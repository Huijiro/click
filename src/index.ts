import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { closeAll, getDb, getOverviews, searchMemories, getStats, getTotalCount } from "./db.js";
import { registerRememberTool } from "./tools/remember.js";
import { registerRecallTool } from "./tools/recall.js";
import { registerUpdateTool } from "./tools/update.js";
import { registerForgetTool } from "./tools/forget.js";
import { registerListTool } from "./tools/list.js";
import { registerStatsTool } from "./tools/stats.js";
import type { Memory } from "./types.js";

/** Max characters for the entire auto-injected block (~4KB ≈ ~1K tokens) */
const MAX_INJECT_CHARS = 4096;
/** Max overviews to inject */
const MAX_OVERVIEWS = 5;
/** Max relevant (non-overview) memories to inject */
const MAX_RELEVANT = 5;
/** Max characters per individual memory content in injection */
const MAX_MEMORY_CONTENT_CHARS = 300;

function truncateContent(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function formatMemoryBrief(m: Memory): string {
  return `- [#${m.id} ${m.scope}/${m.category}] ${m.title}: ${truncateContent(m.content, MAX_MEMORY_CONTENT_CHARS)}`;
}

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
    const cwd = ctx.cwd;
    const prompt = event.prompt;
    if (!prompt || prompt.trim().length === 0) return;

    const sections: string[] = [];

    let charBudget = MAX_INJECT_CHARS;

    // 1. Always inject overview memories (capped)
    const overviews = getOverviews(db, cwd);
    const allOverviews = [...overviews.user, ...overviews.project].slice(0, MAX_OVERVIEWS);
    if (allOverviews.length > 0) {
      const overviewLines: string[] = [];
      for (const m of allOverviews) {
        const line = formatMemoryBrief(m);
        if (charBudget - line.length < 0) break;
        overviewLines.push(line);
        charBudget -= line.length + 1; // +1 for newline
      }
      if (overviewLines.length > 0) {
        sections.push(`## Memory Overviews\n${overviewLines.join("\n")}`);
      }
    }

    // 2. Search for relevant memories based on the user's prompt
    if (charBudget > 100) {
      try {
        const results = searchMemories(db, "both", cwd, prompt, { limit: MAX_RELEVANT });
        // Filter out overviews (already injected above)
        const relevant = results.filter((m) => m.category !== "overview");
        if (relevant.length > 0) {
          const relevantLines: string[] = [];
          for (const m of relevant) {
            const line = formatMemoryBrief(m);
            if (charBudget - line.length < 0) break;
            relevantLines.push(line);
            charBudget -= line.length + 1;
          }
          if (relevantLines.length > 0) {
            sections.push(`## Relevant Memories\n${relevantLines.join("\n")}`);
          }
        }
      } catch {
        // FTS can fail on certain query strings, silently skip
      }
    }

    if (sections.length === 0) return;

    const content = `# Recalled Memories (auto-injected)\n\n${sections.join("\n\n")}`;

    return {
      message: {
        customType: "click-memory-context",
        content,
        display: false,
      },
    };
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
