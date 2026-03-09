import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Category, Memory, MemoryStats, Scope, SearchScope } from "./types.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS memories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    scope      TEXT NOT NULL DEFAULT 'project',
    project    TEXT,
    category   TEXT NOT NULL,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    tags       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_memories_scope_project ON memories(scope, project);
  CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);

  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    title, content, tags, content=memories, content_rowid=id
  );

  CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, title, content, tags)
    VALUES (new.id, new.title, new.content, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
    VALUES ('delete', old.id, old.title, old.content, old.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
    VALUES ('delete', old.id, old.title, old.content, old.tags);
    INSERT INTO memories_fts(rowid, title, content, tags)
    VALUES (new.id, new.title, new.content, new.tags);
  END;
`;

function getDbPath(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
	return join(home, ".pi", "agent", "click", "memories.db");
}

let cachedDb: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
	if (cachedDb) return cachedDb;

	const path = getDbPath();
	mkdirSync(dirname(path), { recursive: true });

	const db = new DatabaseSync(path);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(SCHEMA);

	cachedDb = db;
	return db;
}

export function closeAll(): void {
	if (cachedDb) {
		try {
			cachedDb.close();
		} catch {
			// already closed
		}
		cachedDb = null;
	}
}

// --- Scope helpers ---

/** Build the WHERE clause fragment for scope + project filtering */
function scopeFilter(scope: SearchScope, cwd: string): { where: string; params: (string | null)[] } {
	if (scope === "user") {
		return { where: "scope = ?", params: ["user"] };
	}
	if (scope === "both") {
		return {
			where: "(scope = ? OR (scope = ? AND project = ?))",
			params: ["user", "project", cwd],
		};
	}
	// "project"
	return { where: "scope = ? AND project = ?", params: ["project", cwd] };
}

// --- Query helpers ---

export function insertMemory(
	db: DatabaseSync,
	scope: Scope,
	cwd: string,
	category: Category,
	title: string,
	content: string,
	tags?: string,
): Memory {
	const project = scope === "project" ? cwd : null;
	const stmt = db.prepare(
		"INSERT INTO memories (scope, project, category, title, content, tags) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
	);
	return stmt.get(scope, project, category, title, content, tags ?? null) as unknown as Memory;
}

export function searchMemories(
	db: DatabaseSync,
	scope: SearchScope,
	cwd: string,
	query: string,
	opts: { category?: string; tags?: string; limit?: number } = {},
): Memory[] {
	const limit = opts.limit ?? 20;
	const sf = scopeFilter(scope, cwd);

	const params: (string | number | null)[] = [query, ...sf.params];

	let sql = `
    SELECT d.*, bm25(memories_fts) as rank
    FROM memories_fts f
    JOIN memories d ON d.id = f.rowid
    WHERE memories_fts MATCH ? AND ${sf.where}
  `;

	if (opts.category) {
		sql += " AND d.category = ?";
		params.push(opts.category);
	}

	if (opts.tags) {
		const tagList = opts.tags.split(",").map((t) => t.trim());
		const tagConditions = tagList.map(() => "d.tags LIKE ?");
		sql += ` AND (${tagConditions.join(" OR ")})`;
		for (const tag of tagList) {
			params.push(`%${tag}%`);
		}
	}

	sql += " ORDER BY rank LIMIT ?";
	params.push(limit);

	return db.prepare(sql).all(...params) as unknown as Memory[];
}

/** Find memories with similar titles (for dedup checking) */
export function findSimilarByTitle(
	db: DatabaseSync,
	scope: Scope,
	cwd: string,
	title: string,
	limit: number = 3,
): Memory[] {
	const sf = scopeFilter(scope, cwd);
	const params: (string | number | null)[] = [title, ...sf.params, limit];

	const sql = `
    SELECT d.*, bm25(memories_fts) as rank
    FROM memories_fts f
    JOIN memories d ON d.id = f.rowid
    WHERE memories_fts MATCH ? AND ${sf.where}
    ORDER BY rank LIMIT ?
  `;

	return db.prepare(sql).all(...params) as unknown as Memory[];
}

export function listMemories(
	db: DatabaseSync,
	scope: SearchScope,
	cwd: string,
	opts: { category?: string; limit?: number; offset?: number } = {},
): Memory[] {
	const limit = opts.limit ?? 50;
	const offset = opts.offset ?? 0;
	const sf = scopeFilter(scope, cwd);

	let sql = `SELECT * FROM memories WHERE ${sf.where}`;
	const params: (string | number | null)[] = [...sf.params];

	if (opts.category) {
		sql += " AND category = ?";
		params.push(opts.category);
	}

	sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
	params.push(limit, offset);

	return db.prepare(sql).all(...params) as unknown as Memory[];
}

export function getMemoryById(db: DatabaseSync, id: number): Memory | undefined {
	return db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as unknown as Memory | undefined;
}

export function updateMemory(
	db: DatabaseSync,
	id: number,
	fields: { title?: string; content?: string; tags?: string; category?: Category },
): Memory | undefined {
	const existing = getMemoryById(db, id);
	if (!existing) return undefined;

	const title = fields.title ?? existing.title;
	const content = fields.content ?? existing.content;
	const tags = fields.tags ?? existing.tags;
	const category = fields.category ?? existing.category;

	db.prepare(
		"UPDATE memories SET title = ?, content = ?, tags = ?, category = ?, updated_at = datetime('now') WHERE id = ?",
	).run(title, content, tags, category, id);

	return getMemoryById(db, id);
}

export function deleteMemory(db: DatabaseSync, id: number): boolean {
	const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
	return result.changes > 0;
}

export function getStats(db: DatabaseSync, scope: SearchScope, cwd: string): MemoryStats[] {
	const sf = scopeFilter(scope, cwd);
	return db
		.prepare(`SELECT category, COUNT(*) as count FROM memories WHERE ${sf.where} GROUP BY category ORDER BY count DESC`)
		.all(...sf.params) as unknown as MemoryStats[];
}

export function getTotalCount(db: DatabaseSync, scope: SearchScope, cwd: string): number {
	const sf = scopeFilter(scope, cwd);
	const row = db.prepare(`SELECT COUNT(*) as total FROM memories WHERE ${sf.where}`).get(...sf.params) as unknown as {
		total: number;
	};
	return row.total;
}

/** Load overview memories for session start context injection */
export function getOverviews(db: DatabaseSync, cwd: string): { project: Memory[]; user: Memory[] } {
	const projectOverviews = db
		.prepare(
			"SELECT * FROM memories WHERE category = 'overview' AND scope = 'project' AND project = ? ORDER BY updated_at DESC",
		)
		.all(cwd) as unknown as Memory[];
	const userOverviews = db
		.prepare("SELECT * FROM memories WHERE category = 'overview' AND scope = 'user' ORDER BY updated_at DESC")
		.all() as unknown as Memory[];
	return { project: projectOverviews, user: userOverviews };
}
