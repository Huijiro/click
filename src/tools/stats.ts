import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { OptionalSearchScope, type SearchScope } from "../types.js";
import { getDb, getStats, getTotalCount } from "../db.js";

export function registerStatsTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "memory_stats",
    label: "Memory Stats",
    description: "Show memory counts grouped by category for the given scope.",
    promptSnippet: "Show memory counts by category",
    parameters: Type.Object({
      scope: OptionalSearchScope,
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope: SearchScope = params.scope ?? "project";
      const db = getDb();

      const stats = getStats(db, scope, ctx.cwd);
      const total = getTotalCount(db, scope, ctx.cwd);

      if (total === 0) {
        return {
          content: [{ type: "text", text: `No memories stored in ${scope} scope.` }],
          details: { stats: [], total: 0, scope },
        };
      }

      const lines = stats.map((s) => `  ${s.category}: ${s.count}`);
      const text = `Memory stats (${scope}, ${total} total):\n${lines.join("\n")}`;

      return {
        content: [{ type: "text", text }],
        details: { stats, total, scope },
      };
    },
  });
}
