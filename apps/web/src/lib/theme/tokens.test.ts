import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { relativeLuminance } from "./theme-utils";
import { DARK, LIGHT, TEXT_PAIRS, THEMES, THEME_NAMES, palette } from "./tokens";

function contrast(a: string, b: string) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8").replace(/\r\n/g, "\n");

/** `--name: #hex` declarations inside the block that starts with `selector {`. */
function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}

describe("v2 tokens", () => {
  it("globals.css light block matches tokens.ts", () => {
    const light = block(':root,\n[data-mode="light"]');
    for (const [name, value] of Object.entries(LIGHT)) expect(light[name], name).toBe(value);
  });

  it("globals.css dark block matches tokens.ts", () => {
    const dark = block('[data-mode="dark"]');
    for (const [name, value] of Object.entries(DARK)) expect(dark[name], name).toBe(value);
  });

  it.each(THEME_NAMES.filter((t) => t !== "sky"))("globals.css %s theme blocks match tokens.ts", (theme) => {
    const shared = block(`[data-theme="${theme}"]`);
    const light = { ...shared, ...block(`[data-theme="${theme}"]:not([data-mode="dark"])`) };
    const dark = { ...shared, ...block(`[data-theme="${theme}"][data-mode="dark"]`) };
    for (const [name, value] of Object.entries(THEMES[theme].light)) expect(light[name], `${theme} light ${name}`).toBe(value);
    for (const [name, value] of Object.entries(THEMES[theme].dark)) expect(dark[name], `${theme} dark ${name}`).toBe(value);
  });

  it.each(THEME_NAMES.flatMap((t) => [[t, "light"], [t, "dark"]] as const))(
    "every text pair passes WCAG AA (4.5:1) in %s / %s",
    (theme, mode) => {
      const p = palette(theme, mode);
      for (const [fg, bg] of TEXT_PAIRS) {
        expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
