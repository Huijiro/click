import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { CategorySchema, OptionalScope, type Scope } from "../types.js";
import { getDb, insertMemory, findSimilarByTitle } from "../db.js";

export function registerRememberTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "remember",
    label: "Remember",
    description:
      "Store a new memory. Use this to save facts, decisions, preferences, code snippets, lessons learned, patterns, conventions, overviews, or todos for future reference. Will warn if similar memories already exist.",
    promptSnippet:
      "Store a new memory (fact, decision, preference, snippet, todo, lesson, pattern, convention, overview)",
    promptGuidelines: [
      "Use `remember` when the user states a preference, makes a decision, establishes a convention, or corrects you.",
      "Use `remember` to save important project facts, lessons learned from mistakes, and recurring patterns.",
      "Choose the most specific category: 'preference' for user likes/dislikes, 'decision' for architectural choices, 'convention' for team rules, 'lesson' for things learned from errors.",
      "Use category 'overview' for high-level project or user summaries that should be loaded at the start of every session.",
      "Write memory content to be useful when retrieved later — include context and reasoning, not just the conclusion.",
      'Use scope "user" for things about the person (preferences, habits, style) that apply across projects. Use scope "project" for things specific to this codebase.',
      "If the tool warns about potential duplicates, prefer using `update_memory` on the existing one instead of creating a new entry.",
    ],
    parameters: Type.Object({
      category: CategorySchema,
      title: Type.String({ description: "Short descriptive title for the memory" }),
      content: Type.String({
        description: "The memory content — be specific and include context",
      }),
      tags: Type.Optional(
        Type.String({
          description: "Comma-separated tags for filtering (e.g. 'typescript,api,auth')",
        })
      ),
      scope: OptionalScope,
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope: Scope = params.scope ?? "project";
      const db = getDb();

      // Check for potential duplicates
      let dupWarning = "";
      try {
        const similar = findSimilarByTitle(db, scope, ctx.cwd, params.title);
        if (similar.length > 0) {
          const dupList = similar
            .map((m) => `  #${m.id} [${m.scope}/${m.category}] "${m.title}"`)
            .join("\n");
          dupWarning = `\n\n⚠ Potential duplicates found — consider using update_memory instead:\n${dupList}`;
        }
      } catch {
        // FTS match can fail on certain inputs, proceed with insert
      }

      const memory = insertMemory(db, scope, ctx.cwd, params.category, params.title, params.content, params.tags);

      return {
        content: [
          {
            type: "text",
            text: `Stored memory #${memory.id} [${scope}/${memory.category}]: "${memory.title}"${dupWarning}`,
          },
        ],
        details: { memory, scope, hasDuplicateWarning: dupWarning.length > 0 },
      };
    },
  });
}
