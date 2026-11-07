// Installs the git hooks on developer machines; skips cleanly on build servers
// (Vercel, Render, CI) where husky isn't installed or there's no git checkout.
if (process.env.HUSKY === "0" || process.env.VERCEL || process.env.CI) process.exit(0);
try {
  const husky = (await import("husky")).default;
  const message = husky();
  if (message) console.log(message);
} catch {
  // husky isn't installed (production install): nothing to set up.
}
