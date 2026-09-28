import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Skincare Routine")).toBe("skincare-routine");
  });

  it("collapses runs of non-alphanumeric characters into one hyphen", () => {
    expect(slugify("Water!!  Intake??")).toBe("water-intake");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -Leading and trailing-  ")).toBe("leading-and-trailing");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("preserves numbers", () => {
    expect(slugify("30 min walk")).toBe("30-min-walk");
  });

  it("handles unicode letters by dropping them (ASCII-only slug)", () => {
    expect(slugify("Café Study")).toBe("caf-study");
  });
});

describe("uniqueSlug", () => {
  it("appends the first 8 chars of the suffix source, with hyphens stripped", () => {
    expect(uniqueSlug("Skincare", "123e4567-e89b-42d3-a456-556642440000")).toBe(
      "skincare-123e4567",
    );
  });

  it("falls back to 'habit' as the base when the name has no alphanumerics", () => {
    expect(uniqueSlug("!!!", "abcdefgh")).toBe("habit-abcdefgh");
  });

  it("truncates a short suffix source without padding", () => {
    expect(uniqueSlug("Reading", "ab")).toBe("reading-ab");
  });
});
