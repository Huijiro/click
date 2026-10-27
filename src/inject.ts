import type { DatabaseSync } from "node:sqlite";
import { getOverviews, searchMemories } from "./db.js";
import type { Memory } from "./types.js";

/** Max characters for the entire auto-injected block (~4KB ≈ ~1K tokens) */
export const MAX_INJECT_CHARS = 4096;
/** Max overviews to inject */
export const MAX_OVERVIEWS = 5;
/** Max relevant (non-overview) memories to inject */
export const MAX_RELEVANT = 5;
/** Max characters per individual memory content in injection */
export const MAX_MEMORY_CONTENT_CHARS = 300;

export function truncateContent(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}…`;
}

export function formatMemoryBrief(m: Memory): string {
	return `- [#${m.id} ${m.scope}/${m.category}] ${m.title}: ${truncateContent(m.content, MAX_MEMORY_CONTENT_CHARS)}`;
}

export interface InjectOptions {
	/** Include FTS hits for this prompt. Omit/empty for overview-only injection. */
	prompt?: string;
	maxChars?: number;
	maxOverviews?: number;
	maxRelevant?: number;
}

/** Build the markdown block Click injects into agent context. */
export function buildMemoryInjectBlock(db: DatabaseSync, cwd: string, opts: InjectOptions = {}): string | undefined {
	const maxChars = opts.maxChars ?? MAX_INJECT_CHARS;
	const maxOverviews = opts.maxOverviews ?? MAX_OVERVIEWS;
	const maxRelevant = opts.maxRelevant ?? MAX_RELEVANT;
	const sections: string[] = [];
	let charBudget = maxChars;

	const overviews = getOverviews(db, cwd);
	const allOverviews = [...overviews.user, ...overviews.project].slice(0, maxOverviews);
	if (allOverviews.length > 0) {
		const overviewLines: string[] = [];
		for (const m of allOverviews) {
			const line = formatMemoryBrief(m);
			if (charBudget - line.length < 0) break;
			overviewLines.push(line);
			charBudget -= line.length + 1;
		}
		if (overviewLines.length > 0) {
			sections.push(`## Memory Overviews\n${overviewLines.join("\n")}`);
		}
	}

	const prompt = opts.prompt?.trim();
	if (prompt && charBudget > 100) {
		const results = searchMemories(db, "both", cwd, prompt, { limit: maxRelevant });
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
	}

	if (sections.length === 0) return undefined;
	return sections.join("\n\n");
}
