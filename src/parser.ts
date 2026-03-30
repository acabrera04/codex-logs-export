import fs from "node:fs";
import readline from "node:readline";

import type {
  ExportOptions,
  ParsedTranscript,
  SessionMetadata,
  TranscriptEntry,
} from "./types.js";

type MessageRole = Extract<TranscriptEntry, { kind: "message" }>["role"];

interface JsonlRecord {
  timestamp?: string;
  type: string;
  payload?: Record<string, unknown>;
}

interface MessagePayloadContent {
  type?: string;
  text?: string;
}

export async function parseRolloutFile(
  rolloutPath: string,
  options: ExportOptions = {},
): Promise<ParsedTranscript> {
  if (!fs.existsSync(rolloutPath)) {
    throw new Error(`Rollout file not found: ${rolloutPath}`);
  }

  const metadata: SessionMetadata = {
    rolloutPath,
  };
  const entries: TranscriptEntry[] = [];

  const stream = fs.createReadStream(rolloutPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber += 1;
    if (!line.trim()) {
      continue;
    }

    let record: JsonlRecord;
    try {
      record = JSON.parse(line) as JsonlRecord;
    } catch (error) {
      throw new Error(
        `Malformed JSONL record at ${rolloutPath}:${lineNumber}: ${String(error)}`,
      );
    }

    consumeRecord(record, metadata, entries, options);
  }

  return {
    metadata,
    entries,
  };
}

function consumeRecord(
  record: JsonlRecord,
  metadata: SessionMetadata,
  entries: TranscriptEntry[],
  options: ExportOptions,
): void {
  if (record.type === "session_meta") {
    const payload = record.payload ?? {};
    metadata.id = getString(payload.id) ?? metadata.id ?? "";
    metadata.timestamp = getString(payload.timestamp) ?? metadata.timestamp;
    metadata.cwd = getString(payload.cwd) ?? metadata.cwd;
    metadata.source = getString(payload.source) ?? metadata.source;
    metadata.modelProvider =
      getString(payload.model_provider) ?? metadata.modelProvider;
    metadata.model = getString(payload.model) ?? metadata.model;

    if (options.includeHiddenPrompts) {
      maybePushHiddenPrompt(
        entries,
        "system",
        record.timestamp,
        payload.instructions,
      );
      maybePushHiddenPrompt(
        entries,
        "developer",
        record.timestamp,
        payload.base_instructions,
      );
    }

    return;
  }

  if (record.type !== "response_item") {
    return;
  }

  const payload = record.payload ?? {};
  const payloadType = getString(payload.type);

  if (payloadType === "message") {
    const role = getString(payload.role);
    if (!role || !["user", "assistant", "system", "developer"].includes(role)) {
      return;
    }
    if (
      (role === "system" || role === "developer") &&
      !options.includeHiddenPrompts
    ) {
      return;
    }

    const text = sanitizeMessageText(
      role as MessageRole,
      messageContentToText(payload.content),
    );
    if (!text.trim()) {
      return;
    }

    entries.push({
      kind: "message",
      role: role as MessageRole,
      timestamp: record.timestamp,
      text,
    });
    return;
  }

  if (payloadType === "function_call") {
    if (options.messagesOnly) {
      return;
    }

    entries.push({
      kind: "tool_call",
      timestamp: record.timestamp,
      toolName: getString(payload.name) ?? "unknown",
      argumentsText: getString(payload.arguments) ?? "",
      callId: getString(payload.call_id) ?? undefined,
    });
    return;
  }

  if (payloadType === "function_call_output") {
    if (options.messagesOnly) {
      return;
    }

    entries.push({
      kind: "tool_output",
      timestamp: record.timestamp,
      callId: getString(payload.call_id) ?? undefined,
      outputText: stringifyOutput(payload.output),
    });
  }
}

function maybePushHiddenPrompt(
  entries: TranscriptEntry[],
  role: "system" | "developer",
  timestamp: string | undefined,
  value: unknown,
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const text = getString((value as Record<string, unknown>).text);
  if (!text) {
    return;
  }

  entries.push({
    kind: "message",
    role,
    timestamp,
    text,
  });
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      const part = item as MessagePayloadContent;
      return typeof part.text === "string" ? part.text : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function sanitizeMessageText(role: MessageRole, text: string): string {
  let normalized = text;

  if (role === "assistant") {
    normalized = stripDirectiveLines(normalized);
  }

  if (role === "user") {
    normalized = stripInjectedUserPreamble(normalized);
  }

  return normalized.trim();
}

function stripDirectiveLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().match(/^::[a-z0-9-]+\{.*\}$/i))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripInjectedUserPreamble(text: string): string {
  if (!text.startsWith("# AGENTS.md instructions for ")) {
    return text;
  }

  const environmentContextEnd = text.indexOf("</environment_context>");
  if (environmentContextEnd === -1) {
    return text;
  }

  return text
    .slice(environmentContextEnd + "</environment_context>".length)
    .trim();
}

function stringifyOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }

  if (output == null) {
    return "";
  }

  return JSON.stringify(output, null, 2);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
