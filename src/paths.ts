import os from "node:os";
import path from "node:path";

export const DEFAULT_STATE_DB_PATH = path.join(
  process.env.CODEX_STATE_DB_PATH ??
    path.join(os.homedir(), ".codex", "state_5.sqlite"),
);

export const DEFAULT_SESSIONS_DIR = path.join(
  os.homedir(),
  ".codex",
  "sessions",
);
