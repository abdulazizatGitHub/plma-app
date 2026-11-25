import { fireEvent, screen } from "@testing-library/react";
import { todayLocalDate } from "@life/shared";

/** Same wording as the calendar's day buttons (kit/date-picker.tsx). */
const FULL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Opens a day on Today through the calendar next to the date (tests only). */
export async function pickDay(iso: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Pick a day" }));
  const name = new RegExp(`^${FULL.format(new Date(`${iso}T12:00:00`))}`);
  // The grid shows the picked month plus a few days either side; flip a month if needed.
  if (!screen.queryByRole("gridcell", { name })) fireEvent.click(screen.getByRole("button", { name: iso > todayLocalDate() ? "Next month" : "Previous month" }));
  fireEvent.click(screen.getByRole("gridcell", { name }));
}
