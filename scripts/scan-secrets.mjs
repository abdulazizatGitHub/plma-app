// Scans every tracked file for secrets (npm run secrets; CI also runs gitleaks).
// Untracked files such as .env.local are ignored on purpose: they never reach git.
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const bin = path.join("node_modules", ".bin", process.platform === "win32" ? "secretlint.cmd" : "secretlint");
let failed = false;
for (let i = 0; i < files.length; i += 200) {
  const res = spawnSync(bin, ["--maskSecrets", ...files.slice(i, i + 200)], { stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
