// Pre-commit guard for what must never be committed:
//  - env files with real values (.env, .env.local, apps/*/.env…; .env.example is fine)
//  - large files (> 2 MB) that belong elsewhere
//  - stray console.log in app source (tests and scripts may log)
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const MAX_BYTES = 2 * 1024 * 1024;
const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const problems = [];
for (const file of staged) {
  const base = file.split("/").pop() ?? file;
  if (/^\.env(\..+)?$/.test(base) && base !== ".env.example") problems.push(`${file}: env files hold secrets — keep them out of git (.gitignore).`);
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue; // deleted or renamed away
  }
  if (size > MAX_BYTES) problems.push(`${file}: ${(size / 1024 / 1024).toFixed(1)} MB is over the 2 MB limit.`);
  if (/^apps\/[^/]+\/src\/.+\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/\bconsole\.log\(/.test(line) && !/eslint-disable|guard-allow/.test(line)) problems.push(`${file}:${i + 1}: remove console.log (use the logger, or mark the line "guard-allow").`);
    });
  }
}

if (problems.length) {
  console.error("\nCommit blocked:\n" + problems.map((p) => `  • ${p}`).join("\n") + "\n");
  process.exit(1);
}
