# codex-logs-export

CLI and companion skill for exporting local Codex conversation logs to Markdown.

Primary command: `codex-export`

Compatibility alias: `codex-log-export`

## What it does

- Lists recent Codex conversations from `~/.codex/state_5.sqlite`
- Exports a conversation to a Markdown transcript
- Supports export by thread id or direct rollout JSONL path
- Includes user messages, assistant messages, tool calls, and tool outputs by default
- Keeps system/developer prompt layers hidden unless explicitly requested

## Requirements

- Node.js 20+
- `sqlite3` available on the local system
- Local Codex data under `~/.codex/`

## Install

```bash
npm install
npm run build
```

Install the global command aliases on your system:

```bash
npm link
```

Verify the primary alias is available:

```bash
which codex-export
codex-export --help
```

Run the built CLI after linking:

```bash
codex-export list
```

During development:

```bash
node --import tsx ./src/cli.ts list
```

## Commands

List recent sessions:

```bash
codex-export list
codex-export list --limit 10
codex-export list --since 2026-03-30
```

Export by thread id:

```bash
codex-export export <thread-id>
codex-export export <thread-id> --out ~/Desktop
codex-export export <thread-id> --messages-only
codex-export export <thread-id> --all
codex-export export <thread-id> --include-hidden-prompts
codex-export export <thread-id> --stdout
```

Export by rollout path:

```bash
codex-export export --path ~/.codex/sessions/2026/03/30/rollout-...jsonl
codex-export export --path ~/.codex/sessions/2026/03/30/rollout-...jsonl --out ~/Desktop
```

The legacy alias `codex-log-export` points to the same CLI.

## Flags

- `--out <file-or-dir>` writes to a specific file or directory
- `--stdout` prints Markdown instead of writing a file
- `--messages-only` omits tool calls and tool outputs
- `--all` includes low-level tool metadata such as call IDs and transport details
- `--include-hidden-prompts` includes hidden system/developer prompt layers
- `--since <date>` filters `list` results
- `--limit <n>` caps `list` results

## Output

Each export produces a Markdown file with:

- A metadata section
- Stable chronological transcript sections
- Sanitized fenced blocks for tool content so embedded Markdown does not style the transcript
- Default tool sections focus on the command and cleaned output
- `--all` restores full tool metadata and raw output wrappers

Default filenames are deterministic:

```text
YYYY-MM-DD-sanitized-title-shortid.md
```

## Skill

The companion skill lives at:

- [skills/codex-conversation-exporter/SKILL.md](/Users/allen/repos/codex-logs-export/skills/codex-conversation-exporter/SKILL.md)

It tells agents to prefer the local CLI over reconstructing a transcript with model tokens.

## Development

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Current assumptions

- The tool targets the current local Codex storage layout under `~/.codex/`
- The first version is intended for local use, not long-term schema compatibility across all future Codex releases
- The CLI uses the system `sqlite3` binary so it can read current thread data even when SQLite WAL files are active
