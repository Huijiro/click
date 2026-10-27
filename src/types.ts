export const CATEGORIES = [
	"fact",
	"decision",
	"preference",
	"snippet",
	"todo",
	"lesson",
	"pattern",
	"convention",
	"overview",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** "project" = about this codebase (tied to cwd), "user" = about the user (cross-project) */
export const SCOPES = ["project", "user"] as const;
export type Scope = (typeof SCOPES)[number];

/** Extended scopes including "both" for search operations */
export const SEARCH_SCOPES = ["project", "user", "both", "all"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export interface Memory {
	[key: string]: string | number | null;
	id: number;
	scope: Scope;
	project: string | null;
	category: Category;
	title: string;
	content: string;
	tags: string | null;
	created_at: string;
	updated_at: string;
}

export const MEMORY_NAMESPACE = {
	name: "click",
	description: "Persistent project and user memory",
} as const;

export interface MemoryStats {
	[key: string]: string | number;
	category: string;
	count: number;
}

export function isCategory(value: string): value is Category {
	return (CATEGORIES as readonly string[]).includes(value);
}

export function isScope(value: string): value is Scope {
	return (SCOPES as readonly string[]).includes(value);
}

export function isSearchScope(value: string): value is SearchScope {
	return (SEARCH_SCOPES as readonly string[]).includes(value);
}
