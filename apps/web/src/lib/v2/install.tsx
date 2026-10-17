"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/*
 * Installing Life to the Home Screen (owner, 2026-10-17). Where the browser
 * offers its own install prompt (Chrome, Edge, Samsung Internet on Android and
 * desktop) one tap installs; elsewhere — iPhone Safari above all — a guide
 * shows the steps. Once installed (opened from the Home Screen) nothing shows.
 */

export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop" | "desktop-safari" | "unsupported";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "life_install_banner_dismissed";
const DISMISS_DAYS = 14;

/** Which install route this browser has (from the user agent; best effort). */
export function detectPlatform(ua: string, touchPoints = 0): InstallPlatform {
  const iPad = /Macintosh/.test(ua) && touchPoints > 1; // iPadOS reports a Mac
  if (/iPhone|iPad|iPod/.test(ua) || iPad) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return "desktop-safari";
  if (/Firefox/.test(ua)) return "unsupported";
  return "desktop";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type InstallState = {
  platform: InstallPlatform;
  /** Opened from the Home Screen (already installed). */
  installed: boolean;
  /** The browser can install in one tap (its own prompt). */
  canPrompt: boolean;
  bannerVisible: boolean;
  dismissBanner: () => void;
  /** One-tap install when possible; otherwise opens the guide. */
  install: () => Promise<void>;
  guideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
};

const Ctx = createContext<InstallState | null>(null);

export function InstallProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  /** null until read from storage; true within two weeks of "Not now". */
  const [snoozed, setSnoozed] = useState<boolean | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read the browser once on mount */
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setInstalled(isStandalone());
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      setSnoozed(!!raw && Date.now() - Number(raw) < DISMISS_DAYS * 86_400_000);
    } catch {
      setSnoozed(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own Install button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    setSnoozed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* fine: it just shows again next time */
    }
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      setDeferred(null);
      if (choice.outcome === "accepted") setInstalled(true);
      return;
    }
    setGuideOpen(true);
  }, [deferred]);

  // Hidden until storage is read, when installed, or within two weeks of "Not now".
  const bannerVisible = snoozed === false && !installed && platform !== "unsupported";

  const value = useMemo(
    () => ({
      platform,
      installed,
      canPrompt: !!deferred,
      bannerVisible,
      dismissBanner,
      install,
      guideOpen,
      openGuide: () => setGuideOpen(true),
      closeGuide: () => setGuideOpen(false),
    }),
    [platform, installed, deferred, bannerVisible, dismissBanner, install, guideOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const NONE: InstallState = {
  platform: "desktop",
  installed: false,
  canPrompt: false,
  bannerVisible: false,
  dismissBanner: () => {},
  install: async () => {},
  guideOpen: false,
  openGuide: () => {},
  closeGuide: () => {},
};

export function useInstall(): InstallState {
  return useContext(Ctx) ?? NONE;
}
