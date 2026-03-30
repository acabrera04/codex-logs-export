# codex-logs-export

CLI and companion skill for exporting local Codex conversation logs to Markdown.

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

Run the built CLI:

```bash
node ./dist/cli.js list
```

During development:

```bash
node --import tsx ./src/cli.ts list
```

## Commands

List recent sessions:

```bash
node ./dist/cli.js list
node ./dist/cli.js list --limit 10
node ./dist/cli.js list --since 2026-03-30
```

Export by thread id:

```bash
node ./dist/cli.js export <thread-id>
node ./dist/cli.js export <thread-id> --out ~/Desktop
node ./dist/cli.js export <thread-id> --messages-only
node ./dist/cli.js export <thread-id> --include-hidden-prompts
node ./dist/cli.js export <thread-id> --stdout
```

Export by rollout path:

```bash
node ./dist/cli.js export --path ~/.codex/sessions/2026/03/30/rollout-...jsonl
node ./dist/cli.js export --path ~/.codex/sessions/2026/03/30/rollout-...jsonl --out ~/Desktop
```

## Flags

- `--out <file-or-dir>` writes to a specific file or directory
- `--stdout` prints Markdown instead of writing a file
- `--messages-only` omits tool calls and tool outputs
- `--include-hidden-prompts` includes hidden system/developer prompt layers
- `--since <date>` filters `list` results
- `--limit <n>` caps `list` results

## Output

Each export produces a Markdown file with:

- A metadata section
- Stable chronological transcript sections
- Fenced code blocks for tool call arguments and tool outputs

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
