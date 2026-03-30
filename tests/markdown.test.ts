import { describe, expect, it } from "vitest";

import {
  buildDefaultFilename,
  renderMarkdown,
  sanitizeForFilename,
} from "../src/markdown.js";
import type { ParsedTranscript } from "../src/types.js";

describe("markdown renderer", () => {
  it("renders metadata and transcript sections", () => {
    const transcript: ParsedTranscript = {
      metadata: {
        id: "thread-12345678",
        title: "Sample Session",
        timestamp: "2026-03-30T15:59:59.000Z",
        cwd: "/tmp/project",
        modelProvider: "openai",
        model: "gpt-5.4",
        reasoningEffort: "high",
        rolloutPath: "/tmp/sample.jsonl",
      },
      entries: [
        {
          kind: "message",
          role: "user",
          timestamp: "2026-03-30T16:00:01.000Z",
          text: "hello",
        },
        {
          kind: "message",
          role: "assistant",
          timestamp: "2026-03-30T16:00:02.000Z",
          text: "Working on it.",
        },
        {
          kind: "tool_call",
          timestamp: "2026-03-30T16:00:03.000Z",
          toolName: "exec_command",
          argumentsText:
            '{"cmd":"pwd","workdir":"/tmp/project","yield_time_ms":1000}',
          callId: "call_1",
        },
      ],
    };

    const markdown = renderMarkdown(transcript);

    expect(markdown).toContain("# Codex Conversation Export");
    expect(markdown).toContain("- Thread ID: thread-12345678");
    expect(markdown).toContain("- Reasoning Effort: high");
    expect(markdown).toContain("### Turn 1: hello");
    expect(markdown).toContain("#### 👤 User Prompt");
    expect(markdown).toContain("#### 🤖 gpt-5.4 (high)");
    expect(markdown).toContain("#### Tool Call: exec_command");
    expect(markdown).toContain("- Command:");
    expect(markdown).toContain("```sh");
    expect(markdown).toContain("pwd");
    expect(markdown).toContain("- Working Directory: /tmp/project");
  });

  it("sanitizes deterministic filenames", () => {
    const transcript: ParsedTranscript = {
      metadata: {
        id: "thread-12345678",
        title: "A Title With / Odd : Chars",
        timestamp: "2026-03-30T15:59:59.000Z",
      },
      entries: [],
    };

    expect(sanitizeForFilename("A Title With / Odd : Chars")).toBe(
      "a-title-with-odd-chars",
    );
    expect(buildDefaultFilename(transcript)).toBe(
      "2026-03-30-a-title-with-odd-chars-thread-1.md",
    );
  });
});
