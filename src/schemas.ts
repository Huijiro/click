import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { CATEGORIES, SCOPES, SEARCH_SCOPES } from "./types.js";

export const CategorySchema = StringEnum(CATEGORIES);
export const ScopeSchema = StringEnum(SCOPES);
export const SearchScopeSchema = StringEnum(SEARCH_SCOPES);

export const OptionalScope = Type.Optional(
	Type.Union([ScopeSchema], {
		description:
			'Memory scope: "project" (default) for project-specific knowledge, "user" for cross-project user knowledge',
		default: "project",
	}),
);

export const OptionalSearchScope = Type.Optional(
	Type.Union([SearchScopeSchema], {
		description:
			'Memory scope: "project" (default) for the current project, "user" for global user memories, "both" for both of those, or "all" for every project and user memory',
		default: "project",
	}),
);

export const MemorySchema = Type.Object({
	id: Type.Number(),
	scope: ScopeSchema,
	project: Type.Union([Type.String(), Type.Null()]),
	category: CategorySchema,
	title: Type.String(),
	content: Type.String(),
	tags: Type.Union([Type.String(), Type.Null()]),
	created_at: Type.String(),
	updated_at: Type.String(),
});
