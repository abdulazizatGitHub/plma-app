// Writes docs/guides/USER_GUIDE.md from the in-app guide (src/lib/help/content.ts), so they never drift.
// `npm run docs:guide -w web`
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HELP } from "../src/lib/help/content";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const lines = [
  "# Life — user guide",
  "",
  "How to use the Life app. This file is generated from the in-app **App guide** (Profile → Help → App guide); edit `apps/web/src/lib/help/content.ts` and run `npm run docs:guide -w web`.",
  "",
  "## Contents",
  "",
  ...HELP.map((s) => `- [${s.title}](#${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")})`),
  "",
];
for (const s of HELP) {
  lines.push(`## ${s.title}`, "");
  for (const a of s.articles) lines.push(`### ${a.q}`, "", ...a.a.flatMap((p) => [p, ""]));
}
writeFileSync(path.join(root, "docs/guides/USER_GUIDE.md"), lines.join("\n").trimEnd() + "\n");
console.log("docs/guides/USER_GUIDE.md written");
