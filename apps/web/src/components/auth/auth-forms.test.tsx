import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OtpInput, QuantityStepper } from "@/components/kit";
import SignUpPage from "@/app/(auth)/sign-up/page";
import { TaskForm } from "@/components/today/task-form";

const auth = {
  status: "signed_out",
  user: null,
  signUp: vi.fn(),
  verifyEmailCode: vi.fn(),
  resendSignupCode: vi.fn(),
};
const replace = vi.fn();
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Sign-up form", () => {
  beforeEach(() => {
    auth.signUp.mockReset().mockResolvedValue({ error: null, needsCode: true });
    auth.verifyEmailCode.mockReset().mockResolvedValue(null);
  });

  it("keeps Create account disabled until every field is valid", () => {
    render(<SignUpPage />);
    const submit = screen.getByRole("button", { name: "Create account" });
    expect(submit).toBeDisabled();
    type(/Full name/, "Abdul Aziz");
    type(/^Email/, "abdul@example.com");
    type(/^Password/, "weakpass");
    type(/Confirm password/, "weakpass");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeDisabled(); // password misses upper/number/symbol
    type(/^Password/, "Str0ng!pass");
    expect(submit).toBeDisabled(); // confirm no longer matches
    type(/Confirm password/, "Str0ng!pass");
    expect(submit).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox")); // terms are required
    expect(submit).toBeDisabled();
  });

  it("explains errors after a field is left, including a confirm mismatch", () => {
    render(<SignUpPage />);
    type(/^Email/, "not-an-email");
    fireEvent.blur(screen.getByLabelText(/^Email/));
    expect(screen.getByText(/valid email/)).toBeInTheDocument();
    type(/^Password/, "Str0ng!pass");
    type(/Confirm password/, "Str0ng!pasz");
    fireEvent.blur(screen.getByLabelText(/Confirm password/));
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
  });

  it("goes to the 6-digit code step, then verifies and opens Today", async () => {
    render(<SignUpPage />);
    type(/Full name/, "Abdul Aziz");
    type(/^Email/, "abdul@example.com");
    type(/^Password/, "Str0ng!pass");
    type(/Confirm password/, "Str0ng!pass");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(auth.signUp).toHaveBeenCalledWith("Abdul Aziz", "abdul@example.com", "Str0ng!pass");
    const verify = await screen.findByRole("button", { name: "Confirm account" });
    expect(verify).toBeDisabled();
    type(/Verification code/, "12ab34");
    expect(screen.getByLabelText(/Verification code/)).toHaveValue("1234"); // letters dropped
    expect(verify).toBeDisabled();
    type(/Verification code/, "123456");
    expect(verify).toBeEnabled();
    fireEvent.click(verify);
    await waitFor(() => expect(auth.verifyEmailCode).toHaveBeenCalledWith("abdul@example.com", "123456"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("numbers-only inputs", () => {
  it("OTP input keeps digits only, max 6", () => {
    function Harness() {
      const [v, setV] = useState("");
      return <OtpInput value={v} onChange={setV} />;
    }
    render(<Harness />);
    type(/Verification code/, "9a8b7c6d5e4f3g");
    expect(screen.getByLabelText(/Verification code/)).toHaveValue("987654");
  });

  it("the quantity stepper's typed value ignores letters", () => {
    function Harness() {
      const [v, setV] = useState(0);
      return <QuantityStepper label="Steps" value={v} onChange={setV} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Tap to type a value/ }));
    const input = screen.getByRole("textbox", { name: "Steps value" });
    fireEvent.change(input, { target: { value: "12abc000" } });
    expect(input).toHaveValue("12000");
  });
});

describe("TaskForm", () => {
  it("keeps Add disabled until the task has a name, and until a picked date is valid", () => {
    const onSubmit = vi.fn();
    render(<TaskForm categories={[]} initial={{ date: "2026-10-10" }} submitLabel="Add" onSubmit={onSubmit} />);
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    type(/What needs doing/, "   ");
    expect(add).toBeDisabled();
    type(/What needs doing/, "Quiz");
    expect(add).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Pick date" }));
    type(/^Date/, "");
    expect(add).toBeDisabled();
    type(/^Date/, "2026-10-20");
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Quiz", date: "2026-10-20" }));
  });
});
