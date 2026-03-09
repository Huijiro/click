import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ScopeSchema } from "../types.js";
import { getDb, getMemoryById, deleteMemory } from "../db.js";

export function registerForgetTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forget",
    label: "Forget",
    description: "Delete a memory by ID. This permanently removes the memory.",
    promptSnippet: "Delete a memory by ID (permanent)",
    promptGuidelines: [
      "Use `forget` only when a memory is clearly outdated, wrong, or the user explicitly asks to remove it.",
    ],
    parameters: Type.Object({
      id: Type.Number({ description: "Memory ID to delete" }),
      scope: ScopeSchema,
    }),

    async execute(_toolCallId, params) {
      const db = getDb();

      const memory = getMemoryById(db, params.id);
      if (!memory) {
        throw new Error(`Memory #${params.id} not found.`);
      }

      deleteMemory(db, params.id);

      return {
        content: [
          {
            type: "text",
            text: `Deleted memory #${params.id} [${memory.scope}/${memory.category}]: "${memory.title}"`,
          },
        ],
        details: { deleted: memory },
      };
    },
  });
}
