import { describe, expect, it } from "vitest";
import {
  contrastInkFor,
  isThemeMode,
  isThemeName,
  isValidHexColor,
  relativeLuminance,
  resolveMode,
} from "./theme-utils";

describe("isThemeName", () => {
  it("accepts the four known theme names", () => {
    for (const name of ["rose", "slate", "sage", "lavender"]) {
      expect(isThemeName(name)).toBe(true);
    }
  });

  it("rejects unknown values, empty string, and null", () => {
    expect(isThemeName("teal")).toBe(false);
    expect(isThemeName("")).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });
});

describe("isThemeMode", () => {
  it("accepts light/dark/system", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("system")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isThemeMode("auto")).toBe(false);
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

describe("isValidHexColor", () => {
  it("accepts a well-formed 6-digit hex color", () => {
    expect(isValidHexColor("#9c3b4e")).toBe(true);
    expect(isValidHexColor("#FFFFFF")).toBe(true);
  });

  it("rejects 3-digit shorthand, missing #, and non-hex characters", () => {
    expect(isValidHexColor("#fff")).toBe(false);
    expect(isValidHexColor("9c3b4e")).toBe(false);
    expect(isValidHexColor("#gggggg")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("returns 0 for an invalid color instead of throwing", () => {
    expect(relativeLuminance("not-a-color")).toBe(0);
  });
});

describe("contrastInkFor", () => {
  it("picks dark ink for a light/pastel accent", () => {
    expect(contrastInkFor("#ffffff")).toBe("#171310");
  });

  it("picks light ink for dark/saturated accents, including a mid-tone rose", () => {
    expect(contrastInkFor("#000000")).toBe("#fdfaf8");
    expect(contrastInkFor("#9c3b4e")).toBe("#fdfaf8");
    expect(contrastInkFor("#e08398")).toBe("#fdfaf8");
  });

  it("falls back to a safe dark ink for an invalid hex", () => {
    expect(contrastInkFor("nope")).toBe("#111111");
  });
});
