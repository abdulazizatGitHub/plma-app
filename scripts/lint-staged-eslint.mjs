// Runs ESLint --fix on staged files with the right workspace's ESLint:
// apps/web uses its own ESLint 9 + eslint-config-next; everything else the
// root ESLint 10 config. Called by lint-staged with absolute file paths.
// ESLint runs through Node directly (no shell), so paths with spaces are safe.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const web = path.join(root, "apps", "web");
const files = process.argv.slice(2).map((f) => path.resolve(f));
const inWeb = files.filter((f) => f.startsWith(web + path.sep));
const rest = files.filter((f) => !inWeb.includes(f));

function run(cwd, list) {
  if (!list.length) return 0;
  // The ESLint installed for this workspace: the nearest node_modules/eslint upwards.
  let dir = cwd;
  while (!existsSync(path.join(dir, "node_modules", "eslint", "bin", "eslint.js")) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  const eslintBin = path.join(dir, "node_modules", "eslint", "bin", "eslint.js");
  const args = [eslintBin, "--fix", "--no-warn-ignored", "--max-warnings=0", ...list.map((f) => path.relative(cwd, f))];
  const res = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  return res.status ?? 1;
}

process.exit(run(web, inWeb) || run(root, rest));
