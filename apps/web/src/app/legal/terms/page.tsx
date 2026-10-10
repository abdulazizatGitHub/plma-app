import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms — Life" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="10 October 2026">
      <p>Life helps you plan your day and track habits, prayers, tasks and goals. By creating an account you agree to these terms.</p>
      <h2>Your account</h2>
      <ul>
        <li>Give a real email address and keep your password private. You are responsible for activity on your account.</li>
        <li>You must be old enough to agree to these terms where you live.</li>
      </ul>
      <h2>Your content</h2>
      <ul>
        <li>What you enter (tasks, categories, progress) belongs to you. We store it only to run the app for you.</li>
        <li>Don&apos;t use Life for anything unlawful or to harm others.</li>
      </ul>
      <h2>The service</h2>
      <ul>
        <li>We work to keep Life available and your data safe, but the app is provided as-is and may change over time.</li>
        <li>You can stop using Life at any time. You can ask us to delete your account and data.</li>
      </ul>
    </LegalPage>
  );
}
