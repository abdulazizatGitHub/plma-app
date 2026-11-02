import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mehrmah — Sign in" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
