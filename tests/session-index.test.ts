import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { getSessionById, listSessions } from "../src/session-index.js";

const tempDirs: string[] = [];

describe("session index", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("lists recent sessions from sqlite", async () => {
    const dbPath = createTempDb();

    const sessions = await listSessions({
      dbPath,
      limit: 10,
    });

    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe("thread-new");
    expect(sessions[1].id).toBe("thread-old");
  });

  it("filters by since date and resolves a thread by id", async () => {
    const dbPath = createTempDb();

    const recent = await listSessions({
      dbPath,
      since: "2026-03-29T00:00:00Z",
    });

    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe("thread-new");

    const session = await getSessionById("thread-old", dbPath);
    expect(session.rolloutPath).toBe("/tmp/old.jsonl");
  });
});

function createTempDb(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-log-export-"));
  tempDirs.push(tempDir);
  const dbPath = path.join(tempDir, "state.sqlite");

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
      ('thread-old', '/tmp/old.jsonl', 1774700000, 1774700000, 'vscode', 'openai', '/tmp/old', 'Old Title', 'danger-full-access', 'never', 0, 1, 0, 'gpt-5.4', 'medium'),
      ('thread-new', '/tmp/new.jsonl', 1774900000, 1774900000, 'vscode', 'openai', '/tmp/new', 'New Title', 'danger-full-access', 'never', 0, 1, 0, 'gpt-5.4', 'high');
    `,
  ]);

  return dbPath;
}
