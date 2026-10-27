# Click

> *"It's a universal remote that is programmed to your preferences... it learns your patterns."* — Morty, Click (2006)

A [Pi](https://github.com/earendil-works/pi) extension (and MCP server) that gives your AI agent persistent memory across sessions. Memories are stored in a local SQLite database with FTS5 full-text search and automatically injected as context at the start of each Pi conversation — so the agent already knows your project conventions, past decisions, and personal preferences before you say anything. The same database is available to Cursor and other MCP clients via `click-mcp`.

## Features

- **Persistent memory** — Survives across sessions. No more re-explaining your project setup.
- **Full-text search** — FTS5-powered search across titles, content, and tags.
- **Scoped memories** — `project` scope for codebase-specific knowledge (tied to cwd), `user` scope for cross-project preferences, and explicit all-project queries for maintenance.
- **Auto-injection** — Relevant memories are automatically surfaced before each agent turn based on the user's prompt.
- **Duplicate detection** — Warns when storing a memory with a similar title to an existing one.
- **9 categories** — `fact`, `decision`, `preference`, `snippet`, `todo`, `lesson`, `pattern`, `convention`, `overview`.
- **Zero config** — Just install and go. Database is created automatically at `~/.pi/agent/click/memories.db`.

## Install

Install it with Pi:

```bash
pi install git:github.com/Huijiro/click
```

Use `pi install -l git:github.com/Huijiro/click` to install it for the current project only.

### Cursor plugin

This repo is also a Cursor plugin (`.cursor-plugin/plugin.json` + `marketplace.json`). It bundles:

- **MCP server** — the same six memory tools
- **`sessionStart` hook** — injects overview memories as `additional_context`
- **Skill + rule** — when/how to remember and recall

Cursor treats a local folder as a **marketplace**, not an installed plugin. Indexing alone is not enough — you still have to **Install** Click from that marketplace.

**Local checkout (recommended while developing):**

1. `npm install` in this repo (needed for `click-mcp` / `tsx`).
2. In Cursor: **Customize → Plugins → Add local marketplace / folder** → pick this repo.
3. In that marketplace, **Install** the `click` plugin (not just add the folder).
4. Reload Cursor if the MCP tools do not appear.

Dev shortcut: symlink the checkout into Cursor's local plugin dir so it auto-loads:

```bash
ln -sfn "$PWD" ~/.cursor/plugins/local/click
```

Then reload Cursor. Tools should show as `plugin-click-click`.

Pi auto-injects overviews **and** prompt-relevant FTS hits each turn. Cursor injects **overviews at session start** only; call `recall` for prompt-relevant search (no Cursor inject hook for that yet).

### Cursor / MCP (manual)

Without the plugin, point Cursor at a local checkout:

```json
{
  "mcpServers": {
    "click": {
      "command": "node",
      "args": ["/absolute/path/to/click/bin/click-mcp.mjs"],
      "env": {
        "CLICK_CWD": "/absolute/path/to/your/project"
      }
    }
  }
}
```

Optional env:

| Variable | Purpose |
|----------|---------|
| `CLICK_DB_PATH` | Override SQLite path (default `~/.pi/agent/click/memories.db`, or `$PI_CODING_AGENT_DIR/click/memories.db`) |
| `CLICK_CWD` | Project path used for `project`-scoped memories (default: process cwd) |
| `PI_CODING_AGENT_DIR` | Same agent-dir override Pi uses; Click honors it when resolving the default DB path |

## Tools

Click registers six tools that the agent can use. Each tool also returns structured data for Pi codemode scripts:

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

Search and listing tools accept `both` for the current project plus user memories, or `all` for every stored memory. Mutation tools intentionally limit project-scoped changes to the current working directory.

### Auto-injection

Before each agent turn, Click:

1. Loads all `overview` memories (project + user) — these are high-level summaries meant to always be present.
2. Searches for memories relevant to the current prompt using FTS5.
3. Adds both to Pi's structured system prompt sections, capped at ~4KB. Pi updates the section when recalled memories change instead of appending another message to the conversation.

The agent receives this in a `click_memories` system prompt section with brief summaries. It doesn't need to call any tools to benefit from existing memories.

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

# Smoke-test MCP + sessionStart inject
npm run mcp:smoke
npm run inject:smoke
```

### Project structure

```
.cursor-plugin/plugin.json  # Cursor plugin manifest
mcp.json                    # Plugin MCP entry (click-mcp)
hooks/hooks.json            # sessionStart → overview inject
rules/click-memory.mdc      # Always-on Cursor guidance
skills/click-memory/        # Deeper remember/recall skill
bin/click-mcp.mjs           # MCP launcher (runs TS via tsx)
scripts/inject-overviews.mjs      # sessionStart launcher
scripts/inject-overviews-impl.ts # overview inject body
src/
├── index.ts        # Pi extension entry (tools + auto-injection)
├── inject.ts       # Shared memory inject-block builder
├── db.ts           # SQLite database, schema, queries
├── types.ts        # Category/scope types (host-agnostic)
├── schemas.ts      # TypeBox schemas for Pi tools
├── mcp/server.ts   # MCP stdio server (same six tools)
└── tools/          # Pi tool registrations
```

## License

MIT
