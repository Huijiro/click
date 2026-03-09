import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { getDb, searchMemories } from "../db.js";
import { CategorySchema, type Memory, OptionalSearchScope, type SearchScope } from "../types.js";

function formatMemory(m: Memory): string {
	let text = `#${m.id} [${m.scope}/${m.category}] ${m.title}`;
	text += `\n  ${m.content}`;
	if (m.tags) text += `\n  tags: ${m.tags}`;
	if (m.project) text += `\n  project: ${m.project}`;
	text += `\n  updated: ${m.updated_at}`;
	return text;
}

export function registerRecallTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "recall",
		label: "Recall",
		description:
			"Search memories by keyword query. Uses full-text search across titles, content, and tags. Can filter by category, tags, and scope.",
		promptSnippet: "Search memories by keyword query with optional category/tag filters",
		promptGuidelines: [
			"Use `recall` to search for relevant memories before making decisions or answering questions about the project.",
			"Try broad queries first, then narrow with category or tag filters if there are too many results.",
			'Use scope "both" to search across project and user memories at once.',
		],
		parameters: Type.Object({
			query: Type.String({
				description: "Search query — keywords or phrases to match against memory titles and content",
			}),
			category: Type.Optional(CategorySchema),
			tags: Type.Optional(Type.String({ description: "Comma-separated tags to filter by" })),
			scope: OptionalSearchScope,
			limit: Type.Optional(Type.Number({ description: "Max results to return (default: 20)", default: 20 })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const scope: SearchScope = params.scope ?? "project";
			const db = getDb();

			const results = searchMemories(db, scope, ctx.cwd, params.query, {
				category: params.category,
				tags: params.tags,
				limit: params.limit,
			});

			if (results.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `No memories found matching "${params.query}" in ${scope} scope.`,
						},
					],
					details: { results: [], scope, query: params.query },
				};
			}

			const formatted = results.map((m) => formatMemory(m)).join("\n\n");
			return {
				content: [
					{
						type: "text",
						text: `Found ${results.length} memor${results.length === 1 ? "y" : "ies"} in ${scope} scope:\n\n${formatted}`,
					},
				],
				details: { results, scope, query: params.query },
			};
		},
	});
}
