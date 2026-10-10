import { describe, expect, it } from "vitest";
import { isThemeMode, isValidHexColor, relativeLuminance, resolveMode } from "./theme-utils";

describe("isThemeMode", () => {
  it("accepts light/dark/system", () => {
    expect(["light", "dark", "system"].every(isThemeMode)).toBe(true);
  });

  it("rejects anything else, including retired preset names", () => {
    expect(isThemeMode("clay")).toBe(false);
    expect(isThemeMode("")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });
});

describe("resolveMode", () => {
  it("passes light/dark straight through regardless of system preference", () => {
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });

  it("resolves 'system' using the OS preference", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
  });
});

describe("colors", () => {
  it("validates 6-digit hex colors", () => {
    expect(isValidHexColor("#7293f1")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(false);
  });

  it("computes relative luminance, 0 for invalid input", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1);
    expect(relativeLuminance("nope")).toBe(0);
  });
});
