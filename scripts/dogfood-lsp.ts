/**
 * @file Spawns dist/server/index.js as a subprocess, talks real LSP
 * protocol to it via stdin/stdout, and reports the diagnostics the
 * server publishes for a few files in THIS repo. End-to-end smoke
 * test of the LSP plugin against the agent-code-guard codebase itself.
 *
 * Run: pnpm build && pnpm tsx scripts/dogfood-lsp.ts
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = path.resolve(import.meta.dirname, "..");
const LSP_BIN = path.join(REPO, "dist/server/index.js");

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

class LspClient {
  readonly #proc;
  readonly #pending = new Map<number, PendingRequest>();
  #nextId = 1;
  #buffer = Buffer.alloc(0);
  readonly diagnostics: Array<{ uri: string; diagnostics: ReadonlyArray<unknown> }> = [];

  constructor() {
    this.#proc = spawn("node", [LSP_BIN], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.#proc.stdout.on("data", (chunk: Buffer) => this.#handleChunk(chunk));
    this.#proc.on("exit", (code) => {
      if (code !== null && code !== 0) console.error(`LSP exited with ${code}`);
    });
  }

  send(method: string, params: unknown, isRequest: boolean): Promise<unknown> {
    if (isRequest) {
      const id = this.#nextId++;
      const message: JsonRpcMessage = { jsonrpc: "2.0", id, method, params };
      this.#write(message);
      return new Promise((resolve, reject) => {
        this.#pending.set(id, { resolve, reject });
      });
    }
    this.#write({ jsonrpc: "2.0", method, params });
    return Promise.resolve(undefined);
  }

  shutdown(): void {
    this.#proc.kill();
  }

  #write(message: JsonRpcMessage): void {
    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.#proc.stdin.write(header + body);
  }

  #handleChunk(chunk: Buffer): void {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    while (true) {
      const headerEnd = this.#buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.#buffer.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length: (\d+)/.exec(header);
      if (match === null) {
        this.#buffer = this.#buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (this.#buffer.length < bodyStart + length) return;
      const body = this.#buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.#buffer = this.#buffer.subarray(bodyStart + length);
      this.#dispatch(JSON.parse(body) as JsonRpcMessage);
    }
  }

  #dispatch(msg: JsonRpcMessage): void {
    if (msg.method === "textDocument/publishDiagnostics" && msg.params !== undefined) {
      this.diagnostics.push(msg.params as { uri: string; diagnostics: ReadonlyArray<unknown> });
      return;
    }
    if (typeof msg.id === "number") {
      const pending = this.#pending.get(msg.id);
      if (pending !== undefined) {
        this.#pending.delete(msg.id);
        if (msg.error !== undefined) pending.reject(msg.error);
        else pending.resolve(msg.result);
      }
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("==> spawning LSP server:", LSP_BIN);
  const client = new LspClient();

  try {
    console.log("==> sending initialize for", REPO);
    const initResult = await client.send(
      "initialize",
      {
        processId: process.pid,
        capabilities: {},
        rootUri: pathToFileURL(REPO).toString(),
        workspaceFolders: [
          { uri: pathToFileURL(REPO).toString(), name: "agent-code-guard" },
        ],
      },
      true,
    );
    console.log("    initialize result:", JSON.stringify(initResult, null, 2).slice(0, 200), "...");
    await client.send("initialized", {}, false);

    const targets = [
      "src/index.ts",
      "src/server/lsp-server.ts",
      "src/server/workspace-engine.ts",
      "src/rules/architecture/index.ts",
    ];

    for (const rel of targets) {
      const filePath = path.join(REPO, rel);
      const uri = pathToFileURL(filePath).toString();
      console.log(`==> didOpen ${rel}`);
      await client.send(
        "textDocument/didOpen",
        {
          textDocument: {
            uri,
            languageId: "typescript",
            version: 1,
            text: "",
          },
        },
        false,
      );
    }

    // Wait for the analyzer's cold build + first batch of publishDiagnostics.
    console.log("==> waiting up to 15s for diagnostics ...");
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && client.diagnostics.length < targets.length) {
      await sleep(200);
    }

    console.log(`\n==> received ${client.diagnostics.length} publishDiagnostics events:\n`);
    for (const pub of client.diagnostics) {
      const rel = path.relative(REPO, pub.uri.replace("file://", ""));
      console.log(`  ${rel}: ${pub.diagnostics.length} diagnostics`);
      for (const d of pub.diagnostics) {
        const { code, message, severity } = d as { code: string; message: string; severity: number };
        const sev = severity === 1 ? "ERROR" : "WARN";
        console.log(`    [${sev}] ${code}`);
        console.log(`           ${message.slice(0, 140)}${message.length > 140 ? "…" : ""}`);
      }
    }
  } finally {
    client.shutdown();
  }
}

await main();
