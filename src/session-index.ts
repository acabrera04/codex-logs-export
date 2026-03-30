import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { DEFAULT_STATE_DB_PATH } from "./paths.js";
import type { SessionSummary } from "./types.js";

const execFileAsync = promisify(execFile);

interface ThreadRow {
  id: string;
  title: string;
  created_at: number;
  cwd: string;
  rollout_path: string;
  model_provider: string;
  model: string | null;
  reasoning_effort: string | null;
}

export interface ListSessionsOptions {
  dbPath?: string;
  limit?: number;
  since?: string;
}

export async function listSessions(
  options: ListSessionsOptions = {},
): Promise<SessionSummary[]> {
  const dbPath = options.dbPath ?? DEFAULT_STATE_DB_PATH;
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Codex state database not found: ${dbPath}`);
  }

  const conditions = ["archived = 0"];

  if (options.since) {
    const sinceEpoch = parseSinceDate(options.since);
    conditions.push(`created_at >= ${sinceEpoch}`);
  }

  const limit = options.limit ?? 20;

  const sql = `
    select id, title, created_at, cwd, rollout_path, model_provider, model, reasoning_effort
    from threads
    where ${conditions.join(" and ")}
    order by created_at desc, id desc
    limit ${limit}
  `;

  const rows = await queryRows(dbPath, sql);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at * 1000).toISOString(),
    createdAtEpoch: row.created_at,
    cwd: row.cwd,
    rolloutPath: row.rollout_path,
    modelProvider: row.model_provider,
    model: row.model ?? undefined,
    reasoningEffort: row.reasoning_effort ?? undefined,
  }));
}

export async function getSessionById(
  threadId: string,
  dbPath?: string,
): Promise<SessionSummary> {
  const resolvedDbPath = dbPath ?? DEFAULT_STATE_DB_PATH;
  if (!fs.existsSync(resolvedDbPath)) {
    throw new Error(`Codex state database not found: ${resolvedDbPath}`);
  }

  const escapedThreadId = escapeSqlString(threadId);
  const rows = await queryRows(
    resolvedDbPath,
    `
      select id, title, created_at, cwd, rollout_path, model_provider, model, reasoning_effort
      from threads
      where id = '${escapedThreadId}'
      limit 1
    `,
  );

  const match = rows[0];
  if (!match) {
    throw new Error(`Unknown thread id: ${threadId}`);
  }

  return {
    id: match.id,
    title: match.title,
    createdAt: new Date(match.created_at * 1000).toISOString(),
    createdAtEpoch: match.created_at,
    cwd: match.cwd,
    rolloutPath: match.rollout_path,
    modelProvider: match.model_provider,
    model: match.model ?? undefined,
    reasoningEffort: match.reasoning_effort ?? undefined,
  };
}

function parseSinceDate(raw: string): number {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid --since date: ${raw}`);
  }

  return Math.floor(parsed / 1000);
}

async function queryRows(dbPath: string, sql: string): Promise<ThreadRow[]> {
  const { stdout, stderr } = await execFileAsync(
    "sqlite3",
    ["-json", dbPath, sql],
    {
      encoding: "utf8",
    },
  );

  if (stderr.trim()) {
    throw new Error(stderr.trim());
  }

  if (!stdout.trim()) {
    return [];
  }

  return JSON.parse(stdout) as ThreadRow[];
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}
