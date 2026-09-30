import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
	buildFtsQuery,
	initializeDatabase,
	insertMemory,
	listMemories,
	memoryMatchesScope,
	searchMemories,
} from "./db.js";

test("buildFtsQuery treats natural-language punctuation as text", () => {
	assert.equal(buildFtsQuery("agentuity-dev MCP"), '"agentuity" OR "dev" OR "mcp"');
	assert.equal(buildFtsQuery("what's the status?"), '"status"');
	assert.equal(buildFtsQuery("---"), undefined);
});

test("all scope lists and searches memories from every project", () => {
	const db = new DatabaseSync(":memory:");
	initializeDatabase(db);

	insertMemory(db, "project", "/projects/one", "decision", "Use Postgres", "Project one database");
	insertMemory(db, "project", "/projects/two", "decision", "Use SQLite", "Project two database");
	insertMemory(db, "user", "/projects/one", "preference", "Keep it concise", "Prefer short responses");

	assert.equal(listMemories(db, "both", "/projects/one").length, 2);
	assert.equal(listMemories(db, "all", "/projects/one").length, 3);
	assert.equal(searchMemories(db, "all", "/projects/one", "project").length, 2);

	db.close();
});

test("memoryMatchesScope prevents cross-project mutation", () => {
	const db = new DatabaseSync(":memory:");
	initializeDatabase(db);

	const projectMemory = insertMemory(
		db,
		"project",
		"/projects/one",
		"fact",
		"Project fact",
		"Only project one may change this",
	);
	const userMemory = insertMemory(db, "user", "/projects/one", "preference", "User preference", "Global");

	assert.equal(memoryMatchesScope(projectMemory, "project", "/projects/one"), true);
	assert.equal(memoryMatchesScope(projectMemory, "project", "/projects/two"), false);
	assert.equal(memoryMatchesScope(projectMemory, "user", "/projects/one"), false);
	assert.equal(memoryMatchesScope(userMemory, "user", "/projects/two"), true);

	db.close();
});
