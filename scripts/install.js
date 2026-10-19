#!/usr/bin/env node
/**
 * install.js — install the claude-git-autocommit Stop hook.
 *
 * Copies the compiled hook into the Claude config directory and adds it to
 * the settings file (user or project scope). Safe to re-run: an existing
 * install is updated in place instead of adding a duplicate.
 *
 * Usage:
 *   npx claude-git-autocommit --user
 *   npx claude-git-autocommit --project
 *   npx claude-git-autocommit --user --dry-run
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const HOOK_SOURCE = join(PACKAGE_ROOT, "dist", "commit-from-diff.mjs")
const HOOK_NAME = "claude-git-autocommit.mjs"
const LEGACY_HOOK_NAME = "commit-from-diff.mjs"
const HOOK_TYPES = ["Stop", "StopFailure"]

function usage() {
  return [
    "Usage: claude-git-autocommit [--user | --project] [--dry-run]",
    "",
    "  --user, -u       Write to ~/.claude/settings.json (all projects)",
    "  --project, -p    Write to ./.claude/settings.json (single repo)",
    "  --dry-run, -n    Print the change without writing anything",
    "  --help, -h       Show this help",
    "  --version, -v    Print the version",
  ].join("\n")
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function loadSettings(path) {
  if (!existsSync(path)) return {}
  const raw = readFileSync(path, "utf8")
  try {
    return JSON.parse(raw)
  } catch {
    fail(`Cannot parse ${path}. Fix the JSON and run the installer again.`)
  }
}

function isOurHook(hook) {
  if (!hook || typeof hook.command !== "string") return false
  const name = basename(hook.command)
  return name === HOOK_NAME || name === LEGACY_HOOK_NAME
}

function installHooks(settings, hookPath) {
  let changed = false

  for (const hookType of HOOK_TYPES) {
    if (!settings.hooks) settings.hooks = {}
    if (!Array.isArray(settings.hooks[hookType])) settings.hooks[hookType] = []
    const groups = settings.hooks[hookType]
    let found = false

    for (const group of groups) {
      if (!group || !Array.isArray(group.hooks)) continue
      for (const hook of group.hooks) {
        if (!isOurHook(hook)) continue
        found = true
        if (hook.command !== hookPath) {
          hook.command = hookPath
          changed = true
        }
      }
    }

    if (!found) {
      groups.push({ hooks: [{ type: "command", command: hookPath, args: [] }] })
      changed = true
    }
  }

  return changed
}

function main() {
  const args = process.argv.slice(2)
  let scope = null
  let dryRun = false

  for (const arg of args) {
    if (arg === "--user" || arg === "-u") scope = "user"
    else if (arg === "--project" || arg === "-p") scope = "project"
    else if (arg === "--dry-run" || arg === "-n") dryRun = true
    else if (arg === "--help" || arg === "-h") {
      console.log(usage())
      return
    } else if (arg === "--version" || arg === "-v") {
      const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"))
      console.log(pkg.version)
      return
    } else {
      fail(`Unknown option: ${arg}\n\n${usage()}`)
    }
  }

  if (!scope) fail(`Choose a scope.\n\n${usage()}`)
  if (!existsSync(HOOK_SOURCE)) {
    fail(`Hook not found at ${HOOK_SOURCE}. Run \`npm run build\` first.`)
  }

  const settingsPath =
    scope === "user"
      ? join(homedir(), ".claude", "settings.json")
      : join(process.cwd(), ".claude", "settings.json")
  const hookDir = join(dirname(settingsPath), "hooks")
  const hookPath = join(hookDir, HOOK_NAME)

  const settings = loadSettings(settingsPath)
  const changed = installHooks(settings, hookPath)

  if (dryRun) {
    console.log(`[dry-run] Would install the ${HOOK_TYPES.join(" and ")} hooks.`)
    console.log(`  settings: ${settingsPath}`)
    console.log(`  hook:     ${hookPath}`)
    console.log(JSON.stringify({ hooks: settings.hooks }, null, 2))
    return
  }

  mkdirSync(hookDir, { recursive: true })
  copyFileSync(HOOK_SOURCE, hookPath)
  chmodSync(hookPath, 0o755)
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8")

  console.log(changed ? "Installed claude-git-autocommit." : "claude-git-autocommit is already installed; hook refreshed.")
  console.log(`  settings: ${settingsPath}`)
  console.log(`  hook:     ${hookPath}`)
  console.log(`  events:   ${HOOK_TYPES.join(", ")}`)
}

main()
