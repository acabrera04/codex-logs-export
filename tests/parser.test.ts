import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseRolloutFile } from "../src/parser.js";

const fixturePath = path.resolve("tests/fixtures/sample-rollout.jsonl");

describe("rollout parser", () => {
  it("parses messages and tools by default", async () => {
    const parsed = await parseRolloutFile(fixturePath);

    expect(parsed.metadata.id).toBe("thread-12345678");
    expect(parsed.entries).toHaveLength(4);
    expect(parsed.entries[0]).toMatchObject({
      kind: "message",
      role: "user",
      text: "Export this conversation",
    });
    expect(parsed.entries[1]).toMatchObject({
      kind: "message",
      role: "assistant",
      text: "Working on it.",
    });
    expect(parsed.entries[2]).toMatchObject({
      kind: "tool_call",
      toolName: "exec_command",
      callId: "call_1",
    });
  });

  it("can include hidden prompts", async () => {
    const parsed = await parseRolloutFile(fixturePath, {
      includeHiddenPrompts: true,
    });

    expect(
      parsed.entries.some(
        (entry) => entry.kind === "message" && entry.role === "developer",
      ),
    ).toBe(true);
  });

  it("can omit tool sections", async () => {
    const parsed = await parseRolloutFile(fixturePath, {
      messagesOnly: true,
    });

    expect(parsed.entries.every((entry) => entry.kind === "message")).toBe(
      true,
    );
  });

  it("strips injected preamble and assistant directives by default", async () => {
    const parsed = await parseRolloutFile(fixturePath, {
      messagesOnly: true,
    });

    const [user, assistant] = parsed.entries;
    expect(user).toMatchObject({
      kind: "message",
      role: "user",
      text: "Export this conversation",
    });
    expect(assistant).toMatchObject({
      kind: "message",
      role: "assistant",
      text: "Working on it.",
    });
  });
});
