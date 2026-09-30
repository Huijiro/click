import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { deleteMemory, getDb, getMemoryById, memoryMatchesScope } from "../db.js";
import { MEMORY_NAMESPACE, MemorySchema, ScopeSchema } from "../types.js";

export function registerForgetTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "forget",
		label: "Forget",
		description: "Delete a memory by ID. This permanently removes the memory.",
		promptSnippet: "Delete a memory by ID (permanent)",
		promptGuidelines: [
			"Use `forget` only when a memory is clearly outdated, wrong, or the user explicitly asks to remove it.",
		],
		namespace: MEMORY_NAMESPACE,
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		parameters: Type.Object({
			id: Type.Number({ description: "Memory ID to delete" }),
			scope: ScopeSchema,
		}),
		outputSchema: Type.Object({ deleted: MemorySchema }),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const db = getDb();

			const memory = getMemoryById(db, params.id);
			if (!memory || !memoryMatchesScope(memory, params.scope, ctx.cwd)) {
				throw new Error(`Memory #${params.id} not found in ${params.scope} scope.`);
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
				structuredContent: { deleted: memory },
			};
		},
	});
}
