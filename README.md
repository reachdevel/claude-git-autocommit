# Claude Git Autocommit

Auto-commit for Claude Code: derives commit messages from the staged git diff when Claude finishes a turn, using the `Stop` hook. No model call, no LLM cost, deterministic messages.

## Install

### User settings (all projects)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/leventkurt/opt/claude-git-autocommit/dist/commit-from-diff.mjs",
            "args": []
          }
        ]
      }
    ]
  }
}
```

### Project settings (single repo, committable)

Add to `.claude/settings.json` in your project:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/leventkurt/opt/claude-git-autocommit/dist/commit-from-diff.mjs",
            "args": []
          }
        ]
      }
    ]
  }
}
```

### As a plugin (bundled with `hooks/hooks.json`)

Ship `hooks/hooks.json` with your plugin; it references `${CLAUDE_PLUGIN_ROOT}/dist/commit-from-diff.mjs`.

## How it works

When Claude finishes a turn, the `Stop` hook fires. The script:

1. Reads `cwd` from the hook input JSON (falls back to `$CLAUDE_PROJECT_DIR` or current directory)
2. `git status --porcelain` — skips if no changes
3. `git add .` — stages everything
4. `git diff --cached --name-status` + `--numstat` — describes the change set
5. Infers Conventional Commits type and picks representative files
6. `git commit -m "<message>" --no-verify`

## Requirements

- Node.js
- Git
- Claude Code with hooks enabled

## License

MIT
// hook smoke test
