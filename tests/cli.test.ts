import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

describe("cli", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("exports from a path to stdout", () => {
    const output = runCli([
      "export",
      "--path",
      path.resolve("tests/fixtures/sample-rollout.jsonl"),
      "--messages-only",
      "--stdout",
    ]);

    expect(output).toContain("# Codex Conversation Export");
    expect(output).toContain("### Turn 1: Export this");
    expect(output).toContain("#### 👤 User Prompt");
    expect(output).toContain("#### 🤖 gpt-5.4");
    expect(output).not.toContain("Tool Call");
  });

  it("lists recent threads and exports by thread id", () => {
    const { dbPath, rolloutPath, outputDir } = createCliFixture();
    const env = {
      ...process.env,
      CODEX_STATE_DB_PATH: dbPath,
    };

    const listOutput = runCli(["list", "--limit", "5"], env);
    expect(listOutput).toContain("thread-new");

    const exportOutput = runCli(
      ["export", "thread-new", "--out", outputDir],
      env,
    ).trim();

    expect(fs.existsSync(exportOutput)).toBe(true);
    const markdown = fs.readFileSync(exportOutput, "utf8");
    expect(markdown).toContain("Rollout Path");
    expect(markdown).toContain(rolloutPath);
  });
});

function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("node", ["--import", "tsx", "./src/cli.ts", ...args], {
    cwd: path.resolve("."),
    env,
    encoding: "utf8",
  });
}

function createCliFixture(): {
  dbPath: string;
  rolloutPath: string;
  outputDir: string;
} {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-log-export-cli-"),
  );
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "state.sqlite");
  const rolloutPath = path.join(tempDir, "rollout.jsonl");
  const outputDir = path.join(tempDir, "exports");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    rolloutPath,
    [
      '{"timestamp":"2026-03-30T16:00:00.000Z","type":"session_meta","payload":{"id":"thread-new","timestamp":"2026-03-30T15:59:59.000Z","cwd":"/tmp/new","source":"vscode","model_provider":"openai","model":"gpt-5.4"}}',
      '{"timestamp":"2026-03-30T16:00:01.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Export this one"}]}}',
    ].join("\n"),
    "utf8",
  );

  execFileSync("sqlite3", [
    dbPath,
    `
      create table threads (
        id text primary key,
        rollout_path text not null,
        created_at integer not null,
        updated_at integer not null,
        source text not null,
        model_provider text not null,
        cwd text not null,
        title text not null,
        sandbox_policy text not null,
        approval_mode text not null,
        tokens_used integer not null default 0,
        has_user_event integer not null default 0,
        archived integer not null default 0,
        archived_at integer,
        git_sha text,
        git_branch text,
        git_origin_url text,
        cli_version text not null default '',
        first_user_message text not null default '',
        agent_nickname text,
        agent_role text,
        memory_mode text not null default 'enabled',
        model text,
        reasoning_effort text,
        agent_path text
      );
      insert into threads (
        id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,
        sandbox_policy, approval_mode, tokens_used, has_user_event, archived, model, reasoning_effort
      ) values
      ('thread-new', '${rolloutPath}', 1774900000, 1774900000, 'vscode', 'openai', '/tmp/new', 'New Title', 'danger-full-access', 'never', 0, 1, 0, 'gpt-5.4', 'high');
    `,
  ]);

  return { dbPath, rolloutPath, outputDir };
}
