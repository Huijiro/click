// src/db.ts
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
var SCHEMA = `
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
function initializeDatabase(db) {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
}
function resolveDbPath(override) {
  if (override) return override;
  if (process.env.CLICK_DB_PATH) return process.env.CLICK_DB_PATH;
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  return join(agentDir, "click", "memories.db");
}
var cachedDb = null;
var cachedDbPath = null;
function getDb(pathOverride) {
  const path = resolveDbPath(pathOverride);
  if (cachedDb && cachedDbPath === path) return cachedDb;
  if (cachedDb) closeAll();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  initializeDatabase(db);
  cachedDb = db;
  cachedDbPath = path;
  return db;
}
function closeAll() {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
    }
    cachedDb = null;
    cachedDbPath = null;
  }
}
function scopeFilter(scope, cwd) {
  if (scope === "all") {
    return { where: "1 = 1", params: [] };
  }
  if (scope === "user") {
    return { where: "scope = ?", params: ["user"] };
  }
  if (scope === "both") {
    return {
      where: "(scope = ? OR (scope = ? AND project = ?))",
      params: ["user", "project", cwd]
    };
  }
  return { where: "scope = ? AND project = ?", params: ["project", cwd] };
}
var SEARCH_STOP_WORDS = /* @__PURE__ */ new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "could",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "my",
  "of",
  "on",
  "our",
  "should",
  "that",
  "the",
  "this",
  "to",
  "use",
  "using",
  "was",
  "we",
  "were",
  "what",
  "with",
  "would",
  "you"
]);
function buildFtsQuery(query) {
  const tokens = query.match(/[\p{L}\p{N}_]+/gu)?.map((token) => token.toLocaleLowerCase());
  if (!tokens || tokens.length === 0) return void 0;
  const meaningfulTokens = tokens.filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
  const uniqueTokens = [...new Set(meaningfulTokens.length > 0 ? meaningfulTokens : tokens)];
  return uniqueTokens.slice(0, 32).map((token) => `"${token}"`).join(" OR ");
}
function searchMemories(db, scope, cwd, query, opts = {}) {
  const limit = opts.limit ?? 20;
  const sf = scopeFilter(scope, cwd);
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];
  const params = [ftsQuery, ...sf.params];
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
  return db.prepare(sql).all(...params);
}
function getOverviews(db, cwd) {
  const projectOverviews = db.prepare(
    "SELECT * FROM memories WHERE category = 'overview' AND scope = 'project' AND project = ? ORDER BY updated_at DESC"
  ).all(cwd);
  const userOverviews = db.prepare("SELECT * FROM memories WHERE category = 'overview' AND scope = 'user' ORDER BY updated_at DESC").all();
  return { project: projectOverviews, user: userOverviews };
}

// src/inject.ts
var MAX_INJECT_CHARS = 4096;
var MAX_OVERVIEWS = 5;
var MAX_RELEVANT = 5;
var MAX_MEMORY_CONTENT_CHARS = 300;
function truncateContent(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\u2026`;
}
function formatMemoryBrief(m) {
  return `- [#${m.id} ${m.scope}/${m.category}] ${m.title}: ${truncateContent(m.content, MAX_MEMORY_CONTENT_CHARS)}`;
}
function buildMemoryInjectBlock(db, cwd, opts = {}) {
  const maxChars = opts.maxChars ?? MAX_INJECT_CHARS;
  const maxOverviews = opts.maxOverviews ?? MAX_OVERVIEWS;
  const maxRelevant = opts.maxRelevant ?? MAX_RELEVANT;
  const sections = [];
  let charBudget = maxChars;
  const overviews = getOverviews(db, cwd);
  const allOverviews = [...overviews.user, ...overviews.project].slice(0, maxOverviews);
  if (allOverviews.length > 0) {
    const overviewLines = [];
    for (const m of allOverviews) {
      const line = formatMemoryBrief(m);
      if (charBudget - line.length < 0) break;
      overviewLines.push(line);
      charBudget -= line.length + 1;
    }
    if (overviewLines.length > 0) {
      sections.push(`## Memory Overviews
${overviewLines.join("\n")}`);
    }
  }
  const prompt = opts.prompt?.trim();
  if (prompt && charBudget > 100) {
    const results = searchMemories(db, "both", cwd, prompt, { limit: maxRelevant });
    const relevant = results.filter((m) => m.category !== "overview");
    if (relevant.length > 0) {
      const relevantLines = [];
      for (const m of relevant) {
        const line = formatMemoryBrief(m);
        if (charBudget - line.length < 0) break;
        relevantLines.push(line);
        charBudget -= line.length + 1;
      }
      if (relevantLines.length > 0) {
        sections.push(`## Relevant Memories
${relevantLines.join("\n")}`);
      }
    }
  }
  if (sections.length === 0) return void 0;
  return sections.join("\n\n");
}

// scripts/inject-overviews-impl.ts
function resolveCwd(payload) {
  const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
  if (typeof roots[0] === "string" && roots[0].length > 0) return roots[0];
  if (typeof payload.cwd === "string" && payload.cwd.length > 0) return payload.cwd;
  if (process.env.CLICK_CWD) return process.env.CLICK_CWD;
  return process.cwd();
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
async function main() {
  try {
    const raw = await readStdin();
    const payload = raw.trim() ? JSON.parse(raw) : {};
    const cwd = resolveCwd(payload);
    process.env.CLICK_CWD = cwd;
    const db = getDb();
    const block = buildMemoryInjectBlock(db, cwd);
    closeAll();
    if (!block) {
      process.stdout.write("{}\n");
      return;
    }
    process.stdout.write(
      `${JSON.stringify({
        additional_context: `## click_memories

${block}`
      })}
`
    );
  } catch (err) {
    console.error(`[click inject-overviews] ${err instanceof Error ? err.message : err}`);
    process.stdout.write("{}\n");
  }
}
await main();
