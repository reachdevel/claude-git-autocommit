#!/usr/bin/env node
/**
 * install.js — One-shot install of the claude-git-autocommit Stop hook.
 *
 * Adds the hook entry to Claude Code settings JSON (user or project scope),
 * then points you at the compiled hook script. No manual JSON editing needed.
 *
 * Usage:
 *   # Install for all projects (user settings)
 *   node scripts/install.js --user
 *
 *   # Install for a single repo (project settings)
 *   node scripts/install.js --project
 *
 *   # Dry run (print what would change, don't write)
 *   node scripts/install.js --user --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const REPO_ROOT = join(process.cwd())
const HOOK_COMMAND = join(REPO_ROOT, "dist", "commit-from-diff.mjs")

function hookEntry() {
  return {
    type: "command",
    command: HOOK_COMMAND,
    args: []
  }
}

function ensureHooks(settings) {
  if (!settings.hooks) settings.hooks = {}
  if (!settings.hooks.Stop) settings.hooks.Stop = []
  return settings.hooks.Stop
}

function alreadyInstalled(stopHooks) {
  return stopHooks.some((group) =>
    (group.hooks ?? []).some((h) => h.command === HOOK_COMMAND)
  )
}

function addHook(stopHooks) {
  if (alreadyInstalled(stopHooks)) return false
  stopHooks.push({ hooks: [hookEntry()] })
  return true
}

function loadSettings(path) {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return {}
  }
}

function writeSettings(path, settings) {
  const dir = join(path, "..")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8")
}

function main() {
  const args = process.argv.slice(2)
  const scope = args.includes("--user") ? "user" : args.includes("--project") ? "project" : null
  const dryRun = args.includes("--dry-run")

  if (!scope) {
    console.error("Usage: node scripts/install.js [--user | --project] [--dry-run]")
    process.exit(1)
  }

  const settingsPath =
    scope === "user"
      ? join(homedir(), ".claude", "settings.json")
      : join(REPO_ROOT, ".claude", "settings.json")

  const settings = loadSettings(settingsPath)
  const stopHooks = ensureHooks(settings)
  const changed = addHook(stopHooks)

  if (!changed) {
    console.log(`claude-git-autocommit hook already installed in ${settingsPath}`)
    process.exit(0)
  }

  if (dryRun) {
    console.log(`[dry-run] Would add Stop hook to ${settingsPath}:`)
    console.log(JSON.stringify({ hooks: { Stop: [{ hooks: [hookEntry()] }] } }, null, 2))
    process.exit(0)
  }

  writeSettings(settingsPath, settings)
  console.log(`Installed claude-git-autocommit Stop hook in ${settingsPath}`)
  console.log(`Hook command: ${HOOK_COMMAND}`)
  console.log("\nMake sure the compiled hook is executable:")
  console.log(`  chmod +x ${HOOK_COMMAND}`)
}

main()
