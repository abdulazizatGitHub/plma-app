"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const WIDTH = 208;
const GAP = 6;
const EDGE = 8;

type PopoverMenuProps = {
  /** The element that opened the menu (the ⋯ button, or the row on long-press). */
  anchor: HTMLElement | null;
  onClose: () => void;
  /** Accessible name, e.g. the row title. Shown as a small caption. */
  label: string;
  children: ReactNode;
};

/**
 * Compact action menu anchored to its trigger: opens below it, or above when
 * there's no room, right-aligned and kept inside the viewport, following the
 * trigger on scroll/resize. Escape or an outside tap closes it; Escape returns
 * focus to the trigger.
 */
export function PopoverMenu({ anchor, onClose, label, children }: PopoverMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  /** Below the trigger, or above it when there's no room; right-aligned, inside the viewport. */
  const place = useCallback(() => {
    if (!anchor || !panel.current) return;
    const r = anchor.getBoundingClientRect();
    const h = panel.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(EDGE, r.right - WIDTH), vw - WIDTH - EDGE);
    const below = r.bottom + GAP;
    const preferred = below + h <= vh - EDGE ? below : r.top - GAP - h;
    // Always fully on screen, even if the trigger itself has scrolled out of view.
    const top = Math.min(Math.max(EDGE, preferred), Math.max(EDGE, vh - h - EDGE));
    setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
  }, [anchor]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  // Follow the trigger instead of closing: on phones the keyboard (e.g. the date
  // field inside the menu) resizes the viewport, which must not dismiss the menu.
  useEffect(() => {
    if (!anchor || !panel.current) return;
    // Grows when the inline date picker opens (ResizeObserver is missing in very old browsers).
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, place]);

  useEffect(() => {
    if (!anchor) return;
    panel.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        anchor.focus?.();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [...(panel.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
        e.preventDefault();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (panel.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;
  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      className="card fixed z-50 rounded-[14px] p-1 shadow-[0_8px_24px_rgb(27_26_34/14%)]"
      style={{ width: WIDTH, top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
    >
      <p className="truncate px-2.5 pt-1 pb-1 text-[11px] font-medium text-ink-2">{label}</p>
      {children}
    </div>,
    document.body,
  );
}

type PopoverMenuItemProps = {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
};

/** One menu row: icon + label, 44px tall for touch. */
export function PopoverMenuItem({ icon, label, onClick, tone = "default" }: PopoverMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[13px] text-ink outline-none hover:bg-track focus-visible:bg-track"
    >
      {icon ? (
        <span className="text-ink-2 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
          {icon}
        </span>
      ) : null}
      {/* The status red fails AA as text, so danger is signalled by a dot. */}
      {tone === "danger" ? <span className="h-2 w-2 rounded-full bg-todo" aria-hidden /> : null}
      {label}
    </button>
  );
}

export const PopoverMenuDivider = () => <hr className="my-0.5 border-border" />;
