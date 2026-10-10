import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { UserMenu, initialsFor } from "./user-menu";

const signOut = vi.fn().mockResolvedValue(undefined);
const syncNow = vi.fn().mockResolvedValue(undefined);
const replace = vi.fn();
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", email: "abdul@example.com", name: "Abdul Aziz" }, signOut }),
}));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ syncNow, syncing: false }) }));
vi.mock("@/lib/v2/use-day", () => ({ usePending: () => [{ id: "p1" }, { id: "p2" }] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ children, href, onClick }: { children: ReactNode; href: string; onClick?: () => void }) => <a href={href} onClick={onClick}>{children}</a> }));

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
});

const renderMenu = () =>
  render(
    <ThemeProvider>
      <UserMenu />
    </ThemeProvider>,
  );

describe("UserMenu", () => {
  it("shows initials and opens/closes with Escape", () => {
    renderMenu();
    const avatar = screen.getByRole("button", { name: "Account menu for Abdul Aziz" });
    expect(avatar).toHaveTextContent("AA");
    fireEvent.click(avatar);
    expect(screen.getByRole("dialog", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("abdul@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pending/ })).toHaveTextContent("2");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches theme and appearance from the menu", async () => {
    renderMenu();
    await act(async () => undefined); // ThemeProvider hydrates
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Sunset" }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("sunset"));
    fireEvent.click(screen.getByRole("tab", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-mode")).toBe("dark"));
    expect(localStorage.getItem("life_theme")).toBe("sunset");
  });

  it("syncs and signs out", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(syncNow).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
  });

  it("builds initials from the name, or the email", () => {
    expect(initialsFor("abdul aziz khan", null)).toBe("AA");
    expect(initialsFor(null, "zara@example.com")).toBe("Z");
    expect(initialsFor("  ", null)).toBe("?");
  });
});
