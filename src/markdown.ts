import path from "node:path";

import type {
  ExportOptions,
  ParsedTranscript,
  TranscriptEntry,
} from "./types.js";

type MessageRole = Extract<TranscriptEntry, { kind: "message" }>["role"];

export function renderMarkdown(
  transcript: ParsedTranscript,
  options: ExportOptions = {},
): string {
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
  renderTranscriptByTurn(lines, transcript, options);

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
  options: ExportOptions,
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
    renderEntries(lines, prelude, metadata, options);
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
      appendFencedBlock(lines, "text", prompt.text.trimEnd());
      lines.push("");
    }

    if (rest.length === 0) {
      lines.push("_No assistant or tool activity recorded after this prompt._");
      lines.push("");
      return;
    }

    renderEntries(lines, rest, metadata, options);
  });
}

function renderEntries(
  lines: string[],
  entries: TranscriptEntry[],
  metadata: ParsedTranscript["metadata"],
  options: ExportOptions,
): void {
  const consumedOutputIndexes = new Set<number>();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (consumedOutputIndexes.has(index)) {
      continue;
    }

    if (entry.kind === "tool_call") {
      const outputMatchIndex = findMatchingToolOutputIndex(
        entries,
        index + 1,
        entry.callId,
      );
      if (outputMatchIndex !== -1) {
        renderToolInteraction(
          lines,
          entry,
          entries[outputMatchIndex] as Extract<
            TranscriptEntry,
            { kind: "tool_output" }
          >,
          options,
        );
        consumedOutputIndexes.add(outputMatchIndex);
      } else {
        renderEntry(lines, entry, metadata, options);
      }

      continue;
    }

    renderEntry(lines, entry, metadata, options);
  }
}

function renderEntry(
  lines: string[],
  entry: TranscriptEntry,
  metadata: ParsedTranscript["metadata"],
  options: ExportOptions,
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
    renderToolInteraction(lines, entry, undefined, options);
    return;
  }

  lines.push("#### Tool Output");
  lines.push("");
  if (options.all && entry.timestamp) {
    lines.push(`- Time: ${entry.timestamp}`);
  }
  if (options.all && entry.callId) {
    lines.push(`- Call ID: ${entry.callId}`);
  }
  if ((options.all && entry.timestamp) || (options.all && entry.callId)) {
    lines.push("");
  }
  appendFencedBlock(lines, "text", sanitizeToolOutput(entry.outputText));
  lines.push("");
}

function findMatchingToolOutputIndex(
  entries: TranscriptEntry[],
  startIndex: number,
  callId: string | undefined,
): number {
  if (!callId) {
    return -1;
  }

  for (let index = startIndex; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.kind === "tool_output" && entry.callId === callId) {
      return index;
    }
  }

  return -1;
}

function renderToolInteraction(
  lines: string[],
  call: Extract<TranscriptEntry, { kind: "tool_call" }>,
  output?: Extract<TranscriptEntry, { kind: "tool_output" }>,
  options: ExportOptions = {},
): void {
  lines.push(`#### Tool: ${call.toolName}`);
  lines.push("");
  if (options.all && call.timestamp) {
    lines.push(`- Time: ${call.timestamp}`);
  }
  if (options.all && call.callId) {
    lines.push(`- Call ID: ${call.callId}`);
  }
  if ((options.all && call.timestamp) || (options.all && call.callId)) {
    lines.push("");
  }

  renderToolCallArguments(lines, call.toolName, call.argumentsText, options);

  if (output) {
    lines.push("");
    lines.push("Output:");
    lines.push("");
    appendFencedBlock(
      lines,
      "text",
      sanitizeToolOutput(output.outputText, call.toolName, options),
    );
  }

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
  options: ExportOptions = {},
): void {
  const parsedArgs = tryParseJsonObject(argumentsText);
  if (!parsedArgs) {
    appendFencedBlock(lines, "json", argumentsText.trim() || "{}");
    return;
  }

  if (toolName === "exec_command") {
    renderExecCommandArguments(lines, parsedArgs, options);
    return;
  }

  if (toolName === "update_plan") {
    renderUpdatePlanArguments(lines, parsedArgs, options);
    return;
  }

  appendFencedBlock(lines, "json", JSON.stringify(parsedArgs, null, 2));
}

function renderExecCommandArguments(
  lines: string[],
  args: Record<string, unknown>,
  options: ExportOptions = {},
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
    appendFencedBlock(lines, "sh", cmd);
  }

  if (options.all) {
    pushOptionalBullet(lines, "Working Directory", workdir);
    pushOptionalBullet(lines, "Yield Time (ms)", yieldTimeMs);
    pushOptionalBullet(lines, "Max Output Tokens", maxOutputTokens);
    pushOptionalBullet(lines, "Shell", shell);
    pushOptionalBullet(lines, "TTY", tty);
    pushOptionalBullet(lines, "Login Shell", login);
  }

  const remaining = { ...args };
  delete remaining.cmd;
  delete remaining.workdir;
  delete remaining.yield_time_ms;
  delete remaining.max_output_tokens;
  delete remaining.shell;
  delete remaining.tty;
  delete remaining.login;

  if (options.all && Object.keys(remaining).length > 0) {
    lines.push("");
    lines.push("Raw arguments:");
    lines.push("");
    appendFencedBlock(lines, "json", JSON.stringify(remaining, null, 2));
  }
}

function renderUpdatePlanArguments(
  lines: string[],
  args: Record<string, unknown>,
  options: ExportOptions = {},
): void {
  const explanation =
    typeof args.explanation === "string" ? args.explanation.trim() : "";
  const plan = Array.isArray(args.plan) ? args.plan : [];

  if (explanation) {
    lines.push("- Explanation: " + explanation);
  }

  if (plan.length > 0) {
    if (explanation) {
      lines.push("");
    }
    lines.push("- Plan:");
    for (const item of plan) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const step = typeof item.step === "string" ? item.step : "Unnamed step";
      const status = typeof item.status === "string" ? item.status : "unknown";
      lines.push(`  - [${status}] ${step}`);
    }
  }

  if (options.all) {
    lines.push("");
    lines.push("Raw arguments:");
    lines.push("");
    appendFencedBlock(lines, "json", JSON.stringify(args, null, 2));
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

function sanitizeToolOutput(
  outputText: string,
  toolName?: string,
  options: ExportOptions = {},
): string {
  if (options.all) {
    return outputText.trimEnd();
  }

  if (toolName === "exec_command") {
    return stripExecCommandPreamble(outputText);
  }

  return outputText.trimEnd();
}

function stripExecCommandPreamble(outputText: string): string {
  const lines = outputText.split("\n");
  const outputMarkerIndex = lines.findIndex(
    (line) => line.trim() === "Output:",
  );
  if (outputMarkerIndex !== -1) {
    return lines
      .slice(outputMarkerIndex + 1)
      .join("\n")
      .trimEnd();
  }

  return lines
    .filter((line) => {
      const trimmed = line.trim();
      return !(
        trimmed.startsWith("Command: ") ||
        trimmed.startsWith("Chunk ID: ") ||
        trimmed.startsWith("Wall time: ") ||
        trimmed.startsWith("Process exited with code ") ||
        trimmed.startsWith("Original token count: ")
      );
    })
    .join("\n")
    .trimEnd();
}

function appendFencedBlock(
  lines: string[],
  language: string,
  content: string,
): void {
  const fence = fenceForContent(content);
  lines.push(`${fence}${language}`);
  lines.push(content);
  lines.push(fence);
}

function fenceForContent(content: string): string {
  const matches = content.match(/`+/g) ?? [];
  const longestRun = matches.reduce(
    (max, match) => Math.max(max, match.length),
    0,
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}
