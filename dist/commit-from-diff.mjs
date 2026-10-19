#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const DOC_RE = /(^|\/)(docs?)\/|\.(md|mdx|rst)$|^readme/i;
const BUILD_RE = /(^|\/)(dist|build|out|coverage|\.next|target|vendor)\/|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|.*\.lock|\.DS_Store|tsconfig.*\.json|.*\.config\.[cm]?[jt]s)$|^\.github\//;
const SOURCE_RE = /\.(cm?js|[jt]sx?|py|rs|go|rb|java|kt|swift|c|h|cc|cpp|hpp|cs|php|svelte|vue|sh|bash|sql|html|css|scss|astro)$/;
function rank(file) {
    if (BUILD_RE.test(file))
        return 3;
    if (DOC_RE.test(file))
        return 2;
    if (TEST_RE.test(file))
        return 1;
    return 0;
}
function isAll(changes, pattern) {
    return changes.every((c) => pattern.test(c.file));
}
function parseNameStatus(output) {
    const entries = [];
    for (const line of output.split("\n")) {
        if (!line.trim())
            continue;
        const fields = line.split("\t");
        entries.push({ status: fields[0] ?? "", file: fields[fields.length - 1] ?? "" });
    }
    return entries;
}
function parseNumstat(output) {
    const stats = new Map();
    for (const line of output.split("\n")) {
        if (!line.trim())
            continue;
        const [added, deleted, ...rest] = line.split("\t");
        const file = rest[rest.length - 1];
        if (!file)
            continue;
        stats.set(file, {
            added: Number.isFinite(+added) ? +added : 0,
            deleted: Number.isFinite(+deleted) ? +deleted : 0,
        });
    }
    return stats;
}
function stagedChanges(cwd) {
    const nameStatus = execFileSync("git", ["diff", "--cached", "--name-status"], {
        cwd,
        encoding: "utf8",
    });
    const numstat = execFileSync("git", ["diff", "--cached", "--numstat"], {
        cwd,
        encoding: "utf8",
    });
    const stats = parseNumstat(numstat);
    return parseNameStatus(nameStatus).map(({ status, file }) => ({
        status,
        file,
        added: stats.get(file)?.added ?? 0,
        deleted: stats.get(file)?.deleted ?? 0,
    }));
}
function classify(changes) {
    const allAdded = changes.every((c) => c.status.startsWith("A"));
    const allDeleted = changes.every((c) => c.status.startsWith("D"));
    if (isAll(changes, TEST_RE))
        return "test";
    if (isAll(changes, DOC_RE))
        return "docs";
    if (isAll(changes, BUILD_RE))
        return "chore";
    if (allDeleted)
        return "chore";
    if (allAdded)
        return "feat";
    return "fix";
}
function describeFiles(files) {
    const [first, second] = files;
    if (files.length === 1)
        return first;
    if (files.length === 2)
        return `${first} and ${second}`;
    return `${first} and ${files.length - 1} more files`;
}
function commitMessageFromDiff(cwd) {
    const changes = stagedChanges(cwd);
    if (!changes.length)
        return undefined;
    const type = classify(changes);
    const allDeleted = changes.every((c) => c.status.startsWith("D"));
    const files = changes
        .slice()
        .sort((a, b) => rank(a.file) - rank(b.file) || a.file.length - b.file.length)
        .map((c) => c.file);
    const verb = allDeleted ? "remove" : type === "feat" ? "add" : "update";
    const subject = `${type}: ${verb} ${describeFiles(files)}`;
    const message = subject.length > 72 ? `${subject.slice(0, 69).trimEnd()}...` : subject;
    return message.replace(/[\r\n]/g, " ");
}
function git(cwd, args) {
    return execFileSync("git", args, { cwd, encoding: "utf8" });
}
function logDebug(message) {
    // eslint-disable-next-line no-console
    console.error(`[claude-git-autocommit] ${message}`);
}
function main() {
    let cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    try {
        // Claude Code passes hook input as JSON on stdin. Extract cwd from it.
        const input = process.stdin.isTTY ? "" : readFileSync(0, "utf8");
        if (input.trim()) {
            const parsed = JSON.parse(input);
            if (parsed.cwd)
                cwd = parsed.cwd;
        }
    }
    catch {
        // ignore parse errors, fall through to default cwd
    }
    try {
        // Skip if no changes
        const status = git(cwd, ["status", "--porcelain"]);
        if (!status.trim()) {
            logDebug("No changes detected");
            process.exit(0);
        }
        // Stage first so the diff describes everything, including brand new files
        git(cwd, ["add", "."]);
        const message = commitMessageFromDiff(cwd) ?? "chore: automated update";
        // Fall back to a bot identity only when the machine has no git identity configured
        let identity = [];
        try {
            const email = git(cwd, ["config", "--get", "user.email"]).trim();
            if (!email && !process.env.GIT_AUTHOR_EMAIL) {
                identity = ["-c", "user.name=claude-git-autocommit", "-c", "user.email=claude-git-autocommit@localhost"];
            }
        }
        catch {
            identity = ["-c", "user.name=claude-git-autocommit", "-c", "user.email=claude-git-autocommit@localhost"];
        }
        git(cwd, [...identity, "commit", "-m", message, "--no-verify"]);
        logDebug(`Committed: ${message}`);
    }
    catch (err) {
        // Always exit 0 — never wedge Claude's turn on a failed auto-commit
        logDebug(`Auto-commit skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(0);
}
main();
