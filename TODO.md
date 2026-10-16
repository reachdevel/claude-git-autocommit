# Claude Git Autocommit — TODO

- [x] Scaffold repo (AGENTS.md, TODO.md, README.md)
- [x] Port git/diff logic from OpenCode to `src/commit-from-diff.ts`
- [x] Compile TypeScript to `dist/commit-from-diff.mjs` (no external deps)
- [x] Write Claude `Stop` hook config in `hooks/hooks.json`
- [x] Write example user settings in `.claude/settings.json`
- [x] Test against throwaway git repos (mirror OpenCode verify scenarios) — 12/12 pass
- [x] Decide error handling: always exit 0 vs allow block on failure — always exit 0
- [x] Document install: user settings vs project settings vs plugin
- [ ] First real commit via Claude Code hook — hook contract verified via direct invocation (stdin `{"cwd"}`); end-to-end requires a live Claude Code session
