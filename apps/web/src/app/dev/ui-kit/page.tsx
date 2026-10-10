import { notFound } from "next/navigation";
import { UiKit } from "./ui-kit";

export const metadata = { title: "UI kit — Life v2" };

/** Dev-only gallery of the v2 UI kit (v2 Phase 0). Not shipped to production. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKit />;
}
