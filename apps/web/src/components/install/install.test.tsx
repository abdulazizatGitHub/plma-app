import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallProvider, detectPlatform } from "@/lib/v2/install";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { InstallBanner } from "./install-banner";
import { InstallGuide } from "./install-guide";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WIN_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("detectPlatform", () => {
  it("knows each install route", () => {
    expect(detectPlatform(IPHONE_SAFARI)).toBe("ios-safari");
    expect(detectPlatform(IPHONE_CHROME)).toBe("ios-other");
    expect(detectPlatform(MAC_SAFARI, 5)).toBe("ios-safari"); // iPadOS says "Mac" but has touch
    expect(detectPlatform(MAC_SAFARI, 0)).toBe("desktop-safari");
    expect(detectPlatform(ANDROID)).toBe("android");
    expect(detectPlatform(WIN_CHROME)).toBe("desktop");
  });
});

describe("install banner and guide", () => {
  const ua = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window.navigator, "userAgent", { value: IPHONE_SAFARI, configurable: true });
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });
  afterEach(() => {
    if (ua) Object.defineProperty(window.navigator, "userAgent", ua);
  });

  const app = () =>
    render(
      <InstallProvider>
        <InstallBanner />
        <InstallGuide />
      </InstallProvider>,
    );

  it("iPhone Safari: the banner opens the step-by-step guide for iPhone", () => {
    app();
    const banner = screen.getByRole("region", { name: "Install the app" });
    fireEvent.click(within(banner).getByRole("button", { name: "How to install" }));
    const guide = screen.getByRole("dialog", { name: "Install Life" });
    expect(within(guide).getByRole("tab", { name: "iPhone" })).toHaveAttribute("aria-selected", "true");
    const steps = within(within(guide).getByRole("list", { name: "Steps for iphone" })).getAllByRole("button");
    expect(steps.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Share"),
      expect.stringContaining("Add to Home Screen"),
      expect.stringContaining("Add"),
      expect.stringContaining("Home Screen"),
    ]);
  });

  it("Not now hides it for two weeks", () => {
    const { unmount } = app();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
    unmount();
    app();
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
  });

  it("where the browser can install, the banner installs in one tap", async () => {
    Object.defineProperty(window.navigator, "userAgent", { value: ANDROID, configurable: true });
    app();
    const prompt = vi.fn(async () => {});
    const evt = Object.assign(new Event("beforeinstallprompt"), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => void window.dispatchEvent(evt));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Install" })));
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull(); // installed
  });

  it("hidden when already installed (opened from the Home Screen)", () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: q.includes("standalone"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    app();
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
  });
});
