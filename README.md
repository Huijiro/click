# Click

> *"It's a universal remote that is programmed to your preferences... it learns your patterns."* — Morty, Click (2006)

A [pi](https://github.com/badlogic/pi-mono) extension that gives your AI agent persistent memory across sessions. Memories are stored in a local SQLite database with FTS5 full-text search and automatically injected as context at the start of each conversation — so the agent already knows your project conventions, past decisions, and personal preferences before you say anything.

## Features

- **Persistent memory** — Survives across sessions. No more re-explaining your project setup.
- **Full-text search** — FTS5-powered search across titles, content, and tags.
- **Scoped memories** — `project` scope for codebase-specific knowledge (tied to cwd), `user` scope for cross-project preferences.
- **Auto-injection** — Relevant memories are automatically surfaced before each agent turn based on the user's prompt.
- **Duplicate detection** — Warns when storing a memory with a similar title to an existing one.
- **9 categories** — `fact`, `decision`, `preference`, `snippet`, `todo`, `lesson`, `pattern`, `convention`, `overview`.
- **Zero config** — Just install and go. Database is created automatically at `~/.pi/agent/click/memories.db`.

## Install

```bash
pi install click
```

Or add it manually to your project's `.pi/packages.json`:

```json
{
  "packages": [
    { "name": "click", "path": "/path/to/click" }
  ]
}
```

## Tools

Click registers six tools that the agent can use:

| Tool | Description |
|------|-------------|
| `remember` | Store a new memory with a category, title, content, and optional tags |
| `recall` | Search memories by keyword query with optional category/tag/scope filters |
| `update_memory` | Update an existing memory's title, content, tags, or category by ID |
| `forget` | Permanently delete a memory by ID |
| `list_memories` | List memories with optional category filter and pagination |
| `memory_stats` | Show memory counts grouped by category |

## How it works

### Storage

All memories live in a single SQLite database at `~/.pi/agent/click/memories.db`. The schema uses WAL mode for performance and FTS5 virtual tables for full-text search. No external services, no network calls.

### Scoping

Each memory has a scope:

- **`project`** — Tied to the working directory. Only surfaces when you're in the same project.
- **`user`** — Global. Applies everywhere. Use for personal preferences, habits, and cross-project knowledge.

### Auto-injection

Before each agent turn, Click:

1. Loads all `overview` memories (project + user) — these are high-level summaries meant to always be present.
2. Searches for memories relevant to the current prompt using FTS5.
3. Injects both as a context block appended to the conversation, capped at ~4KB to stay token-efficient.

The agent sees this as a `# Recalled Memories (auto-injected)` section with brief summaries. It doesn't need to call any tools to benefit from existing memories.

### Categories

| Category | Use for |
|----------|---------|
| `overview` | High-level project or user summaries. Always injected at session start. |
| `fact` | Objective information about the project or environment |
| `decision` | Architectural choices and their reasoning |
| `preference` | User likes/dislikes and style preferences |
| `convention` | Team rules, coding standards, naming patterns |
| `lesson` | Things learned from mistakes or debugging |
| `pattern` | Recurring code patterns or workflows |
| `snippet` | Reusable code fragments |
| `todo` | Tasks to track |

## Development

```bash
# Install dependencies
npm install

# Type-check and lint
npm run check

# Auto-format
npm run format
```

### Project structure

```
src/
├── index.ts        # Extension entry point, event hooks, auto-injection logic
├── db.ts           # SQLite database, schema, queries
├── types.ts        # Category/scope types and TypeBox schemas
└── tools/
    ├── remember.ts # Store new memories
    ├── recall.ts   # Search memories (FTS5)
    ├── update.ts   # Update existing memories
    ├── forget.ts   # Delete memories
    ├── list.ts     # List/browse memories
    └── stats.ts    # Memory count stats
```

## License

MIT
