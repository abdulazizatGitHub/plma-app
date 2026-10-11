// Pre-commit: fast checks on staged files only (docs/guides/BRANCHING_AND_CI.md).
const quote = (files) => files.map((f) => `"${f}"`).join(" ");

export default {
  "*.{ts,tsx,mjs,js}": (files) => `node scripts/lint-staged-eslint.mjs ${quote(files)}`,
  "*": (files) => `secretlint --maskSecrets ${quote(files)}`,
};
