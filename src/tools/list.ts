import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { getDb, getTotalCount, listMemories } from "../db.js";
import { CategorySchema, type Memory, OptionalSearchScope, type SearchScope } from "../types.js";

function formatMemory(m: Memory): string {
	let text = `#${m.id} [${m.scope}/${m.category}] ${m.title}`;
	if (m.tags) text += ` (${m.tags})`;
	if (m.project) text += `\n  project: ${m.project}`;
	text += `\n  ${m.content.length > 120 ? `${m.content.slice(0, 120)}…` : m.content}`;
	return text;
}

export function registerListTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "list_memories",
		label: "List Memories",
		description:
			"List stored memories with optional category filter and pagination. Shows a summary view of each memory.",
		promptSnippet: "List stored memories with optional category filter and pagination",
		parameters: Type.Object({
			category: Type.Optional(CategorySchema),
			scope: OptionalSearchScope,
			limit: Type.Optional(Type.Number({ description: "Max results (default: 50)", default: 50 })),
			offset: Type.Optional(Type.Number({ description: "Offset for pagination (default: 0)", default: 0 })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const scope: SearchScope = params.scope ?? "project";
			const db = getDb();

			const memories = listMemories(db, scope, ctx.cwd, {
				category: params.category,
				limit: params.limit,
				offset: params.offset,
			});
			const total = getTotalCount(db, scope, ctx.cwd);

			if (memories.length === 0) {
				const qualifier = params.category ? ` in category "${params.category}"` : "";
				return {
					content: [
						{
							type: "text",
							text: `No memories found${qualifier} in ${scope} scope. (${total} total)`,
						},
					],
					details: { memories: [], scope, total },
				};
			}

			const formatted = memories.map((m) => formatMemory(m)).join("\n\n");
			const header = `${memories.length} memor${memories.length === 1 ? "y" : "ies"} in ${scope} scope (${total} total):`;

			return {
				content: [{ type: "text", text: `${header}\n\n${formatted}` }],
				details: { memories, scope, total },
			};
		},
	});
}
