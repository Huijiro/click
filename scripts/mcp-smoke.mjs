import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dir = mkdtempSync(join(tmpdir(), "click-mcp-"));
const dbPath = join(dir, "memories.db");
const project = join(dir, "project");

const transport = new StdioClientTransport({
	command: "node",
	args: ["--import", "tsx", new URL("../src/mcp/server.ts", import.meta.url).pathname],
	env: {
		...process.env,
		CLICK_DB_PATH: dbPath,
		CLICK_CWD: project,
	},
});

const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log(
	"tools:",
	tools.tools
		.map((t) => t.name)
		.sort()
		.join(","),
);

const remembered = await client.callTool({
	name: "remember",
	arguments: {
		category: "fact",
		title: "MCP smoke",
		content: "MCP server can write memories",
		scope: "project",
	},
});
console.log("remember ok:", JSON.stringify(remembered).includes("MCP smoke"));

const recalled = await client.callTool({
	name: "recall",
	arguments: { query: "smoke", scope: "project" },
});
console.log("recall ok:", JSON.stringify(recalled).includes("MCP smoke"));

await client.close();
rmSync(dir, { recursive: true, force: true });
