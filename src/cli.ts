import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";

import {
  buildDefaultOutputPath,
  formatSessionList,
  renderMarkdown,
} from "./markdown.js";
import { parseRolloutFile } from "./parser.js";
import { getSessionById, listSessions } from "./session-index.js";

const program = new Command();

program
  .name("codex-log-export")
  .description("Export Codex conversation logs to Markdown");

program
  .command("list")
  .option(
    "--limit <number>",
    "maximum number of sessions to show",
    parseInteger,
  )
  .option("--since <date>", "include sessions created on/after this date")
  .action(async (options) => {
    const sessions = await listSessions({
      limit: options.limit,
      since: options.since,
    });
    process.stdout.write(`${formatSessionList(sessions)}\n`);
  });

program
  .command("export")
  .argument("[threadId]", "thread id to export")
  .option("--path <jsonl>", "rollout file path to export directly")
  .option("--out <fileOrDir>", "write to an explicit file path or directory")
  .option("--stdout", "print markdown to stdout instead of writing a file")
  .option("--include-hidden-prompts", "include system and developer prompts")
  .option("--messages-only", "omit tool calls and tool outputs")
  .action(async (threadId, options) => {
    const rolloutPath = await resolveRolloutPath(threadId, options.path);
    const transcript = await parseRolloutFile(rolloutPath, {
      includeHiddenPrompts: Boolean(options.includeHiddenPrompts),
      messagesOnly: Boolean(options.messagesOnly),
    });

    if (!transcript.metadata.id && threadId) {
      transcript.metadata.id = threadId;
    }
    if (!transcript.metadata.rolloutPath) {
      transcript.metadata.rolloutPath = rolloutPath;
    }

    if (threadId) {
      try {
        const session = await getSessionById(threadId);
        transcript.metadata.title = session.title;
        transcript.metadata.cwd = transcript.metadata.cwd ?? session.cwd;
        transcript.metadata.model = transcript.metadata.model ?? session.model;
        transcript.metadata.reasoningEffort =
          transcript.metadata.reasoningEffort ?? session.reasoningEffort;
        transcript.metadata.modelProvider =
          transcript.metadata.modelProvider ?? session.modelProvider;
      } catch {
        // Export-by-path should still work if the thread is not in SQLite.
      }
    }

    const markdown = renderMarkdown(transcript);
    if (options.stdout) {
      process.stdout.write(markdown);
      if (!markdown.endsWith("\n")) {
        process.stdout.write("\n");
      }
      return;
    }

    const outputPath = buildDefaultOutputPath(transcript, options.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, "utf8");
    process.stdout.write(`${outputPath}\n`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

async function resolveRolloutPath(
  threadId: string | undefined,
  explicitPath: string | undefined,
): Promise<string> {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  if (!threadId) {
    throw new Error("Provide a <thread-id> or use --path <jsonl>.");
  }

  const session = await getSessionById(threadId);
  return session.rolloutPath;
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }

  return parsed;
}
