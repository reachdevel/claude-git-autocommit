# Claude Git Autocommit

[![npm version](https://img.shields.io/npm/v/claude-git-autocommit)](https://www.npmjs.com/package/claude-git-autocommit)

Auto-commit for Claude Code: derives commit messages from the staged git diff when Claude finishes a turn, using the `Stop` hook. No model call, no LLM cost, deterministic messages.

## What It Does

This hook automatically commits your changes when a Claude Code turn ends:

1. The turn reaches a terminal state (`Stop` or `StopFailure`)
2. There are uncommitted changes in your working directory
3. A git repository exists

Commit messages are derived from the staged diff itself, so they are deterministic and cost nothing to produce.

## Features

- **Automatic Commits** - Commits as soon as a turn reaches a terminal state
- **Diff-Derived Messages** - Build Conventional Commit subjects from the staged diff, with no model call and no guessing from conversation prose
- **Type Inference** - Picks `feat`, `fix`, `test`, `docs`, or `chore` from the change shape and the paths involved
- **Representative File** - Leads with the most meaningful path, ranking source over tests over docs over build output
- **Respects .gitignore** - Git handles ignored files automatically
- **Identity Fallback** - Commits with a bot identity only when the machine has no `user.email` configured
- **Bypasses Hooks** - Uses `--no-verify` so auto-commits never block on pre-commit hooks
- **Never Wedge** - Always exits `0`; a failed auto-commit is logged and never blocks Claude's turn

## Installation

Requires Claude Code with hooks enabled. The plugin route needs the `claude` CLI
(2.1.292+ for the one-step `--marketplace` install); the npx route needs Node.js 18+.

### As a Claude Code plugin (recommended)

Add the marketplace once, then install:

```bash
claude plugin marketplace add reachdevel/claude-git-autocommit
claude plugin install git-autocommit@reachdevel
```

Or in one step (Claude Code 2.1.292+):

```bash
claude plugin install git-autocommit --marketplace reachdevel/claude-git-autocommit
```

The plugin loads the `Stop` and `StopFailure` hooks from `hooks/hooks.json` at user
scope. Restart Claude Code after installing. Update or remove it with:

```bash
claude plugin update git-autocommit
claude plugin uninstall git-autocommit
```

### Standalone hook with npx

If you don't use the plugin system, `npx` copies the compiled hook into your
settings directory. There is nothing to clone and no JSON to edit by hand.

```bash
# All projects (user settings: ~/.claude/settings.json)
npx claude-git-autocommit --user

# Single repo (project settings: .claude/settings.json)
npx claude-git-autocommit --project
```

Preview the change without writing anything:

```bash
npx claude-git-autocommit --user --dry-run
```

The installer copies the compiled hook to `.claude/hooks/claude-git-autocommit.mjs`
next to the settings file, so it keeps working after the npx cache is cleared, and
writes this entry:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.claude/hooks/claude-git-autocommit.mjs",
            "args": []
          }
        ]
      }
    ]
  }
}
```

The same entry is added for `StopFailure`. Re-running the installer updates the
existing entry instead of adding a duplicate.

### Manual install (JSON files)

If you prefer to edit settings by hand, add the entry above to:

| Scope | File | Notes |
| --- | --- | --- |
| All projects | `~/.claude/settings.json` | User settings — applies everywhere |
| Single repo | `.claude/settings.json` | Project settings — committable to the repo |
| Plugin bundle | `hooks/hooks.json` | Ship with a plugin; uses `${CLAUDE_PLUGIN_ROOT}/dist/commit-from-diff.mjs` |

## How It Works

1. Reads `cwd` from the hook input JSON (falls back to `$CLAUDE_PROJECT_DIR` or current directory)
2. `git status --porcelain` — skips if no changes
3. `git add .` — stages everything, so brand-new files are included
4. `git diff --cached --name-status` and `--numstat` describe the staged change set
5. Paths and line deltas determine the Conventional Commit type and the file list
6. `git commit -m "<message>" --no-verify`

### Message Format

Subjects follow Conventional Commits and are capped at 72 characters:

```
<type>: <verb> <files>
```

| Situation | Example |
| --- | --- |
| Only files added | `feat: add src/brand-new.ts` |
| Existing source edited | `fix: update src/index.ts` |
| Only tests touched | `test: update src/a.test.ts` |
| Only docs touched | `docs: update README.md` |
| Only deletions | `chore: remove src/gone.ts` |
| Lockfiles / `dist/` / CI config only | `chore: update package-lock.json` |
| More than two files | `fix: update src/one.ts and 5 more files` |

Type inference is purely structural:

- `test` - every changed path looks like a test (`*.test.*`, `__tests__/`, `spec/`)
- `docs` - every changed path looks like documentation (`*.md`, `docs/`)
- `chore` - build output, lockfiles, CI config, or deletions only
- `feat` - every changed path is newly added
- `fix` - anything else, meaning existing files were modified

Because messages come from the diff rather than the model's last sentence, they never inherit stray markup, backticks, or file paths mangled by sanitizing. If diff parsing fails for any reason, the hook falls back to `chore: automated update` and logs the reason at debug level instead of failing the turn.

## Configuration

The hook works out of the box with no configuration needed. It reads `cwd` from the Claude Code hook input JSON.

## Notes

Messages describe *what changed*, not *why*. They are structural by design: deterministic, free, and unable to fail. If you want prose messages, layer a model call on top of this rather than replacing it.

## Requirements

- Node.js 18+
- Git
- Claude Code with hooks enabled

## License

MIT
