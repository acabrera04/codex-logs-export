---
name: codex-conversation-exporter
description: Export Codex session logs to Markdown using the local codex-log-export CLI instead of reconstructing transcripts with model tokens.
---

# Codex Conversation Exporter

Use this skill when the user asks to export Codex logs, save a Codex conversation, convert a session to Markdown, or archive a transcript locally.

## Rules

- Prefer the local `codex-log-export` CLI over reconstructing a transcript in-model.
- If the user has not identified a session, run `codex-log-export list` first and show the relevant candidates.
- Default to messages plus tool activity.
- Include hidden system/developer prompts only when the user explicitly asks for them.
- Write to a user-visible path unless the user asks for stdout or another destination.
- Report the output path back to the user after a file export.

## Command patterns

List recent sessions:

```bash
codex-log-export list
codex-log-export list --limit 10
codex-log-export list --since 2026-03-30
```

Export by thread id:

```bash
codex-log-export export <thread-id>
codex-log-export export <thread-id> --out ~/Desktop
codex-log-export export <thread-id> --messages-only
codex-log-export export <thread-id> --include-hidden-prompts
codex-log-export export <thread-id> --stdout
```

Export by rollout path:

```bash
codex-log-export export --path ~/.codex/sessions/.../rollout-*.jsonl
codex-log-export export --path ~/.codex/sessions/.../rollout-*.jsonl --out ~/Desktop
```

## Flag guide

- `--out <file-or-dir>` writes to a specific file or directory.
- `--stdout` prints the Markdown instead of writing a file.
- `--messages-only` omits tool calls and tool outputs.
- `--include-hidden-prompts` includes developer/system prompt layers.
- `--since <date>` filters `list` results.
- `--limit <n>` caps `list` results.

## Agent behavior

When the user says "export this conversation" without a thread id:

1. Run `codex-log-export list`.
2. Identify the most likely current session from title, cwd, and recency.
3. Export it with the default mode unless the user requested a different output.
4. Return the exact file path written.
