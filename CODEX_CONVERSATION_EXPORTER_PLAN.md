# Codex Conversation Exporter CLI + Skill

## Summary

Target workspace: `/Users/allen/repos/codex-logs-export`

Build a local Node.js/TypeScript CLI in this repo that reads Codex session data from `~/.codex/state_5.sqlite` and `~/.codex/sessions/**/*.jsonl`, lets the user list/select recent conversations, and exports a selected session to a Markdown file without calling the model. Ship a companion skill in the same repo that teaches agents when to use the tool, which commands to run, and what output modes/flags to prefer.

Default behavior:

- Export user messages, assistant messages, and tool activity
- Exclude system/developer prompt content unless explicitly requested by a flag
- Support listing recent sessions before export
- Write one Markdown file per exported session

## Key Changes

### CLI project

- Initialize a small TypeScript CLI package in `/Users/allen/repos/codex-logs-export` with a standard executable entrypoint and build step that emits a runnable binary command.
- Implement a session index layer that reads `threads` from `~/.codex/state_5.sqlite` and returns recent sessions with thread id, title, created time, cwd, and rollout path.
- Implement a rollout parser for Codex JSONL files that handles at minimum:
  - `session_meta`
  - `response_item.message` for `user` and `assistant`
  - `response_item.function_call`
  - `response_item.function_call_output`
  - ignore `reasoning` and token-count events by default
- Implement a Markdown renderer that outputs:
  - metadata section with thread id, title, source path, created timestamp, cwd, model/provider if available
  - chronological sections for `User`, `Assistant`, `Tool Call`, and `Tool Output`
  - fenced code blocks for shell/tool arguments and command output
  - stable heading structure so files are readable and diffable
- Implement CLI commands:
  - `list`: show recent conversations from SQLite index
  - `export <thread-id>`: resolve thread to rollout path and write Markdown
  - `export --path <jsonl>`: export a specific rollout file directly
- Implement key flags:
  - `--out <file-or-dir>`
  - `--include-hidden-prompts`
  - `--messages-only`
  - `--since <date>` or `--limit <n>` for `list`
  - `--stdout` for piping instead of file write
- Use deterministic filename generation by default, based on session date plus a sanitized title and short thread id.
- Fail clearly when SQLite or rollout files are missing, the thread id is unknown, or a JSONL record is malformed.

### Skill

- Create a dedicated skill folder in `/Users/allen/repos/codex-logs-export` with:
  - `SKILL.md`
  - `agents/openai.yaml`
  - optional `references/cli-usage.md` only if needed to keep the skill concise
- The skill should trigger for requests like:
  - export Codex logs
  - save this Codex conversation
  - convert session to Markdown
  - archive transcript locally
- Skill instructions should tell the agent to:
  - prefer the local CLI over using model tokens to reconstruct a transcript
  - run `list` first when the user has not specified a session
  - use the default export mode unless the user asks for hidden/system content
  - write the Markdown file to a user-visible path and report that path back
- The skill should document the exact command patterns the agent should use, plus the meaning of the important flags.

### Public interfaces

- CLI binary name: `codex-log-export`
- Subcommands:
  - `codex-log-export list`
  - `codex-log-export export <thread-id>`
  - `codex-log-export export --path /path/to/rollout.jsonl`
- Output contract:
  - Markdown document with metadata header/summary and ordered transcript sections
  - Default transcript includes messages and tool activity only
  - Hidden prompt layers are opt-in via flag

## Test Plan

- Unit tests for:
  - SQLite thread lookup and recent-session listing
  - JSONL parsing across the known record types
  - Markdown rendering for messages, tool calls, and tool outputs
  - filename sanitization and output path resolution
- Fixture-based tests using one or more real sampled rollout files with sensitive content trimmed.
- CLI integration tests for:
  - `list` returns recent threads
  - `export <thread-id>` writes a Markdown file
  - `export --path` works without SQLite lookup
  - `--messages-only` omits tool sections
  - `--include-hidden-prompts` includes developer/system message records
- Manual verification:
  - export an existing local session
  - open the generated Markdown and confirm readability, ordering, and code block formatting
  - verify no network/model calls are needed during export

## Assumptions

- The tool targets the current local Codex storage layout: `~/.codex/state_5.sqlite` plus rollout files under `~/.codex/sessions/`.
- The first version is for local use, not a guaranteed stable parser for every future Codex schema revision.
- "Messages + tools" means user/assistant messages plus tool calls and tool outputs; reasoning records and token-count events stay excluded by default.
- The skill is a local companion to the CLI, not a replacement for it; the skill teaches agents to use the installed CLI correctly.
- If needed, the plan can package the CLI for npm later, but initial delivery should prioritize a working local binary and a working local skill.

## Provenance

- Recovered from prior Codex thread `019d3f7b-416d-7551-8f8a-f7f8a049647e`
- Source session log: `/Users/allen/.codex/sessions/2026/03/30/rollout-2026-03-30T12-02-15-019d3f7b-416d-7551-8f8a-f7f8a049647e.jsonl`
