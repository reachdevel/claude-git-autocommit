# Claude Git Autocommit — Agent Context

This file records decisions so we don't re-litigate them on every change. If you're modifying this port, read this first.

## What this is

A Claude Code port of the OpenCode `opencode-git-autocommit` plugin. It auto-commits when Claude finishes a turn (`Stop` hook) by deriving the commit message from the staged git diff itself — no model call, no sanitizing of assistant prose.

## Runtime differences from the OpenCode plugin

| OpenCode | Claude Code |
|---|---|
| Trigger: `ctx.event.subscribe` over `session.execution.*` | Trigger: `Stop` / `StopFailure` hooks in `settings.json` |
| Directory: `ctx.location.directory` | Directory: `cwd` field in hook input JSON, or `$CLAUDE_PROJECT_DIR` |
| Session identity: `ctx.session.get({ sessionID }).parentID` | Not reliably available in hook input; subagent dedup may not be possible |
| API surface: `Plugin.define`, TypeScript plugin | Surface: shell command / Node script invoked by hook |
| `--no-verify` | `--no-verify` (same) |

Because Claude Code hooks don't expose `parentID` in the same way, **subagent dedup is not guaranteed here.** A `Stop` hook fires when any turn ends, including subagent turns. If you need root-only commits, you must detect it from hook input fields (if present) or accept that subagent turns may trigger commits.

## Key design decisions

### 1. Messages come from the diff, not Claude's last message

`commit-from-diff` reads `git diff --cached --name-status` and `--numstat`, then infers a Conventional Commits type:

| Situation | Example |
|---|---|
| New files only | `feat: add src/new.ts` |
| Existing source edited | `fix: update src/index.ts` |
| Tests only | `test: update src/a.test.ts` |
| Docs only | `docs: update README.md` |
| Deletions only | `chore: remove src/gone.ts` |
| Lockfiles/dist/CI only | `chore: update dist/index.js` |
| Many files | `fix: update src/one.ts and 5 more files` |

**Do not revert to sanitizing Claude's last assistant message.** That produced garbage like `stylecss` and `indexhtml` because dots get stripped. The diff is deterministic, free, and never garbled.

### 2. Always exit 0 — never wedge Claude's turn

Claude Code hooks with non-zero exit codes **block the turn**. A failed `git commit` must never prevent Claude from continuing. The script must catch every error, log it at debug level, and exit 0.

### 3. Staged before describing

`git add .` runs before `commit-from-diff`, so brand-new files are included in the diff and message.

### 4. Identity fallback

Commits with `user.name=claude-git-autocommit`, `user.email=claude-git-autocommit@localhost` only when the machine has no `user.email` configured.

### 5. `--no-verify`

Auto-commits bypass hooks so they never block on pre-commit hooks.

## Plugin distribution

- `.claude-plugin/plugin.json` is the plugin manifest. `.claude-plugin/marketplace.json` is a single-plugin marketplace named `reachdevel` with `"source": "./"`.
- The plugin is named **`git-autocommit`**, not `claude-git-autocommit`: Claude Code reserves the `claude-` prefix for Anthropic's own plugins. The npm package keeps the `claude-git-autocommit` name.
- Hooks are auto-discovered from `hooks/hooks.json`; commands use `${CLAUDE_PLUGIN_ROOT}/dist/commit-from-diff.mjs`.
- **`dist/` is committed.** A plugin installed from git has no build step, so the compiled hook must exist at the tagged commit. Run `npm run build` and commit `dist/` whenever `src/` changes.
- The manifest `version` in both `.claude-plugin` files must match `package.json`; bump all three together.
- Validate with `claude plugin validate .` before tagging.
- Install: `claude plugin install git-autocommit --marketplace reachdevel/claude-git-autocommit`, or `claude plugin marketplace add reachdevel/claude-git-autocommit` followed by `claude plugin install git-autocommit@reachdevel`.
- The npm tarball ships `.claude-plugin/`, `hooks/`, `dist/` and `scripts/`, so npm users get both the plugin and the npx installer.

## Settings scope

| File | Scope | Shareable |
|---|---|---|
| `~/.claude/settings.json` | All your projects | Local only |
| `.claude/settings.json` | Single project | Committable to repo |
| `hooks/hooks.json` | Bundled with a Claude plugin | Committable |

For personal use, put the hook in `~/.claude/settings.json`. For team sharing, commit `.claude/settings.json` or ship a plugin with `hooks/hooks.json`.

## Conventional commit format

Subjects capped at 72 characters:

```
<type>: <verb> <files>
```

Type inference is structural: `test` (all test paths), `docs` (all doc paths), `chore` (build/lock/CI/deletions), `feat` (all newly added), `fix` (everything else). Messages describe what changed, not why.

## How to use

1. Install as a Claude Code plugin: `claude plugin install git-autocommit --marketplace reachdevel/claude-git-autocommit` (restart Claude Code afterwards)
2. Or install the standalone hook: `npx claude-git-autocommit --user` (all projects) or `--project` (single repo)
3. Claude Code will run it on every `Stop` and `StopFailure` event

## Releases

- Version is in `package.json` **and** both `.claude-plugin` manifests. Bump all three together.
- `dist/` is committed because git-installed plugins cannot build. Run `npm run build` before committing `src/` changes.
- Pushing a `v*` tag (e.g. `git tag v1.1.0 && git push origin v1.1.0`) triggers `.github/workflows/publish.yml`, which runs `npm ci`, `npm run build`, and `npm publish` to npm via OIDC trusted publishing.
- After publishing, create a GitHub release for the tag. Plugin users update with `claude plugin update claude-git-autocommit`.
