---
name: click-memory
description: Use Click persistent memory (remember/recall/update/forget) for project conventions, decisions, preferences, and lessons across Cursor sessions. Trigger when saving or retrieving durable context, or when the user mentions memory/preferences/past decisions.
---

# Click memory

Click stores durable context in a local SQLite DB shared with the Pi Click extension (`~/.pi/agent/click/memories.db` by default).

## Tools

| Tool | Use for |
|------|---------|
| `remember` | Save a new memory |
| `recall` | Full-text search |
| `update_memory` | Edit an existing memory by ID |
| `forget` | Delete a memory by ID |
| `list_memories` | Browse with optional category filter |
| `memory_stats` | Counts by category |

## When to remember

- User states a preference, decision, convention, or correction
- You learn a project fact that will matter in later sessions
- A debugging lesson or recurring pattern should stick

Write content with enough context to be useful later — not just a one-line conclusion.

## Categories

Pick the most specific:

- `overview` — high-level project/user summary (auto-injected at session start)
- `preference` — likes/dislikes, style
- `decision` — architectural choices and why
- `convention` — team rules, naming, standards
- `lesson` — mistakes / debugging takeaways
- `pattern` — recurring workflows
- `fact` — objective project info
- `snippet` — reusable fragments
- `todo` — tracked tasks

## Scope

- `project` (default) — tied to the current workspace path
- `user` — cross-project personal knowledge
- Search with `both` when either may apply; use `all` only for maintenance

If `remember` warns about duplicates, prefer `update_memory` on the existing ID.

## Recall

Cursor injects **overview** memories at session start. It does **not** auto-search on every prompt (Pi does). Call `recall` when past context might matter — start broad, then narrow with category/tags/scope.
