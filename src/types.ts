import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

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
export const SEARCH_SCOPES = ["project", "user", "both"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export const CategorySchema = StringEnum(CATEGORIES);
export const ScopeSchema = StringEnum(SCOPES);
export const SearchScopeSchema = StringEnum(SEARCH_SCOPES);

export const OptionalScope = Type.Optional(
  Type.Union([ScopeSchema], {
    description:
      'Memory scope: "project" (default) for project-specific knowledge, "user" for cross-project user knowledge',
    default: "project",
  })
);

export const OptionalSearchScope = Type.Optional(
  Type.Union([SearchScopeSchema], {
    description:
      'Memory scope: "project" (default) for project-specific, "user" for cross-project, "both" to search all',
    default: "project",
  })
);

export interface Memory {
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

export interface MemoryStats {
  category: string;
  count: number;
}
