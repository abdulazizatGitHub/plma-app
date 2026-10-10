import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useForm } from "./use-form";
import {
  confirmPassword,
  email,
  fullName,
  isoDate,
  newPassword,
  otpCode,
  passwordRules,
  passwordStrength,
  quantity,
  sanitizeDigits,
  taskTitle,
} from "./validators";

describe("validators", () => {
  it("validates emails", () => {
    expect(email("")).toMatch(/required/);
    expect(email("abdul")).toMatch(/valid email/);
    expect(email("a@b")).toMatch(/valid email/);
    expect(email("a b@c.com")).toMatch(/valid email/);
    expect(email("  abdul@example.com ")).toBeNull();
  });

  it("enforces every password rule and reports what is missing", () => {
    expect(newPassword("")).toMatch(/required/);
    expect(newPassword("abcdefgh")).toMatch(/uppercase.*number.*symbol/);
    expect(newPassword("Abcdef1!")).toBeNull();
    expect(newPassword(`Aa1!${"x".repeat(70)}`)).toMatch(/72/);
    expect(passwordRules("Abc1").map((r) => r.ok)).toEqual([false, true, true, true, false]);
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Abcdef1!xyz#")).toBe(4);
  });

  it("requires a matching confirmation", () => {
    expect(confirmPassword("Abcdef1!")("")).toMatch(/confirm/);
    expect(confirmPassword("Abcdef1!")("Abcdef1?")).toMatch(/match/);
    expect(confirmPassword("Abcdef1!")("Abcdef1!")).toBeNull();
  });

  it("validates names, codes, titles, dates and quantities", () => {
    expect(fullName("A")).toMatch(/2 characters/);
    expect(fullName("Abdul 123")).toMatch(/letters/);
    expect(fullName("Abdul Aziz")).toBeNull();
    expect(fullName("Zoë O'Neil-Ali")).toBeNull();
    expect(otpCode("12345")).not.toBeNull();
    expect(otpCode("12a456")).not.toBeNull();
    expect(otpCode("123456")).toBeNull();
    expect(taskTitle("   ")).not.toBeNull();
    expect(taskTitle("Quiz")).toBeNull();
    expect(isoDate("2026-02-30")).not.toBeNull();
    expect(isoDate("2026-02-28")).toBeNull();
    expect(quantity("12a")).not.toBeNull();
    expect(quantity("2000000")).toMatch(/Max/);
    expect(quantity("10000")).toBeNull();
  });

  it("keeps digits only", () => {
    expect(sanitizeDigits("10,000 steps")).toBe("10000");
    expect(sanitizeDigits("abc")).toBe("");
    expect(sanitizeDigits("123456789", 6)).toBe("123456");
  });
});

describe("useForm", () => {
  it("is invalid until every rule passes, and shows errors only after blur or submit", () => {
    const { result } = renderHook(() =>
      useForm({ email: "", password: "" }, { email: (v) => email(v), password: (v) => (v ? null : "Password is required.") }),
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.field("email").error).toBeNull(); // untouched: no noise
    act(() => result.current.field("email").onBlur());
    expect(result.current.field("email").error).toMatch(/required/);
    act(() => {
      result.current.set("email", "me@example.com");
      result.current.set("password", "x");
    });
    expect(result.current.isValid).toBe(true);
  });

  it("shows all errors after a submit attempt", () => {
    const { result } = renderHook(() => useForm({ title: "" }, { title: (v) => taskTitle(v) }));
    act(() => {
      expect(result.current.attempt()).toBe(false);
    });
    expect(result.current.field("title").error).toBe("Give it a name.");
  });
});
