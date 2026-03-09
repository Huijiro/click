import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { getDb, updateMemory } from "../db.js";
import { CategorySchema, ScopeSchema } from "../types.js";

export function registerUpdateTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "update_memory",
		label: "Update Memory",
		description: "Update an existing memory by ID. Provide only the fields you want to change.",
		promptSnippet: "Update an existing memory's title, content, tags, or category",
		parameters: Type.Object({
			id: Type.Number({ description: "Memory ID to update" }),
			scope: ScopeSchema,
			title: Type.Optional(Type.String({ description: "New title" })),
			content: Type.Optional(Type.String({ description: "New content" })),
			tags: Type.Optional(Type.String({ description: "New comma-separated tags" })),
			category: Type.Optional(CategorySchema),
		}),

		async execute(_toolCallId, params) {
			const db = getDb();

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
			};
		},
	});
}
