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
        {
          kind: "tool_output",
          timestamp: "2026-03-30T16:00:04.000Z",
          callId: "call_1",
          outputText: "Command: pwd\nOutput:\n/tmp/project",
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
    expect(markdown).toContain("#### Tool: exec_command");
    expect(markdown).toContain("```sh");
    expect(markdown).toContain("pwd");
    expect(markdown).toContain("Output:");
    expect(markdown).toContain("/tmp/project");
    expect(markdown).not.toContain("- Working Directory: /tmp/project");
    expect(markdown).not.toContain("- Call ID: call_1");
    expect(markdown).not.toContain("Command: pwd");
  });

  it("includes verbose tool metadata behind all=true", () => {
    const transcript: ParsedTranscript = {
      metadata: {
        id: "thread-12345678",
        model: "gpt-5.4",
      },
      entries: [
        {
          kind: "tool_call",
          timestamp: "2026-03-30T16:00:03.000Z",
          toolName: "exec_command",
          argumentsText:
            '{"cmd":"pwd","workdir":"/tmp/project","yield_time_ms":1000}',
          callId: "call_1",
        },
        {
          kind: "tool_output",
          timestamp: "2026-03-30T16:00:04.000Z",
          callId: "call_1",
          outputText:
            "Command: pwd\nChunk ID: abc123\nWall time: 0.0000 seconds\nProcess exited with code 0\nOriginal token count: 5\nOutput:\n/tmp/project",
        },
      ],
    };

    const markdown = renderMarkdown(transcript, { all: true });

    expect(markdown).toContain("- Call ID: call_1");
    expect(markdown).toContain("- Working Directory: /tmp/project");
    expect(markdown).toContain("- Yield Time (ms): 1000");
    expect(markdown).toContain("Command: pwd");
    expect(markdown).toContain("Chunk ID: abc123");
  });

  it("renders update_plan as a readable checklist", () => {
    const transcript: ParsedTranscript = {
      metadata: {
        id: "thread-12345678",
      },
      entries: [
        {
          kind: "tool_call",
          toolName: "update_plan",
          argumentsText: JSON.stringify({
            explanation: "Implement the feature in a few steps.",
            plan: [
              { step: "Inspect repo", status: "completed" },
              { step: "Implement change", status: "in_progress" },
            ],
          }),
        },
      ],
    };

    const markdown = renderMarkdown(transcript);

    expect(markdown).toContain("#### Tool: update_plan");
    expect(markdown).toContain("- Explanation: Implement the feature in a few steps.");
    expect(markdown).toContain("- Plan:");
    expect(markdown).toContain("- [completed] Inspect repo");
    expect(markdown).toContain("- [in_progress] Implement change");
    expect(markdown).not.toContain('"explanation"');
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
