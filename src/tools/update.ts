import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getDb, getMemoryById, memoryMatchesScope, updateMemory } from "../db.js";
import { CategorySchema, MEMORY_NAMESPACE, MemorySchema, ScopeSchema } from "../types.js";

export function registerUpdateTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "update_memory",
		label: "Update Memory",
		description: "Update an existing memory by ID. Provide only the fields you want to change.",
		promptSnippet: "Update an existing memory's title, content, tags, or category",
		namespace: MEMORY_NAMESPACE,
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		parameters: Type.Object({
			id: Type.Number({ description: "Memory ID to update" }),
			scope: ScopeSchema,
			title: Type.Optional(Type.String({ description: "New title" })),
			content: Type.Optional(Type.String({ description: "New content" })),
			tags: Type.Optional(Type.String({ description: "New comma-separated tags" })),
			category: Type.Optional(CategorySchema),
		}),
		outputSchema: Type.Object({ memory: MemorySchema }),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const db = getDb();
			const existing = getMemoryById(db, params.id);
			if (!existing || !memoryMatchesScope(existing, params.scope, ctx.cwd)) {
				throw new Error(`Memory #${params.id} not found in ${params.scope} scope.`);
			}

			const updated = updateMemory(db, params.id, {
				title: params.title,
				content: params.content,
				tags: params.tags,
				category: params.category,
			});

			if (!updated) {
				throw new Error(`Memory #${params.id} not found.`);
			}

			return {
				content: [
					{
						type: "text",
						text: `Updated memory #${updated.id} [${updated.scope}/${updated.category}]: "${updated.title}"`,
					},
				],
				details: { memory: updated },
				structuredContent: { memory: updated },
			};
		},
	});
}
