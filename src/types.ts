export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  createdAtEpoch: number;
  cwd: string;
  rolloutPath: string;
  modelProvider: string;
  model?: string;
  reasoningEffort?: string;
}

export interface SessionMetadata {
  id?: string;
  timestamp?: string;
  cwd?: string;
  source?: string;
  modelProvider?: string;
  model?: string;
  reasoningEffort?: string;
  title?: string;
  rolloutPath?: string;
}

export type TranscriptEntry =
  | {
      kind: "message";
      role: "user" | "assistant" | "system" | "developer";
      timestamp?: string;
      text: string;
    }
  | {
      kind: "tool_call";
      timestamp?: string;
      toolName: string;
      argumentsText: string;
      callId?: string;
    }
  | {
      kind: "tool_output";
      timestamp?: string;
      callId?: string;
      outputText: string;
    };

export interface ParsedTranscript {
  metadata: SessionMetadata;
  entries: TranscriptEntry[];
}

export interface ExportOptions {
  includeHiddenPrompts?: boolean;
  messagesOnly?: boolean;
  all?: boolean;
}
