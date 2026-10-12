import { fireEvent, within } from "@testing-library/react";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const FULL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Picks a day in a DateField the way a user would: open it, page to the month, tap the day. */
export function pickDate(label: string, iso: string, root: HTMLElement = document.body) {
  const button = within(root).getByRole("button", { name: new RegExp(`^${escapeRe(label)}:`) });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
  const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
  if (!panel) throw new Error(`No calendar for ${label}`);
  const p = within(panel);
  const want = MONTH.format(parse(iso));
  for (let i = 0; i < 24 && p.getByRole("grid").getAttribute("aria-label") !== want; i++) {
    const shown = p.getByRole("grid").getAttribute("aria-label") ?? "";
    const later = parse(iso) > new Date(`${shown} 1`);
    fireEvent.click(p.getByRole("button", { name: later ? "Next month" : "Previous month" }));
  }
  fireEvent.click(p.getByRole("gridcell", { name: new RegExp(`^${escapeRe(FULL.format(parse(iso)))}`) }));
}
