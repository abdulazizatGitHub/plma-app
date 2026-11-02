import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToday } from "./use-today";

afterEach(() => vi.useRealTimers());

describe("useToday", () => {
  it("rolls over at local midnight (the app is often left open overnight)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59, 0));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe("2026-10-11");
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(result.current).toBe("2026-10-12");
  });

  it("catches up when the app comes back to the foreground", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 11, 22, 0, 0));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 9, 12, 7, 30, 0)); // phone asleep all night, timers paused
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-10-12");
  });
});
