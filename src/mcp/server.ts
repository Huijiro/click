#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import {
	deleteMemory,
	findSimilarByTitle,
	getDb,
	getMemoryById,
	getStats,
	getTotalCount,
	insertMemory,
	listMemories,
	memoryMatchesScope,
	searchMemories,
	updateMemory,
} from "../db.js";
import {
	CATEGORIES,
	type Category,
	isCategory,
	isScope,
	isSearchScope,
	type Scope,
	type SearchScope,
} from "../types.js";

const VERSION = "0.1.0";

/** Project root for scope filtering. Override with CLICK_CWD. */
function resolveCwd(): string {
	return process.env.CLICK_CWD ?? process.cwd();
}

function text(payload: unknown) {
	return {
		content: [
			{ type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
		],
	};
}

function errorResult(message: string) {
	return {
		isError: true as const,
		content: [{ type: "text" as const, text: message }],
	};
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseScope(value: unknown, fallback: Scope = "project"): Scope {
	const raw = asString(value, fallback);
	if (!isScope(raw)) throw new Error(`Invalid scope "${raw}". Expected project or user.`);
	return raw;
}

function parseSearchScope(value: unknown, fallback: SearchScope = "project"): SearchScope {
	const raw = asString(value, fallback);
	if (!isSearchScope(raw)) throw new Error(`Invalid scope "${raw}". Expected project, user, both, or all.`);
	return raw;
}

function parseCategory(value: unknown): Category {
	const raw = asString(value);
	if (!isCategory(raw)) {
		throw new Error(`Invalid category "${raw}". Expected one of: ${CATEGORIES.join(", ")}`);
	}
	return raw;
}

const categoryEnum = [...CATEGORIES];
const scopeEnum = ["project", "user"];
const searchScopeEnum = ["project", "user", "both", "all"];

const TOOLS: Tool[] = [
	{
		name: "remember",
		description:
			"Store a new memory. Use for facts, decisions, preferences, snippets, todos, lessons, patterns, conventions, or overviews. Warns on similar titles.",
		inputSchema: {
			type: "object",
			properties: {
				category: { type: "string", enum: categoryEnum, description: "Memory category" },
				title: { type: "string", description: "Short descriptive title" },
				content: { type: "string", description: "Memory content with enough context to be useful later" },
				tags: { type: "string", description: "Comma-separated tags (e.g. typescript,api,auth)" },
				scope: {
					type: "string",
					enum: scopeEnum,
					description: '"project" (default) for this codebase, "user" for cross-project preferences',
				},
			},
			required: ["category", "title", "content"],
		},
	},
	{
		name: "recall",
		description: "Full-text search across memory titles, content, and tags. Filter by category, tags, and scope.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Keywords or phrases to search for" },
				category: { type: "string", enum: categoryEnum },
				tags: { type: "string", description: "Comma-separated tags to filter by" },
				scope: {
					type: "string",
					enum: searchScopeEnum,
					description: '"project" (default), "user", "both", or "all"',
				},
				limit: { type: "number", description: "Max results (default 20)" },
			},
			required: ["query"],
		},
	},
	{
		name: "update_memory",
		description: "Update an existing memory by ID. Provide only fields to change.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "number", description: "Memory ID" },
				scope: { type: "string", enum: scopeEnum, description: "Scope that owns the memory" },
				title: { type: "string" },
				content: { type: "string" },
				tags: { type: "string" },
				category: { type: "string", enum: categoryEnum },
			},
			required: ["id", "scope"],
		},
	},
	{
		name: "forget",
		description: "Permanently delete a memory by ID.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "number", description: "Memory ID to delete" },
				scope: { type: "string", enum: scopeEnum, description: "Scope that owns the memory" },
			},
			required: ["id", "scope"],
		},
	},
	{
		name: "list_memories",
		description: "List stored memories with optional category filter and pagination.",
		inputSchema: {
			type: "object",
			properties: {
				category: { type: "string", enum: categoryEnum },
				scope: { type: "string", enum: searchScopeEnum },
				limit: { type: "number", description: "Max results (default 50)" },
				offset: { type: "number", description: "Pagination offset (default 0)" },
			},
		},
	},
	{
		name: "memory_stats",
		description: "Show memory counts grouped by category for the given scope.",
		inputSchema: {
			type: "object",
			properties: {
				scope: { type: "string", enum: searchScopeEnum },
			},
		},
	},
];

async function handleTool(name: string, args: Record<string, unknown>) {
	const db = getDb();
	const cwd = resolveCwd();

	switch (name) {
		case "remember": {
			const category = parseCategory(args.category);
			const title = asString(args.title).trim();
			const content = asString(args.content).trim();
			if (!title || !content) throw new Error("title and content are required");
			const scope = parseScope(args.scope, "project");
			const tags = asOptionalString(args.tags);

			const similar = findSimilarByTitle(db, scope, cwd, title);
			const memory = insertMemory(db, scope, cwd, category, title, content, tags);
			const warning =
				similar.length > 0
					? similar.map((m) => `#${m.id} [${m.scope}/${m.category}] "${m.title}"`).join("; ")
					: undefined;

			return text({
				stored: true,
				memory,
				scope,
				hasDuplicateWarning: Boolean(warning),
				duplicateWarning: warning,
			});
		}

		case "recall": {
			const query = asString(args.query).trim();
			if (!query) throw new Error("query is required");
			const scope = parseSearchScope(args.scope, "project");
			const category = asOptionalString(args.category);
			if (category && !isCategory(category)) throw new Error(`Invalid category "${category}"`);
			const results = searchMemories(db, scope, cwd, query, {
				category,
				tags: asOptionalString(args.tags),
				limit: asNumber(args.limit, 20),
			});
			return text({ results, scope, query, count: results.length });
		}

		case "update_memory": {
			const id = asNumber(args.id, Number.NaN);
			if (!Number.isFinite(id)) throw new Error("id is required");
			const scope = parseScope(args.scope);
			const existing = getMemoryById(db, id);
			if (!existing || !memoryMatchesScope(existing, scope, cwd)) {
				throw new Error(`Memory #${id} not found in ${scope} scope.`);
			}
			const category = asOptionalString(args.category);
			if (category && !isCategory(category)) throw new Error(`Invalid category "${category}"`);
			const updated = updateMemory(db, id, {
				title: asOptionalString(args.title),
				content: asOptionalString(args.content),
				tags: asOptionalString(args.tags),
				category: category as Category | undefined,
			});
			if (!updated) throw new Error(`Memory #${id} not found.`);
			return text({ memory: updated });
		}

		case "forget": {
			const id = asNumber(args.id, Number.NaN);
			if (!Number.isFinite(id)) throw new Error("id is required");
			const scope = parseScope(args.scope);
			const memory = getMemoryById(db, id);
			if (!memory || !memoryMatchesScope(memory, scope, cwd)) {
				throw new Error(`Memory #${id} not found in ${scope} scope.`);
			}
			deleteMemory(db, id);
			return text({ deleted: memory });
		}

		case "list_memories": {
			const scope = parseSearchScope(args.scope, "project");
			const category = asOptionalString(args.category);
			if (category && !isCategory(category)) throw new Error(`Invalid category "${category}"`);
			const memories = listMemories(db, scope, cwd, {
				category,
				limit: asNumber(args.limit, 50),
				offset: asNumber(args.offset, 0),
			});
			const total = getTotalCount(db, scope, cwd);
			return text({ memories, scope, total });
		}

		case "memory_stats": {
			const scope = parseSearchScope(args.scope, "project");
			const stats = getStats(db, scope, cwd);
			const total = getTotalCount(db, scope, cwd);
			return text({ stats, total, scope });
		}

		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

async function main(): Promise<void> {
	const server = new Server({ name: "click", version: VERSION }, { capabilities: { tools: {} } });

	server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const args = (request.params.arguments ?? {}) as Record<string, unknown>;
		try {
			return await handleTool(request.params.name, args);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return errorResult(message);
		}
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
