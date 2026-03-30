import path from "node:path";

import type { ParsedTranscript, TranscriptEntry } from "./types.js";

type MessageRole = Extract<TranscriptEntry, { kind: "message" }>["role"];

export function renderMarkdown(transcript: ParsedTranscript): string {
  const lines: string[] = [];
  const metadata = transcript.metadata;

  lines.push("# Codex Conversation Export");
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  pushMetadataLine(lines, "Thread ID", metadata.id || "unknown");
  pushMetadataLine(lines, "Timestamp", metadata.timestamp || "unknown");
  pushMetadataLine(lines, "CWD", metadata.cwd || "unknown");
  pushMetadataLine(lines, "Source", metadata.source || "unknown");
  pushMetadataLine(
    lines,
    "Model Provider",
    metadata.modelProvider || "unknown",
  );
  pushMetadataLine(lines, "Model", metadata.model || "unknown");
  pushMetadataLine(
    lines,
    "Reasoning Effort",
    metadata.reasoningEffort || "unknown",
  );
  pushMetadataLine(lines, "Rollout Path", metadata.rolloutPath || "unknown");
  lines.push("");

  if (transcript.entries.length === 0) {
    lines.push("_No transcript entries found._");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Transcript");
  lines.push("");
  renderTranscriptByTurn(lines, transcript);

  return lines.join("\n");
}

export function buildDefaultOutputPath(
  transcript: ParsedTranscript,
  explicitOutPath?: string,
): string {
  const fileName = buildDefaultFilename(transcript);
  if (!explicitOutPath) {
    return path.resolve(process.cwd(), fileName);
  }

  if (path.extname(explicitOutPath)) {
    return path.resolve(explicitOutPath);
  }

  return path.resolve(explicitOutPath, fileName);
}

export function buildDefaultFilename(transcript: ParsedTranscript): string {
  const timestamp = transcript.metadata.timestamp
    ? transcript.metadata.timestamp.slice(0, 10)
    : "unknown-date";
  const titleSource =
    transcript.metadata.title ?? transcript.metadata.id ?? "codex-session";
  const title =
    sanitizeForFilename(titleSource).slice(0, 60) || "codex-session";
  const shortId = (transcript.metadata.id || "unknown").slice(0, 8);

  return `${timestamp}-${title}-${shortId}.md`;
}

export function formatSessionList(
  sessions: {
    id: string;
    createdAt: string;
    title: string;
    cwd: string;
    rolloutPath: string;
  }[],
): string {
  if (sessions.length === 0) {
    return "No sessions found.";
  }

  const lines = sessions.map(
    (session) =>
      `${session.id}\t${session.createdAt}\t${session.title}\t${session.cwd}\t${session.rolloutPath}`,
  );

  return ["THREAD_ID\tCREATED_AT\tTITLE\tCWD\tROLLOUT_PATH", ...lines].join(
    "\n",
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pushMetadataLine(lines: string[], label: string, value: string): void {
  lines.push(`- ${label}: ${value}`);
}

export function sanitizeForFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderTranscriptByTurn(
  lines: string[],
  transcript: ParsedTranscript,
): void {
  const { entries, metadata } = transcript;
  const prelude: TranscriptEntry[] = [];
  const turns: TranscriptEntry[][] = [];
  let currentTurn: TranscriptEntry[] | null = null;

  for (const entry of entries) {
    if (entry.kind === "message" && entry.role === "user") {
      currentTurn = [entry];
      turns.push(currentTurn);
      continue;
    }

    if (currentTurn) {
      currentTurn.push(entry);
    } else {
      prelude.push(entry);
    }
  }

  if (prelude.length > 0) {
    lines.push("### Prelude");
    lines.push("");
    lines.push(
      "_Entries recorded before the first user prompt in the selected transcript._",
    );
    lines.push("");
    prelude.forEach((entry) => renderEntry(lines, entry, metadata));
  }

  turns.forEach((turnEntries, index) => {
    const [prompt, ...rest] = turnEntries;
    const turnTitle =
      prompt && prompt.kind === "message"
        ? buildTurnTitle(index + 1, prompt.text)
        : `Turn ${index + 1}`;

    lines.push(`### ${turnTitle}`);
    lines.push("");

    if (prompt && prompt.kind === "message") {
      lines.push("#### 👤 User Prompt");
      lines.push("");
      if (prompt.timestamp) {
        lines.push(`- Time: ${prompt.timestamp}`);
        lines.push("");
      }
      lines.push("```text");
      lines.push(prompt.text.trimEnd());
      lines.push("```");
      lines.push("");
    }

    if (rest.length === 0) {
      lines.push("_No assistant or tool activity recorded after this prompt._");
      lines.push("");
      return;
    }

    rest.forEach((entry) => renderEntry(lines, entry, metadata));
  });
}

function renderEntry(
  lines: string[],
  entry: TranscriptEntry,
  metadata: ParsedTranscript["metadata"],
): void {
  if (entry.kind === "message") {
    lines.push(`#### ${messageHeading(entry.role, metadata)}`);
    lines.push("");
    if (entry.timestamp) {
      lines.push(`- Time: ${entry.timestamp}`);
      lines.push("");
    }
    lines.push(entry.text.trimEnd());
    lines.push("");
    return;
  }

  if (entry.kind === "tool_call") {
    lines.push(`#### Tool Call: ${entry.toolName}`);
    lines.push("");
    if (entry.timestamp) {
      lines.push(`- Time: ${entry.timestamp}`);
    }
    if (entry.callId) {
      lines.push(`- Call ID: ${entry.callId}`);
    }
    if (entry.timestamp || entry.callId) {
      lines.push("");
    }

    renderToolCallArguments(lines, entry.toolName, entry.argumentsText);
    lines.push("");
    return;
  }

  lines.push("#### Tool Output");
  lines.push("");
  if (entry.timestamp) {
    lines.push(`- Time: ${entry.timestamp}`);
  }
  if (entry.callId) {
    lines.push(`- Call ID: ${entry.callId}`);
  }
  if (entry.timestamp || entry.callId) {
    lines.push("");
  }
  lines.push("```text");
  lines.push(entry.outputText.trimEnd());
  lines.push("```");
  lines.push("");
}

function buildTurnTitle(turnNumber: number, promptText: string): string {
  const excerpt = promptText
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72)
    .replace(/\s+[^\s]*$/, "")
    .trim();

  if (!excerpt) {
    return `Turn ${turnNumber}`;
  }

  return `Turn ${turnNumber}: ${excerpt}`;
}

function messageHeading(
  role: MessageRole,
  metadata: ParsedTranscript["metadata"],
): string {
  if (role === "user") {
    return "👤 User";
  }

  if (role === "assistant") {
    const model = metadata.model ?? "Assistant";
    const reasoning = metadata.reasoningEffort
      ? ` (${metadata.reasoningEffort})`
      : "";
    return `🤖 ${model}${reasoning}`;
  }

  return titleCase(role);
}

function renderToolCallArguments(
  lines: string[],
  toolName: string,
  argumentsText: string,
): void {
  const parsedArgs = tryParseJsonObject(argumentsText);
  if (!parsedArgs) {
    lines.push("```json");
    lines.push(argumentsText.trim() || "{}");
    lines.push("```");
    return;
  }

  if (toolName === "exec_command") {
    renderExecCommandArguments(lines, parsedArgs);
    return;
  }

  lines.push("```json");
  lines.push(JSON.stringify(parsedArgs, null, 2));
  lines.push("```");
}

function renderExecCommandArguments(
  lines: string[],
  args: Record<string, unknown>,
): void {
  const cmd = typeof args.cmd === "string" ? args.cmd : undefined;
  const workdir = typeof args.workdir === "string" ? args.workdir : undefined;
  const yieldTimeMs =
    typeof args.yield_time_ms === "number"
      ? String(args.yield_time_ms)
      : undefined;
  const maxOutputTokens =
    typeof args.max_output_tokens === "number"
      ? String(args.max_output_tokens)
      : undefined;
  const shell = typeof args.shell === "string" ? args.shell : undefined;
  const tty = typeof args.tty === "boolean" ? String(args.tty) : undefined;
  const login =
    typeof args.login === "boolean" ? String(args.login) : undefined;

  if (cmd) {
    lines.push("- Command:");
    lines.push("");
    lines.push("```sh");
    lines.push(cmd);
    lines.push("```");
  }

  pushOptionalBullet(lines, "Working Directory", workdir);
  pushOptionalBullet(lines, "Yield Time (ms)", yieldTimeMs);
  pushOptionalBullet(lines, "Max Output Tokens", maxOutputTokens);
  pushOptionalBullet(lines, "Shell", shell);
  pushOptionalBullet(lines, "TTY", tty);
  pushOptionalBullet(lines, "Login Shell", login);

  const remaining = { ...args };
  delete remaining.cmd;
  delete remaining.workdir;
  delete remaining.yield_time_ms;
  delete remaining.max_output_tokens;
  delete remaining.shell;
  delete remaining.tty;
  delete remaining.login;

  if (Object.keys(remaining).length > 0) {
    lines.push("");
    lines.push("Raw arguments:");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(remaining, null, 2));
    lines.push("```");
  }
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function pushOptionalBullet(
  lines: string[],
  label: string,
  value: string | undefined,
): void {
  if (!value) {
    return;
  }

  lines.push(`- ${label}: ${value}`);
}
